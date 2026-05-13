from contextlib import asynccontextmanager
from typing import Optional

import asyncpg
from fastapi import FastAPI, HTTPException

from config import DATABASE_URL
from constants import DEFAULT_STOP_WORDS, DEFAULT_WATER_MARKERS


pool: Optional[asyncpg.Pool] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    if DATABASE_URL:
        pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
        async with pool.acquire() as conn:
            await ensure_schema(conn)
    yield
    if pool is not None:
        await pool.close()


def require_pool() -> asyncpg.Pool:
    if pool is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    return pool


async def ensure_schema(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_clients (
            id BIGSERIAL PRIMARY KEY,
            browser_id TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT app_clients_browser_id_not_blank
                CHECK (LENGTH(BTRIM(browser_id)) > 0)
        );

        ALTER TABLE app_clients
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        ALTER TABLE app_clients
            ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        CREATE TABLE IF NOT EXISTS documents (
            id BIGSERIAL PRIMARY KEY,
            client_id BIGINT NOT NULL REFERENCES app_clients(id) ON DELETE CASCADE,
            client_document_id TEXT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            char_count INTEGER NOT NULL DEFAULT 0,
            raw_word_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT documents_title_not_blank CHECK (LENGTH(BTRIM(title)) > 0),
            CONSTRAINT documents_content_not_blank CHECK (LENGTH(BTRIM(content)) > 0)
        );

        ALTER TABLE documents
            ADD COLUMN IF NOT EXISTS client_document_id TEXT;
        ALTER TABLE documents
            ADD COLUMN IF NOT EXISTS char_count INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE documents
            ADD COLUMN IF NOT EXISTS raw_word_count INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE documents
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_client_document_id_unique
            ON documents (client_id, client_document_id)
            WHERE client_document_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_documents_client_updated
            ON documents (client_id, updated_at DESC, id DESC);

        CREATE TABLE IF NOT EXISTS analysis_settings (
            id BIGSERIAL PRIMARY KEY,
            client_id BIGINT NOT NULL UNIQUE REFERENCES app_clients(id) ON DELETE CASCADE,
            stop_words_mode TEXT NOT NULL DEFAULT 'default',
            custom_stop_words TEXT[] NOT NULL DEFAULT '{}',
            keywords TEXT[] NOT NULL DEFAULT '{}',
            lemmatization BOOLEAN NOT NULL DEFAULT TRUE,
            ngram_sizes INTEGER[] NOT NULL DEFAULT '{2,3}',
            spam_threshold_percent NUMERIC NOT NULL DEFAULT 3,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS analysis_results (
            id BIGSERIAL PRIMARY KEY,
            client_id BIGINT NOT NULL REFERENCES app_clients(id) ON DELETE CASCADE,
            analysis_type TEXT NOT NULL,
            selected_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            params_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
            result JSONB NOT NULL DEFAULT '{}'::jsonb,
            is_actual BOOLEAN NOT NULL DEFAULT TRUE,
            invalidation_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (client_id, analysis_type)
        );

        CREATE TABLE IF NOT EXISTS default_stop_words (
            id BIGSERIAL PRIMARY KEY,
            word TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS water_markers (
            id BIGSERIAL PRIMARY KEY,
            marker TEXT NOT NULL UNIQUE
        );
        """
    )
    await conn.execute(
        "INSERT INTO default_stop_words (word) SELECT UNNEST($1::text[]) ON CONFLICT DO NOTHING",
        DEFAULT_STOP_WORDS,
    )
    await conn.execute(
        "INSERT INTO water_markers (marker) SELECT UNNEST($1::text[]) ON CONFLICT DO NOTHING",
        DEFAULT_WATER_MARKERS,
    )
