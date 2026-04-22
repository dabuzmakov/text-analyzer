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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT corpora_client_uniq UNIQUE (client_id)
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

CREATE OR REPLACE FUNCTION enforce_documents_limit_per_corpus()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    docs_in_corpus INTEGER;
BEGIN
    PERFORM 1
    FROM corpora
    WHERE id = NEW.corpus_id
    FOR UPDATE;

    SELECT COUNT(*)
    INTO docs_in_corpus
    FROM documents
    WHERE corpus_id = NEW.corpus_id;

    IF docs_in_corpus >= 30 THEN
        RAISE EXCEPTION
            'Document limit exceeded for corpus_id=% (max 30).',
            NEW.corpus_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_limit_before_insert ON documents;
CREATE TRIGGER trg_documents_limit_before_insert
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION enforce_documents_limit_per_corpus();

CREATE OR REPLACE FUNCTION get_client_corpus_documents(p_client_id BIGINT)
RETURNS TABLE (
    corpus_id BIGINT,
    document_id BIGINT,
    client_document_id TEXT,
    title TEXT,
    content TEXT,
    token_count INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        c.id AS corpus_id,
        d.id AS document_id,
        d.client_document_id,
        d.title,
        d.content,
        d.token_count,
        d.created_at
    FROM corpora c
    JOIN documents d ON d.corpus_id = c.id
    WHERE c.client_id = p_client_id
    ORDER BY d.created_at DESC, d.id DESC;
$$;

CREATE OR REPLACE FUNCTION get_client_corpus_documents_by_browser_id(p_browser_id TEXT)
RETURNS TABLE (
    client_id BIGINT,
    corpus_id BIGINT,
    document_id BIGINT,
    client_document_id TEXT,
    title TEXT,
    content TEXT,
    token_count INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        ac.id AS client_id,
        c.id AS corpus_id,
        d.id AS document_id,
        d.client_document_id,
        d.title,
        d.content,
        d.token_count,
        d.created_at
    FROM app_clients ac
    JOIN corpora c ON c.client_id = ac.id
    JOIN documents d ON d.corpus_id = c.id
    WHERE ac.browser_id = p_browser_id
    ORDER BY d.created_at DESC, d.id DESC;
$$;

COMMIT;
