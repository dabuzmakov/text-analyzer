import io
import json
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from config import CORS_ALLOW_ORIGINS, DATABASE_URL, MAX_DOCUMENTS, SEO_ANALYSIS_TYPE
from database import lifespan, require_pool
from repositories import (
    document_to_dict,
    fetch_documents,
    fetch_selected_documents,
    get_client_id,
    get_latest_result,
    get_saved_seo_or_404,
    get_settings_record,
    invalidate_analysis,
    save_settings_record,
    settings_to_dict,
)
from schemas import (
    AnalysisSettings,
    BulkDocumentItem,
    BulkDocumentsRequest,
    DocumentCreateRequest,
    DocumentPatchRequest,
    LegacyAnalysisRequest,
    LegacyCorpusRequest,
    SeoAnalysisRequest,
    SettingsRequest,
)
from services.export import csv_bytes, csv_response, seo_table_to_csv
from services.seo_analysis import build_seo_result
from services.text_utils import count_words


app = FastAPI(title="Лексема API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def missing_document_ids(requested_ids: List[str], documents: List[Dict[str, Any]]) -> List[str]:
    if not requested_ids:
        return []

    available_ids = {
        str(value)
        for document in documents
        for value in (document.get("id"), document.get("client_document_id"), document.get("database_id"))
        if value is not None
    }
    normalized_requested_ids = list(dict.fromkeys(document_id.strip() for document_id in requested_ids if document_id.strip()))
    return [document_id for document_id in normalized_requested_ids if document_id not in available_ids]


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "lexema-api",
        "db_configured": bool(DATABASE_URL),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/app/state")
async def get_app_state(browser_id: str = Query(..., min_length=1)):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, browser_id)
        settings = settings_to_dict(await get_settings_record(conn, client_id))
        documents = await fetch_documents(conn, client_id)
        seo = await get_latest_result(conn, client_id, SEO_ANALYSIS_TYPE)
        return {
            "status": "success",
            "data": {
                "documents": documents,
                "settings": settings,
                "last_results": {
                    "seo": seo,
                    "compare": None,
                    "spelling": None,
                },
            },
        }


@app.get("/documents")
async def get_documents(browser_id: str = Query(..., min_length=1)):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, browser_id)
        return {"status": "success", "data": await fetch_documents(conn, client_id)}


@app.post("/documents")
async def create_document(request_data: DocumentCreateRequest):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, request_data.browser_id)
        existing_count = await conn.fetchval(
            "SELECT COUNT(*) FROM documents WHERE client_id = $1",
            client_id,
        )
        if int(existing_count) >= MAX_DOCUMENTS:
            raise HTTPException(status_code=400, detail="DOCUMENT_LIMIT_REACHED")

        client_document_id = request_data.client_document_id or str(uuid.uuid4())
        row = await conn.fetchrow(
            """
            INSERT INTO documents (
                client_id,
                client_document_id,
                title,
                content,
                char_count,
                raw_word_count,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, client_document_id, title, content, char_count, raw_word_count, created_at, updated_at
            """,
            client_id,
            client_document_id,
            request_data.title,
            request_data.content,
            len(request_data.content),
            count_words(request_data.content),
        )
        await invalidate_analysis(conn, client_id, "Документы изменены")
        return {"status": "success", "data": document_to_dict(row)}


@app.put("/documents")
async def replace_documents(request_data: BulkDocumentsRequest):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, request_data.browser_id)
        async with conn.transaction():
            await conn.execute("DELETE FROM documents WHERE client_id = $1", client_id)
            for index, document in enumerate(request_data.documents, start=1):
                client_document_id = str(document.client_document_id or document.id or uuid.uuid4())
                title = document.title or f"document_{index}"
                content = document.content
                await conn.execute(
                    """
                    INSERT INTO documents (
                        client_id,
                        client_document_id,
                        title,
                        content,
                        char_count,
                        raw_word_count,
                        updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    """,
                    client_id,
                    client_document_id,
                    title,
                    content,
                    len(content),
                    count_words(content),
                )
            await invalidate_analysis(conn, client_id, "Документы изменены")
            return {"status": "success", "data": await fetch_documents(conn, client_id)}


@app.patch("/documents/{document_id}")
async def update_document(document_id: str, request_data: DocumentPatchRequest):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, request_data.browser_id)
        existing = await conn.fetchrow(
            """
            SELECT id, title, content
            FROM documents
            WHERE client_id = $1 AND (client_document_id = $2 OR id::text = $2)
            """,
            client_id,
            document_id,
        )
        if existing is None:
            raise HTTPException(status_code=404, detail="DOCUMENT_NOT_FOUND")

        title = request_data.title if request_data.title is not None else existing["title"]
        content = request_data.content if request_data.content is not None else existing["content"]
        row = await conn.fetchrow(
            """
            UPDATE documents
            SET title = $3,
                content = $4,
                char_count = $5,
                raw_word_count = $6,
                updated_at = NOW()
            WHERE client_id = $1 AND id = $2
            RETURNING id, client_document_id, title, content, char_count, raw_word_count, created_at, updated_at
            """,
            client_id,
            existing["id"],
            title,
            content,
            len(content),
            count_words(content),
        )
        await invalidate_analysis(conn, client_id, "Документы изменены")
        return {"status": "success", "data": document_to_dict(row)}


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str, browser_id: str = Query(..., min_length=1)):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, browser_id)
        result = await conn.execute(
            """
            DELETE FROM documents
            WHERE client_id = $1 AND (client_document_id = $2 OR id::text = $2)
            """,
            client_id,
            document_id,
        )
        deleted_count = int(result.split()[-1])
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="DOCUMENT_NOT_FOUND")
        await invalidate_analysis(conn, client_id, "Документы изменены")
        return {
            "status": "success",
            "data": {"message": "Document deleted"},
            "message": "Document deleted",
        }


