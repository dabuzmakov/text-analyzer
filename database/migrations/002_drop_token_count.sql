BEGIN;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_token_count_non_negative;

ALTER TABLE documents
  DROP COLUMN IF EXISTS token_count;

DROP FUNCTION IF EXISTS get_client_documents(BIGINT);
CREATE FUNCTION get_client_documents(p_client_id BIGINT)
RETURNS TABLE (
    document_id BIGINT,
    client_document_id TEXT,
    title TEXT,
    content TEXT,
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
        d.created_at
    FROM documents d
    WHERE d.client_id = p_client_id
    ORDER BY d.created_at DESC, d.id DESC;
$$;

DROP FUNCTION IF EXISTS get_client_documents_by_browser_id(TEXT);
CREATE FUNCTION get_client_documents_by_browser_id(p_browser_id TEXT)
RETURNS TABLE (
    client_id BIGINT,
    document_id BIGINT,
    client_document_id TEXT,
    title TEXT,
    content TEXT,
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
        d.created_at
    FROM app_clients ac
    JOIN documents d ON d.client_id = ac.id
    WHERE ac.browser_id = p_browser_id
    ORDER BY d.created_at DESC, d.id DESC;
$$;

COMMIT;
