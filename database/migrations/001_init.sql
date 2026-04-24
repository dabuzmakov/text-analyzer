BEGIN;

CREATE TABLE IF NOT EXISTS app_clients (
    id BIGSERIAL PRIMARY KEY,
    browser_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_clients_browser_id_not_blank CHECK (LENGTH(BTRIM(browser_id)) > 0)
);

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES app_clients(id) ON DELETE CASCADE,
    client_document_id TEXT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT documents_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
    CONSTRAINT documents_content_not_blank CHECK (LENGTH(BTRIM(content)) > 0),
    CONSTRAINT documents_token_count_non_negative CHECK (token_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_client_client_document_id_uniq
    ON documents (client_id, client_document_id)
    WHERE client_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_client_created_at
    ON documents (client_id, created_at DESC);

CREATE OR REPLACE FUNCTION enforce_documents_limit_per_client()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    docs_in_client INTEGER;
BEGIN
    PERFORM 1
    FROM app_clients
    WHERE id = NEW.client_id
    FOR UPDATE;

    SELECT COUNT(*)
    INTO docs_in_client
    FROM documents
    WHERE client_id = NEW.client_id;

    IF docs_in_client >= 30 THEN
        RAISE EXCEPTION
            'Превышен лимит документов для client_id=% (максимум 30).',
            NEW.client_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_limit_per_client_before_insert ON documents;
CREATE TRIGGER trg_documents_limit_per_client_before_insert
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION enforce_documents_limit_per_client();

CREATE OR REPLACE FUNCTION get_client_id_by_browser_id(p_browser_id TEXT)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
    SELECT ac.id
    FROM app_clients ac
    WHERE ac.browser_id = p_browser_id
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_client_documents(p_client_id BIGINT)
RETURNS TABLE (
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
        d.id AS document_id,
        d.client_document_id,
        d.title,
        d.content,
        d.token_count,
        d.created_at
    FROM documents d
    WHERE d.client_id = p_client_id
    ORDER BY d.created_at DESC, d.id DESC;
$$;

CREATE OR REPLACE FUNCTION get_client_documents_by_browser_id(p_browser_id TEXT)
RETURNS TABLE (
    client_id BIGINT,
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
        d.id AS document_id,
        d.client_document_id,
        d.title,
        d.content,
        d.token_count,
        d.created_at
    FROM app_clients ac
    JOIN documents d ON d.client_id = ac.id
    WHERE ac.browser_id = p_browser_id
    ORDER BY d.created_at DESC, d.id DESC;
$$;

COMMIT;
