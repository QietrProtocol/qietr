// =============================================================================
// qietr_indexer_geyser — Geyser plugin for the Qietr shielded pool.
//
// The validator loads this as a .so and calls these callbacks for every
// account write and transaction. We filter on qietr_pool's program-id
// (set via the plugin config JSON at validator startup) and shovel
// matching writes into Postgres via a background worker.
//
// Reference: docs/02-TRD.md section 8.
//
// Data flow:
//   update_account
//     ├─ Denomination     → UpsertDenomination
//     ├─ MerkleTree       → UpsertRoot + maintain per-denom next_leaf_index cache
//     └─ NullifierRecord  → InsertNullifier
//   notify_transaction
//     ├─ deposit  ix      → InsertCommitment (leaf_index from cache, then ++)
//     └─ withdraw ix      → (already captured via NullifierRecord update_account)
//   update_slot_status (Rooted) → Checkpoint
// =============================================================================

mod decode;
mod writer;

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, RwLock};

use serde::Deserialize;
use solana_geyser_plugin_interface::geyser_plugin_interface::{
    GeyserPlugin, GeyserPluginError, ReplicaAccountInfoVersions,
    ReplicaTransactionInfoVersions, Result as PluginResult, SlotStatus,
};
use solana_program::pubkey::Pubkey;

use decode::{
    decode_denomination, decode_merkle_tree, decode_nullifier_record, AccountKind,
    IxDescriptors,
};
use writer::{spawn, WriteEvent, WriterHandle};

#[derive(Deserialize, Debug)]
struct PluginConfig {
    pool_program_id: String,
    db_url: String,
    #[serde(default = "default_component_name")]
    component_name: String,
}

fn default_component_name() -> String {
    "geyser".into()
}

pub struct QietrIndexerPlugin {
    pool_program_id: Option<Pubkey>,
    writer: Option<WriterHandle>,
    /// Per-denom cache of `next_leaf_index` as last seen on the MerkleTree
    /// account. Used to derive `leaf_index` for incoming deposit ixs.
    leaf_index_cache: Arc<RwLock<HashMap<u8, u64>>>,
    ix_descriptors: IxDescriptors,
    component_name: String,
}

impl Default for QietrIndexerPlugin {
    fn default() -> Self {
        Self {
            pool_program_id: None,
            writer: None,
            leaf_index_cache: Arc::new(RwLock::new(HashMap::new())),
            ix_descriptors: IxDescriptors::precomputed(),
            component_name: default_component_name(),
        }
    }
}

impl std::fmt::Debug for QietrIndexerPlugin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("QietrIndexerPlugin")
            .field("pool_program_id", &self.pool_program_id)
            .field("component_name", &self.component_name)
            .finish()
    }
}

