BEGIN;

CREATE TABLE IF NOT EXISTS app_clients (
    id BIGSERIAL PRIMARY KEY,
    browser_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_clients_browser_id_not_blank CHECK (LENGTH(BTRIM(browser_id)) > 0)
);

CREATE TABLE IF NOT EXISTS corpora (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES app_clients(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    documents_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT corpora_version_positive CHECK (version >= 1),
    CONSTRAINT corpora_documents_count_non_negative CHECK (documents_count >= 0),
    CONSTRAINT corpora_client_version_uniq UNIQUE (client_id, version)
);

CREATE INDEX IF NOT EXISTS idx_corpora_client_created_at
    ON corpora (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    corpus_id BIGINT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
    client_document_id TEXT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT documents_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
    CONSTRAINT documents_content_not_blank CHECK (LENGTH(BTRIM(content)) > 0),
    CONSTRAINT documents_token_count_non_negative CHECK (token_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_corpus_client_document_id_uniq
    ON documents (corpus_id, client_document_id)
    WHERE client_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_corpus_created_at
    ON documents (corpus_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analysis_runs (
    id BIGSERIAL PRIMARY KEY,
    corpus_id BIGINT NOT NULL REFERENCES corpora(id) ON DELETE CASCADE,
    top_n INTEGER NOT NULL,
    min_word_length INTEGER NOT NULL,
    order_by TEXT NOT NULL,
    total_words INTEGER NOT NULL,
    unique_words INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT analysis_runs_top_n_positive CHECK (top_n >= 1),
    CONSTRAINT analysis_runs_min_word_length_positive CHECK (min_word_length >= 1),
    CONSTRAINT analysis_runs_total_words_non_negative CHECK (total_words >= 0),
    CONSTRAINT analysis_runs_unique_words_non_negative CHECK (unique_words >= 0),
    CONSTRAINT analysis_runs_order_by_enum CHECK (order_by IN ('asc', 'desc')),
    CONSTRAINT analysis_runs_cache_key_uniq UNIQUE (corpus_id, top_n, min_word_length, order_by)
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_corpus_created_at
    ON analysis_runs (corpus_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analysis_word_stats (
    analysis_run_id BIGINT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    word TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (analysis_run_id, rank),
    CONSTRAINT analysis_word_stats_rank_positive CHECK (rank >= 1),
    CONSTRAINT analysis_word_stats_word_not_blank CHECK (LENGTH(BTRIM(word)) > 0),
    CONSTRAINT analysis_word_stats_count_positive CHECK (count >= 1),
    CONSTRAINT analysis_word_stats_word_unique_in_run UNIQUE (analysis_run_id, word)
);

CREATE INDEX IF NOT EXISTS idx_analysis_word_stats_run_count_desc
    ON analysis_word_stats (analysis_run_id, count DESC);

CREATE TABLE IF NOT EXISTS document_analysis_word_stats (
    analysis_run_id BIGINT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (analysis_run_id, document_id, word),
    CONSTRAINT document_analysis_word_stats_word_not_blank CHECK (LENGTH(BTRIM(word)) > 0),
    CONSTRAINT document_analysis_word_stats_count_positive CHECK (count >= 1)
);

CREATE INDEX IF NOT EXISTS idx_document_analysis_word_stats_run_doc_count_desc
    ON document_analysis_word_stats (analysis_run_id, document_id, count DESC);

COMMIT;
