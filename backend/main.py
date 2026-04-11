import os
import re
import csv
import io
import json
from collections import Counter
from typing import List, Literal, Union
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Text Frequency Analysis API")

origins = ["https://text-analyzer-frontend-ra8y.onrender.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CORPUS_DIR = "corpus_data"
CACHE_DIR = "cache_data"

os.makedirs(CORPUS_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)


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
# Вспомогательные функции
# ==========================================

def extract_words_from_text(text: str, min_length: int) -> List[str]:
    text = text.lower()
    text = re.sub(r'[^а-яёa-z\'\s]', ' ', text)
    words = re.findall(r"[а-яёa-z]+(?:'[а-яёa-z]+)*", text)
    return [word for word in words if len(word) >= min_length]


def save_to_cache(name: str, data: Counter):
    cache_path = os.path.join(CACHE_DIR, f"{name}.json")
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(dict(data), f, ensure_ascii=False)


def load_from_cache(name: str) -> Counter:
    cache_path = os.path.join(CACHE_DIR, f"{name}.json")
    if not os.path.exists(cache_path):
        return None
    with open(cache_path, "r", encoding="utf-8") as f:
        return Counter(json.load(f))


# ==========================================
# Маршруты
# ==========================================

@app.put("/corpus")
async def update_corpus(request_data: PutCorpusRequest):
    # Полная очистка перед сохранением нового корпуса
    for folder in [CORPUS_DIR, CACHE_DIR]:
        for f in os.listdir(folder):
            os.remove(os.path.join(folder, f))

    for doc in request_data.documents:
        # Сохраняем файл, используя его ID как имя
        file_path = os.path.join(CORPUS_DIR, f"{doc.id}.txt")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(doc.content)

    return {"status": "success", "message": f"Saved {len(request_data.documents)} documents"}


@app.post("/analysis/run")
async def analyze_corpus(request_data: PostAnalysisRequest):
    params = request_data.params
    min_len = params.get("min_word_length", 1)

    global_word_counter = Counter()
    total_words_count = 0

    # Получаем список всех текстовых файлов (имена это ID)
    file_list = [f for f in os.listdir(CORPUS_DIR) if f.endswith('.txt')]

    if not file_list:
        raise HTTPException(status_code=400, detail="Corpus is empty")

    for filename in sorted(file_list):
        doc_id = filename.replace(".txt", "")

        with open(os.path.join(CORPUS_DIR, filename), "r", encoding="utf-8") as f:
            words = extract_words_from_text(f.read(), min_len)

            file_counter = Counter(words)
            save_to_cache(doc_id, file_counter)  # Кэш по ID

            global_word_counter.update(file_counter)
            total_words_count += len(words)

    # Кэш для общего отчета
    save_to_cache("total_corpus", global_word_counter)

    top_n = params.get("top_n", 20)
    if params.get("order_by") == "asc":
        sorted_words = global_word_counter.most_common()[:-top_n - 1:-1]
    else:
        sorted_words = global_word_counter.most_common(top_n)

    return {
        "status": "success",
        "data": {
            "summary": {
                "documents_count": len(file_list),
                "total_words": total_words_count,
                "unique_words": len(global_word_counter)
            },
            "table": [{"word": w, "count": c} for w, c in sorted_words]
        }
    }


@app.get("/export/csv/{identifier}")
async def download_csv(identifier: str):
    """
    Экспортирует CSV.
    identifier может быть 'corpus' или ID документа (например, '1').
    """
    # Определяем, какой файл кэша искать
    cache_name = "total_corpus" if identifier == "corpus" else identifier

    word_counts = load_from_cache(cache_name)

    if word_counts is None:
        raise HTTPException(status_code=404, detail="Analysis result not found")

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(['Слово', 'Частота'])
    writer.writerows(word_counts.most_common())
    output.seek(0)

    # Имя файла для скачивания у пользователя
    download_name = f"{identifier}_analysis.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={download_name}"}
    )