impl GeyserPlugin for QietrIndexerPlugin {
    fn name(&self) -> &'static str {
        "qietr_indexer_geyser"
    }

    fn on_load(&mut self, config_file: &str, _is_reload: bool) -> PluginResult<()> {
        let raw = std::fs::read_to_string(config_file).map_err(|e| {
            GeyserPluginError::ConfigFileReadError {
                msg: format!("read {}: {}", config_file, e),
            }
        })?;
        let cfg: PluginConfig =
            serde_json::from_str(&raw).map_err(|e| GeyserPluginError::ConfigFileReadError {
                msg: format!("parse config: {}", e),
            })?;

        let program_id =
            Pubkey::from_str(&cfg.pool_program_id).map_err(|e| GeyserPluginError::ConfigFileReadError {
                msg: format!("invalid pool_program_id: {}", e),
            })?;

        let pg_pool = writer::build_pool(&cfg.db_url).map_err(|e| {
            GeyserPluginError::Custom(format!("postgres pool: {}", e).into())
        })?;

        // Ping connection to surface bad creds immediately.
        let mut probe = pg_pool.get().map_err(|e| {
            GeyserPluginError::Custom(format!("postgres ping: {}", e).into())
        })?;
        probe
            .simple_query("SELECT 1")
            .map_err(|e| GeyserPluginError::Custom(format!("postgres select 1: {}", e).into()))?;
        drop(probe);

        self.pool_program_id = Some(program_id);
        self.component_name = cfg.component_name;
        self.writer = Some(spawn(pg_pool).map_err(|e| {
            GeyserPluginError::Custom(format!("spawn writer thread: {}", e).into())
        })?);

        log::info!(
            "qietr-indexer-geyser loaded; program_id={} component={}",
            program_id,
            self.component_name
        );
        Ok(())
    }

    fn on_unload(&mut self) {
        log::info!("qietr-indexer-geyser unloading");
        self.writer = None;
    }

    fn update_account(
        &self,
        account: ReplicaAccountInfoVersions,
        slot: u64,
        _is_startup: bool,
    ) -> PluginResult<()> {
        let writer = match &self.writer {
            Some(w) => w,
            None => return Ok(()),
        };
        let expected_owner = match &self.pool_program_id {
            Some(p) => p,
            None => return Ok(()),
        };

        let (owner, pubkey, data) = match account {
            ReplicaAccountInfoVersions::V0_0_1(_) | ReplicaAccountInfoVersions::V0_0_2(_) => {
                return Ok(())
            }
            ReplicaAccountInfoVersions::V0_0_3(a) => (a.owner, a.pubkey, a.data),
        };

        if owner != expected_owner.as_ref() {
            return Ok(());
        }

        let kind = match AccountKind::from_account_data(data) {
            Some(k) => k,
            None => return Ok(()),
        };

        match kind {
            AccountKind::PoolConfig => {
                // Not indexed; admin/global state only.
            }
            AccountKind::Denomination => {
                if let Some(denom) = decode_denomination(data) {
                    writer.enqueue(WriteEvent::UpsertDenomination {
                        denom_id: denom.denom_id as i16,
                        amount_micro_usdc: denom.amount_micro_usdc as i64,
                        deposit_count: denom.deposit_count as i64,
                        vault_address: Pubkey::new_from_array(denom.vault).to_string(),
                        last_seen_slot: slot as i64,
                    });
                } else {
                    log::warn!(
                        "qietr-indexer: failed to decode Denomination at {:?}",
                        Pubkey::try_from(pubkey).ok()
                    );
                }
            }
            AccountKind::MerkleTree => {
                if let Some(tree) = decode_merkle_tree(data) {
                    // Update leaf-index cache so notify_transaction can attribute
                    // commitments. The first time we see a tree, the cache gains
                    // an entry; we don't backfill earlier deposits — those come
                    // from a separate re-sync workstream.
                    if let Ok(mut cache) = self.leaf_index_cache.write() {
                        cache.insert(tree.denom_id, tree.next_leaf_index);
                    }
                    match tree.latest_root() {
                        Some(root) => writer.enqueue(WriteEvent::UpsertRoot {
                            denom_id: tree.denom_id as i16,
                            leaf_count: tree.next_leaf_index as i64,
                            root_be: root.to_vec(),
                            inserted_slot: slot as i64,
                        }),
                        None => log::warn!(
                            "qietr-indexer: MerkleTree denom {} has root_cursor {} out of range; skipping root",
                            tree.denom_id,
                            tree.root_cursor
                        ),
                    }
                } else {
                    log::warn!("qietr-indexer: failed to decode MerkleTree");
                }
            }
            AccountKind::NullifierRecord => {
                if let Some(n) = decode_nullifier_record(data) {
                    writer.enqueue(WriteEvent::InsertNullifier {
                        denom_id: n.denom_id as i16,
                        nullifier_hash_be: n.nullifier_hash.to_vec(),
                        spent_at_slot: n.spent_at_slot as i64,
                    });
                } else {
                    log::warn!("qietr-indexer: failed to decode NullifierRecord");
                }
            }
        }

        Ok(())
    }

    fn notify_transaction(
        &self,
        transaction: ReplicaTransactionInfoVersions,
        slot: u64,
    ) -> PluginResult<()> {
        let writer = match &self.writer {
            Some(w) => w,
            None => return Ok(()),
        };
        let expected_owner = match &self.pool_program_id {
            Some(p) => p,
            None => return Ok(()),
        };

        let (msg, signature) = match transaction {
            ReplicaTransactionInfoVersions::V0_0_1(_) => return Ok(()),
            ReplicaTransactionInfoVersions::V0_0_2(t) => (t.transaction.message(), t.signature),
        };

        let account_keys = msg.account_keys();
        let instructions = msg.instructions();

        for ix in instructions {
            let prog_idx = ix.program_id_index as usize;
            let prog_key = match account_keys.get(prog_idx) {
                Some(k) => k,
                None => continue,
            };
            if prog_key != expected_owner {
                continue;
            }
            self.handle_pool_ix(writer, &ix.data, slot, signature.to_string());
        }

        Ok(())
    }

    fn update_slot_status(
        &self,
        slot: u64,
        _parent: Option<u64>,
        status: SlotStatus,
    ) -> PluginResult<()> {
        if !matches!(status, SlotStatus::Rooted) {
            return Ok(());
        }
        if let Some(writer) = &self.writer {
            writer.enqueue(WriteEvent::Checkpoint {
                component: self.component_name.clone(),
                last_slot: slot as i64,
                last_signature: None,
            });
        }
        Ok(())
    }

    fn account_data_notifications_enabled(&self) -> bool {
        true
    }

    fn transaction_notifications_enabled(&self) -> bool {
        true
    }
}