@app.get("/settings")
async def get_settings(browser_id: str = Query(..., min_length=1)):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, browser_id)
        settings = settings_to_dict(await get_settings_record(conn, client_id))
        return {"status": "success", "data": settings}


@app.put("/settings")
async def save_settings(request_data: SettingsRequest):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, request_data.browser_id)
        settings = await save_settings_record(conn, client_id, request_data.settings)
        return {"status": "success", "data": settings}


@app.post("/analysis/seo")
async def run_seo_analysis(request_data: SeoAnalysisRequest):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, request_data.browser_id)
        documents = await fetch_selected_documents(conn, client_id, request_data.document_ids)
        if not documents:
            raise HTTPException(status_code=400, detail="DOCUMENTS_NOT_FOUND")
        missing_ids = missing_document_ids(request_data.document_ids, documents)
        if missing_ids:
            raise HTTPException(
                status_code=400,
                detail={"code": "DOCUMENTS_NOT_FOUND", "missing_document_ids": missing_ids},
            )

        if request_data.params is None:
            settings = AnalysisSettings(**settings_to_dict(await get_settings_record(conn, client_id)))
        else:
            settings = request_data.params

        result = await build_seo_result(conn, documents, settings)
        selected_ids = [document["id"] for document in documents]
        params_snapshot = settings.model_dump()

        await conn.execute(
            """
            INSERT INTO analysis_results (
                client_id,
                analysis_type,
                selected_document_ids,
                params_snapshot,
                result,
                is_actual,
                invalidation_reason,
                updated_at
            )
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, TRUE, NULL, NOW())
            ON CONFLICT (client_id, analysis_type)
            DO UPDATE SET
                selected_document_ids = EXCLUDED.selected_document_ids,
                params_snapshot = EXCLUDED.params_snapshot,
                result = EXCLUDED.result,
                is_actual = TRUE,
                invalidation_reason = NULL,
                updated_at = NOW()
            """,
            client_id,
            SEO_ANALYSIS_TYPE,
            json.dumps(selected_ids, ensure_ascii=False),
            json.dumps(params_snapshot, ensure_ascii=False),
            json.dumps(result, ensure_ascii=False),
        )
        return {
            "status": "success",
            "data": {
                "analysis_type": SEO_ANALYSIS_TYPE,
                "selected_document_ids": selected_ids,
                "params_snapshot": params_snapshot,
                "result": result,
                "is_actual": True,
                "invalidation_reason": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        }


@app.post("/analysis/compare")
async def run_compare_analysis():
    return {
        "status": "not_implemented",
        "message": "Сравнительный анализ пока в разработке",
    }


@app.post("/analysis/spelling")
async def run_spelling_analysis():
    return {
        "status": "not_implemented",
        "message": "Проверка орфографии пока в разработке",
    }


@app.get("/export/csv/seo/{table_type}")
async def export_seo_csv(
    table_type: Literal["words", "ngrams", "keywords", "spam", "water", "mixed"],
    browser_id: str = Query(..., min_length=1),
):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, browser_id)
        result = await get_saved_seo_or_404(conn, client_id)
        headers, rows, filename = seo_table_to_csv(table_type, result)
        return csv_response(headers, rows, filename)


@app.get("/export/zip/seo")
async def export_seo_zip(browser_id: str = Query(..., min_length=1)):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, browser_id)
        result = await get_saved_seo_or_404(conn, client_id)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for table_type in ["words", "ngrams", "keywords", "spam", "water", "mixed"]:
            headers, rows, filename = seo_table_to_csv(table_type, result)
            archive.writestr(filename, csv_bytes(headers, rows))
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="seo_report.zip"'},
    )


@app.put("/corpus")
async def legacy_update_corpus(request_data: LegacyCorpusRequest):
    documents = [
        BulkDocumentItem(
            id=document.id,
            title=f"document_{document.id}",
            content=document.content,
        )
        for document in request_data.documents
    ]
    return await replace_documents(
        BulkDocumentsRequest(browser_id=request_data.browser_id, documents=documents)
    )


@app.post("/analysis/run")
async def legacy_analyze_corpus(request_data: LegacyAnalysisRequest):
    response = await run_seo_analysis(
        SeoAnalysisRequest(browser_id=request_data.browser_id, document_ids=[], params=None)
    )
    result = response["data"]["result"]
    params = request_data.params or {}
    top_n = int(params.get("top_n", 20))
    min_word_length = int(params.get("min_word_length", 1))
    order_by = params.get("order_by", "desc")
    rows = [row for row in result["words"] if row["length"] >= min_word_length]
    rows = sorted(rows, key=lambda item: item["count"], reverse=order_by != "asc")[:top_n]
    return {
        "status": "success",
        "data": {
            "summary": {
                "documents_count": result["summary"]["documents_count"],
                "total_words": result["summary"]["total_words"],
                "unique_words": result["summary"]["unique_words"],
            },
            "table": [{"word": row["word"], "count": row["count"]} for row in rows],
        },
    }


@app.get("/export/csv/{identifier}")
async def legacy_download_csv(
    identifier: str,
    browser_id: str = Query(..., min_length=1),
):
    async with require_pool().acquire() as conn:
        client_id = await get_client_id(conn, browser_id)
        result = await get_saved_seo_or_404(conn, client_id)
        headers, rows, filename = seo_table_to_csv("words", result)
        return csv_response(headers, rows, f"{identifier}_{filename}")
