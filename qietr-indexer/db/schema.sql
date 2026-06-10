-- =============================================================================
-- qietr-indexer schema.
--
-- STATUS: skeleton. Field types are the target shape but no indexes,
-- constraints, or materialized views are tuned yet. Run via
-- `psql $DATABASE_URL -f db/schema.sql` once Postgres is up.
-- =============================================================================

CREATE TABLE IF NOT EXISTS denominations (
    denom_id            SMALLINT PRIMARY KEY,
    amount_micro_usdc   BIGINT      NOT NULL,
    deposit_count       BIGINT      NOT NULL DEFAULT 0,
    vault_address       TEXT        NOT NULL,
    last_seen_slot      BIGINT      NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commitments (
    denom_id        SMALLINT    NOT NULL REFERENCES denominations (denom_id),
    leaf_index      BIGINT      NOT NULL,
    commitment_be   BYTEA       NOT NULL,
    inserted_slot   BIGINT      NOT NULL,
    inserted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (denom_id, leaf_index)
);

CREATE INDEX IF NOT EXISTS commitments_by_value
    ON commitments (denom_id, commitment_be);

CREATE TABLE IF NOT EXISTS roots (
    denom_id        SMALLINT    NOT NULL REFERENCES denominations (denom_id),
    leaf_count      BIGINT      NOT NULL,
    root_be         BYTEA       NOT NULL,
    inserted_slot   BIGINT      NOT NULL,
    PRIMARY KEY (denom_id, leaf_count)
);

CREATE TABLE IF NOT EXISTS nullifiers (
    denom_id          SMALLINT    NOT NULL REFERENCES denominations (denom_id),
    nullifier_hash_be BYTEA       NOT NULL,
    spent_at_slot     BIGINT      NOT NULL,
    spent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (denom_id, nullifier_hash_be)
);

-- Ingest checkpointing so a restarted Geyser plugin knows where to resume.
CREATE TABLE IF NOT EXISTS ingest_progress (
    component       TEXT        PRIMARY KEY,
    last_slot       BIGINT      NOT NULL,
    last_signature  TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