impl QietrIndexerPlugin {
    fn handle_pool_ix(
        &self,
        writer: &WriterHandle,
        data: &[u8],
        slot: u64,
        signature: String,
    ) {
        if data.len() < 8 {
            return;
        }
        let disc = &data[..8];

        if disc == self.ix_descriptors.deposit {
            // deposit wire format: discriminator(8) || denom_id(1) || commitment(32)
            if data.len() < 8 + 1 + 32 {
                return;
            }
            let denom_id = data[8];
            let commitment_be = data[9..9 + 32].to_vec();

            // Reserve a leaf_index from the cache. The MerkleTree account
            // update arrives in the same slot's commit phase; we assume
            // monotone increment.
            let leaf_index = if let Ok(mut cache) = self.leaf_index_cache.write() {
                let entry = cache.entry(denom_id).or_insert(0);
                let idx = *entry;
                *entry = entry.saturating_add(1);
                idx
            } else {
                return;
            };

            writer.enqueue(WriteEvent::InsertCommitment {
                denom_id: denom_id as i16,
                leaf_index: leaf_index as i64,
                commitment_be,
                inserted_slot: slot as i64,
            });
            // Also stamp a checkpoint with the signature so a restarted
            // plugin can backfill the gap from the chain.
            writer.enqueue(WriteEvent::Checkpoint {
                component: self.component_name.clone(),
                last_slot: slot as i64,
                last_signature: Some(signature),
            });
        }
        // withdraw is captured via NullifierRecord account-init in update_account;
        // no extra tx-level work needed here.
    }
}

/// Validator entry point. Returns a boxed `GeyserPlugin` trait object.
///
/// # Safety
/// Called by the Solana validator via a C ABI. Must return a valid
/// `*mut dyn GeyserPlugin` allocated with `Box::into_raw`. The validator
/// reclaims it via `Box::from_raw` on shutdown.
#[no_mangle]
#[allow(improper_ctypes_definitions)]
pub unsafe extern "C" fn _create_plugin() -> *mut dyn GeyserPlugin {
    let plugin = QietrIndexerPlugin::default();
    let boxed: Box<dyn GeyserPlugin> = Box::new(plugin);
    Box::into_raw(boxed)
}
