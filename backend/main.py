import os
import re
import csv
import shutil
from collections import Counter
from typing import List, Optional, Literal
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# Инициализация приложения
app = FastAPI(title="Text Frequency Analysis API")

# Директории для хранения данных
CORPUS_DIR = "corpus_data"
EXPORTS_DIR = "exports_data"

# Создаем папки при старте, если их нет
os.makedirs(CORPUS_DIR, exist_ok=True)
os.makedirs(EXPORTS_DIR, exist_ok=True)


# ==========================================
# Pydantic Модели для валидации данных
# ==========================================

class DocumentModel(BaseModel):
    title: str
    content: str


class PutCorpusRequest(BaseModel):
    browser_id: str
    documents: List[DocumentModel] = Field(..., max_length=30, description="Максимум 30 документов")


class AnalysisParamsModel(BaseModel):
    top_n: int = Field(default=20, ge=1)
    min_word_length: int = Field(default=1, ge=1)
    order_by: Literal["asc", "desc"] = "desc"


class PostAnalysisRequest(BaseModel):
    browser_id: str
    params: AnalysisParamsModel


# ==========================================
# Вспомогательные функции
# ==========================================

def clear_directory(directory_path: str):
    """Удаляет все файлы в указанной директории."""
    for filename in os.listdir(directory_path):
        file_path = os.path.join(directory_path, filename)
        if os.path.isfile(file_path):
            os.unlink(file_path)


def extract_words_from_text(text: str, min_length: int) -> List[str]:
    """Применяет регулярные выражения и фильтрует слова по длине."""
    text = text.lower()
    text = re.sub(r'[^а-яёa-z\'\s]', ' ', text)
    words = re.findall(r"[а-яёa-z]+(?:'[а-яёa-z]+)*", text)

    return [word for word in words if len(word) >= min_length]


# ==========================================
# Маршруты (Endpoints)
# ==========================================

@app.put("/api/corpus")
async def update_corpus(request_data: PutCorpusRequest):
    """
    Принимает JSON с документами, очищает старые данные и сохраняет новые тексты.
    """
    # Очищаем старые файлы
    clear_directory(CORPUS_DIR)

    documents_count = len(request_data.documents)

    # Сохраняем новые файлы
    for index, document in enumerate(request_data.documents):
        # Используем индекс для безопасного имени файла
        safe_filename = f"doc_{index:02d}.txt"
        file_path = os.path.join(CORPUS_DIR, safe_filename)

        with open(file_path, "w", encoding="utf-8") as text_file:
            text_file.write(document.content)

    return {
        "status": "success",
        "data": {
            "browser_id": request_data.browser_id,
            "documents_count": documents_count,
            "message": "Corpus updated"
        }
    }


@app.post("/api/analysis/run")
async def analyze_corpus(request_data: PostAnalysisRequest):
    """
    Анализирует сохраненные тексты, формирует общую статистику и генерирует CSV для каждого файла.
    """
    params = request_data.params

    global_word_counter = Counter()
    total_words_count = 0
    documents_count = 0

    # Очищаем папку с предыдущими экспортами
    clear_directory(EXPORTS_DIR)

    csv_download_urls = []

    # Читаем все сохраненные файлы
    for filename in os.listdir(CORPUS_DIR):
        file_path = os.path.join(CORPUS_DIR, filename)

        if not os.path.isfile(file_path):
            continue

        documents_count += 1

        with open(file_path, "r", encoding="utf-8") as text_file:
            content = text_file.read()

        # Извлекаем слова из конкретного документа
        document_words = extract_words_from_text(content, params.min_word_length)
        total_words_count += len(document_words)

        # Обновляем глобальный счетчик
        global_word_counter.update(document_words)

        # Подготавливаем локальный счетчик для записи в индивидуальный CSV
        local_word_counter = Counter(document_words)
        local_most_common = local_word_counter.most_common()

        csv_filename = f"analysis_{filename.replace('.txt', '.csv')}"
        csv_path = os.path.join(EXPORTS_DIR, csv_filename)

        # Записываем CSV
        with open(csv_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['Слово', 'Частота'])
            writer.writerows(local_most_common)

        # Сохраняем ссылку для фронтенда
        csv_download_urls.append(f"/api/export/csv/{csv_filename}")

    # Если файлов не было
    if documents_count == 0:
        raise HTTPException(status_code=400, detail="Corpus is empty. Please upload documents first.")

    # Формируем итоговую таблицу по глобальному счетчику
    if params.order_by == "asc":
        # Для сортировки по возрастанию берем самые редкие
        sorted_words = global_word_counter.most_common()[:-params.top_n - 1:-1]
    else:
        # По умолчанию (desc) берем самые частые
        sorted_words = global_word_counter.most_common(params.top_n)

    result_table = [{"word": word, "count": count} for word, count in sorted_words]

    return {
        "status": "success",
        "data": {
            "applied_filters": {
                "top_n": params.top_n,
                "min_word_length": params.min_word_length,
                "order_by": params.order_by
            },
            "summary": {
                "documents_count": documents_count,
                "total_words": total_words_count,
                "unique_words": len(global_word_counter)
            },
            "table": result_table,
            "csv_downloads": csv_download_urls  # Фронтенд использует этот массив для кнопок скачивания
        }
    }


@app.get("/api/export/csv/{filename}")
async def download_csv(filename: str):
    """
    Отдает сгенерированный CSV файл по запросу фронтенда.
    """
    file_path = os.path.join(EXPORTS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='text/csv'
    )