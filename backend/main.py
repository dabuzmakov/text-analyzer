import os
import re
import csv
import io
import asyncpg
from contextlib import asynccontextmanager
from collections import Counter
from typing import List, Optional, Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()  # загружает переменные из .env

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

# Глобальная переменная для пула соединений БД
pool: Optional[asyncpg.Pool] = None


# ==========================================
# Жизненный цикл приложения (Lifespan)
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    # Создаем пул соединений при старте
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
    yield
    # Закрываем пул при завершении приложения
    if pool is not None:
        await pool.close()


app = FastAPI(title="Text Frequency Analysis API", lifespan=lifespan)

origins = ["https://text-analyzer-frontend-ra8y.onrender.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Модели
# ==========================================

class DocumentModel(BaseModel):
    id: int
    content: str


class PutCorpusRequest(BaseModel):
    browser_id: str
    documents: List[DocumentModel] = Field(..., max_length=30)


class PostAnalysisRequest(BaseModel):
    browser_id: str
    params: dict = Field(default={"top_n": 20, "min_word_length": 1, "order_by": "desc"})


# ==========================================
# Вспомогательные функции (Текст)
# ==========================================

def extract_words_from_text(text: str, min_length: int) -> List[str]:
    text = text.lower()
    text = re.sub(r'[^а-яёa-z\'\s]', ' ', text)
    words = re.findall(r"[а-яёa-z]+(?:'[а-яёa-z]+)*", text)
    return [word for word in words if len(word) >= min_length]


# ==========================================
# Вспомогательные функции (База данных)
# ==========================================

async def get_client_id(browser_id: str) -> int:
    """Получает client_id по browser_id. Если нет — создает нового клиента."""
    # Защита от обращения к неинициализированному пулу
    if pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")

    async with pool.acquire() as conn:
        # Проверяем, существует ли клиент
        client_id = await conn.fetchval(
            "SELECT id FROM app_clients WHERE browser_id = $1", browser_id
        )
        if not client_id:
            # Создаем нового клиента
            client_id = await conn.fetchval(
                "INSERT INTO app_clients (browser_id) VALUES ($1) RETURNING id", browser_id
            )
        return client_id


async def get_all_document_contents(client_id: int) -> List[str]:
    """Получает содержимое всех документов клиента."""
    if pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT content FROM documents WHERE client_id = $1", client_id
        )
        return [row["content"] for row in rows]


async def get_document_content_by_client_doc_id(client_id: int, client_doc_id: str) -> Optional[str]:
    """Получает содержимое одного документа клиента по его ID из фронтенда."""
    if pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")

    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT content FROM documents WHERE client_id = $1 AND client_document_id = $2",
            client_id, client_doc_id
        )


# ==========================================
# Маршруты
# ==========================================

@app.put("/corpus")
async def update_corpus(request_data: PutCorpusRequest):
    client_id = await get_client_id(request_data.browser_id)

    if pool is None:
        raise HTTPException(status_code=503, detail="Database not initialized")

    try:
        # Получаем соединение из пула один раз и открываем транзакцию
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Удаляем все старые документы
                await conn.execute("DELETE FROM documents WHERE client_id = $1", client_id)

                # Вставляем новые
                for doc in request_data.documents:
                    client_document_id = str(doc.id)
                    title = f"document_{doc.id}"
                    await conn.execute(
                        """
                        INSERT INTO documents (client_id, client_document_id, title, content)
                        VALUES ($1, $2, $3, $4)
                        """,
                        client_id, client_document_id, title, doc.content
                    )
    except asyncpg.exceptions.PostgresError as e:
        # Если при вставке сработает триггер или возникнет ошибка,
        # транзакция будет автоматически отменена (ROLLBACK).
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

    return {"status": "success", "message": f"Saved {len(request_data.documents)} documents"}


@app.post("/analysis/run")
async def analyze_corpus(request_data: PostAnalysisRequest):
    client_id = await get_client_id(request_data.browser_id)

    # Извлекаем тексты документов из БД
    documents_contents = await get_all_document_contents(client_id)

    if not documents_contents:
        raise HTTPException(status_code=400, detail="Corpus is empty")

    params = request_data.params
    min_len = params.get("min_word_length", 1)

    global_word_counter = Counter()
    total_words_count = 0

    # Анализ без кэширования: извлекаем слова на лету
    for content in documents_contents:
        words = extract_words_from_text(content, min_len)
        global_word_counter.update(words)
        total_words_count += len(words)

    top_n = params.get("top_n", 20)
    if params.get("order_by") == "asc":
        sorted_words = global_word_counter.most_common()[:-top_n - 1:-1]
    else:
        sorted_words = global_word_counter.most_common(top_n)

    return {
        "status": "success",
        "data": {
            "summary": {
                "documents_count": len(documents_contents),
                "total_words": total_words_count,
                "unique_words": len(global_word_counter)
            },
            "table": [{"word": w, "count": c} for w, c in sorted_words]
        }
    }


@app.get("/export/csv/{identifier}")
async def download_csv(
        identifier: str,
        browser_id: str = Query(..., description="Browser ID пользователя"),
        min_word_length: int = Query(1, ge=1, description="Минимальная длина слова"),
        top_n: Optional[int] = Query(None, ge=1, description="Количество слов (если не указано — все)"),
        order_by: Literal["asc", "desc"] = Query("desc", description="Порядок сортировки")
):
    """
    Экспортирует CSV.
    identifier может быть 'corpus' (для всех документов клиента)
    или ID документа (client_document_id, например, '1').
    """
    client_id = await get_client_id(browser_id)
    global_word_counter = Counter()

    # 1. Получение контента и подсчет слов
    if identifier == "corpus":
        contents = await get_all_document_contents(client_id)
        if not contents:
            raise HTTPException(status_code=404, detail="Corpus is empty or not found")

        for content in contents:
            words = extract_words_from_text(content, min_word_length)
            global_word_counter.update(words)
    else:
        content = await get_document_content_by_client_doc_id(client_id, identifier)
        if not content:
            raise HTTPException(status_code=404, detail="Analysis result not found")

        words = extract_words_from_text(content, min_word_length)
        global_word_counter.update(words)

    # 2. Сортировка данных
    if order_by == "desc":
        sorted_items = sorted(global_word_counter.items(), key=lambda x: x[1], reverse=True)
    else:
        sorted_items = sorted(global_word_counter.items(), key=lambda x: x[1], reverse=False)

    # 3. Применение ограничения top_n
    if top_n is not None:
        sorted_items = sorted_items[:top_n]

    # 4. Формирование CSV
    output = io.StringIO()
    output.write('\ufeff')  # BOM для Excel
    writer = csv.writer(output)
    writer.writerow(['Слово', 'Частота'])
    writer.writerows(sorted_items)
    output.seek(0)

    download_name = f"{identifier}_analysis.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={download_name}"}
    )