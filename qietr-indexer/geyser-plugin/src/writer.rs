// =============================================================================
// writer.rs — background Postgres writer.
//
// Geyser callbacks run on the validator's banking thread; blocking them on
// network I/O risks slot delays. The plugin therefore pushes typed write
// events onto a `crossbeam-channel::Sender` and a dedicated worker thread
// drains them into Postgres synchronously. The channel is bounded so the
// validator gets back-pressure rather than memory growth if Postgres
// stalls.
// =============================================================================

use crossbeam_channel::{bounded, Receiver, Sender, TrySendError};
use postgres::NoTls;
use r2d2::Pool;
use r2d2_postgres::PostgresConnectionManager;
use std::thread;
use std::time::Duration;

pub type PgPool = Pool<PostgresConnectionManager<NoTls>>;

#[derive(Debug)]
pub enum WriteEvent {
    UpsertDenomination {
        denom_id: i16,
        amount_micro_usdc: i64,
        deposit_count: i64,
        vault_address: String,
        last_seen_slot: i64,
    },
    UpsertRoot {
        denom_id: i16,
        leaf_count: i64,
        root_be: Vec<u8>,
        inserted_slot: i64,
    },
    InsertCommitment {
        denom_id: i16,
        leaf_index: i64,
        commitment_be: Vec<u8>,
        inserted_slot: i64,
    },
    InsertNullifier {
        denom_id: i16,
        nullifier_hash_be: Vec<u8>,
        spent_at_slot: i64,
    },
    Checkpoint {
        component: String,
        last_slot: i64,
        last_signature: Option<String>,
    },
}

/// Capacity is high enough to absorb a few seconds of busy-time without
/// back-pressuring the validator; low enough that Postgres outages don't
/// hide for too long.
const QUEUE_CAPACITY: usize = 16_384;

pub struct WriterHandle {
    pub sender: Sender<WriteEvent>,
    _worker: thread::JoinHandle<()>,
}

pub fn spawn(pool: PgPool) -> std::io::Result<WriterHandle> {
    let (tx, rx) = bounded::<WriteEvent>(QUEUE_CAPACITY);
    // Propagate spawn failure (e.g. resource exhaustion) instead of panicking
    // inside the validator's plugin-load path.
    let worker = thread::Builder::new()
        .name("qietr-indexer-writer".into())
        .spawn(move || run_worker(pool, rx))?;
    Ok(WriterHandle {
        sender: tx,
        _worker: worker,
    })
}

impl WriterHandle {
    /// Non-blocking enqueue. Drops the event with a log line if the queue
    /// is full — better than blocking the validator. Real ops monitor
    /// the `qietr_indexer_dropped_events_total` counter (TODO: wire to
    /// prometheus exporter).
    pub fn enqueue(&self, event: WriteEvent) {
        match self.sender.try_send(event) {
            Ok(()) => {}
            Err(TrySendError::Full(_)) => {
                log::warn!("qietr-indexer: write queue full, dropping event");
            }
            Err(TrySendError::Disconnected(_)) => {
                log::error!("qietr-indexer: writer worker is dead");
            }
        }
    }
}

fn run_worker(pool: PgPool, rx: Receiver<WriteEvent>) {
    log::info!("qietr-indexer writer worker started");
    while let Ok(event) = rx.recv() {
        if let Err(err) = handle_event(&pool, event) {
            log::error!("qietr-indexer write failed: {}", err);
            // Pause briefly to let Postgres recover if this was a transient
            // issue. We don't requeue — at-most-once delivery, indexer
            // resync on restart catches up.
            thread::sleep(Duration::from_millis(250));
        }
    }
    log::info!("qietr-indexer writer worker stopped");
}

fn handle_event(pool: &PgPool, event: WriteEvent) -> Result<(), String> {
    let mut client = pool.get().map_err(|e| format!("pool: {}", e))?;
    match event {
        WriteEvent::UpsertDenomination {
            denom_id,
            amount_micro_usdc,
            deposit_count,
            vault_address,
            last_seen_slot,
        } => {
            client
                .execute(
                    "INSERT INTO denominations
                       (denom_id, amount_micro_usdc, deposit_count, vault_address, last_seen_slot, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())
                     ON CONFLICT (denom_id) DO UPDATE SET
                       amount_micro_usdc = EXCLUDED.amount_micro_usdc,
                       deposit_count     = EXCLUDED.deposit_count,
                       vault_address     = EXCLUDED.vault_address,
                       last_seen_slot    = GREATEST(denominations.last_seen_slot, EXCLUDED.last_seen_slot),
                       updated_at        = NOW()",
                    &[
                        &denom_id,
                        &amount_micro_usdc,
                        &deposit_count,
                        &vault_address,
                        &last_seen_slot,
                    ],
                )
                .map_err(|e| format!("upsert denom: {}", e))?;
        }
        WriteEvent::UpsertRoot {
            denom_id,
            leaf_count,
            root_be,
            inserted_slot,
        } => {
            client
                .execute(
                    "INSERT INTO roots (denom_id, leaf_count, root_be, inserted_slot)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (denom_id, leaf_count) DO UPDATE SET
                       root_be       = EXCLUDED.root_be,
                       inserted_slot = LEAST(roots.inserted_slot, EXCLUDED.inserted_slot)",
                    &[&denom_id, &leaf_count, &root_be, &inserted_slot],
                )
                .map_err(|e| format!("upsert root: {}", e))?;
        }
        WriteEvent::InsertCommitment {
            denom_id,
            leaf_index,
            commitment_be,
            inserted_slot,
        } => {
            // ON CONFLICT DO NOTHING because (denom_id, leaf_index) is the
            // PK: if we see the same deposit twice on a fork-replay, the
            // first write wins.
            client
                .execute(
                    "INSERT INTO commitments (denom_id, leaf_index, commitment_be, inserted_slot)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (denom_id, leaf_index) DO NOTHING",
                    &[&denom_id, &leaf_index, &commitment_be, &inserted_slot],
                )
                .map_err(|e| format!("insert commitment: {}", e))?;
        }
        WriteEvent::InsertNullifier {
            denom_id,
            nullifier_hash_be,
            spent_at_slot,
        } => {
            client
                .execute(
                    "INSERT INTO nullifiers (denom_id, nullifier_hash_be, spent_at_slot)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (denom_id, nullifier_hash_be) DO NOTHING",
                    &[&denom_id, &nullifier_hash_be, &spent_at_slot],
                )
                .map_err(|e| format!("insert nullifier: {}", e))?;
        }
        WriteEvent::Checkpoint {
            component,
            last_slot,
            last_signature,
        } => {
            client
                .execute(
                    "INSERT INTO ingest_progress (component, last_slot, last_signature, updated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (component) DO UPDATE SET
                       last_slot      = GREATEST(ingest_progress.last_slot, EXCLUDED.last_slot),
                       last_signature = EXCLUDED.last_signature,
                       updated_at     = NOW()",
                    &[&component, &last_slot, &last_signature],
                )
                .map_err(|e| format!("checkpoint: {}", e))?;
        }
    }
    Ok(())
}

pub fn build_pool(db_url: &str) -> Result<PgPool, String> {
    let manager = PostgresConnectionManager::new(
        db_url.parse().map_err(|e: postgres::Error| e.to_string())?,
        NoTls,
    );
    Pool::builder()
        .max_size(8)
        .min_idle(Some(1))
        .build(manager)
        .map_err(|e| format!("build pool: {}", e))
}
