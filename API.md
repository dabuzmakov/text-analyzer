# API Contract

## Общее

- Base URL на фронте: `VITE_API_BASE_URL` или по умолчанию `http://localhost:8000`.
- Backend реализован на FastAPI.
- Доступные endpoint'ы:
  - `PUT /corpus`
  - `POST /analysis/run`
  - `GET /export/csv/{identifier}`
- CORS разрешен только для `https://text-analyzer-frontend-ra8y.onrender.com`.
- `browser_id` обязателен по схеме в JSON-запросах, но backend его не использует в логике.
- Для `PUT /corpus` задано ограничение: максимум `30` документов.

## 1. PUT /corpus

### Назначение

Сохраняет новый корпус документов для последующего анализа.

### Запрос

```json
{
  "browser_id": "string",
  "documents": [
    {
      "id": 1,
      "content": "text content"
    }
  ]
}
```

### Поля запроса

- `browser_id: string`
- `documents: Array<{ id: number, content: string }>`
- Максимальное количество документов: `30`

### Особенности поведения

- Перед сохранением backend полностью очищает старый корпус и кэш.
- Очистка происходит глобально для всего приложения, а не для конкретного `browser_id`.
- Каждый документ сохраняется в файл `{id}.txt`.

### Успешный ответ

Статус: `200 OK`

```json
{
  "status": "success",
  "message": "Saved 1 documents"
}
```

### Ошибки

Статус: `422 Unprocessable Entity`

Причины:

- отсутствует `browser_id`
- отсутствует `documents`
- `documents` содержит более `30` элементов
- неверные типы полей

Типовой ответ FastAPI:

```json
{
  "detail": [
    {
      "loc": ["body", "documents"],
      "msg": "List should have at most 30 items after validation, not 31",
      "type": "too_long"
    }
  ]
}
```

## 2. POST /analysis/run

### Назначение

Запускает частотный анализ сохраненного корпуса.

### Запрос

```json
{
  "browser_id": "string",
  "params": {
    "top_n": 20,
    "min_word_length": 3,
    "order_by": "desc"
  }
}
```

### Поля запроса

- `browser_id: string`
- `params: object`
- ожидаемые поля внутри `params`:
  - `top_n: number`
  - `min_word_length: number`
  - `order_by: "asc" | "desc"`

### Значения по умолчанию

На backend:

- `top_n = 20`
- `min_word_length = 1`
- `order_by = "desc"`

На frontend:

- если `top_n` некорректен, подставляется `20`
- если `min_word_length` некорректен, подставляется `3`

### Особенности поведения

- `params` на backend объявлен как `dict`, поэтому строгой Pydantic-валидации вложенных полей нет.
- Если корпус пустой, анализ не запускается.
- Во время анализа backend:
  - читает все `.txt` файлы из `corpus_data`
  - считает частоты слов по каждому документу
  - сохраняет кэш по каждому документу
  - сохраняет общий кэш корпуса в `total_corpus.json`
- При `order_by = "desc"` возвращаются самые частые слова.
- При `order_by = "asc"` возвращаются самые редкие слова.

### Успешный ответ

Статус: `200 OK`

```json
{
  "status": "success",
  "data": {
    "summary": {
      "documents_count": 3,
      "total_words": 4200,
      "unique_words": 830
    },
    "table": [
      {
        "word": "текст",
        "count": 54
      },
      {
        "word": "данные",
        "count": 43
      }
    ]
  }
}
```

### Поля ответа

- `status: "success"`
- `data.summary.documents_count: number`
- `data.summary.total_words: number`
- `data.summary.unique_words: number`
- `data.table: Array<{ word: string, count: number }>`

### Ошибки

Статус: `400 Bad Request`

```json
{
  "detail": "Corpus is empty"
}
```

Статус: `422 Unprocessable Entity`

Причины:

- отсутствует `browser_id`
- тело запроса не соответствует JSON-схеме верхнего уровня

## 3. GET /export/csv/{identifier}

### Назначение

Экспортирует результаты анализа в CSV.

### Path-параметр

- `identifier: string`

Допустимые значения по смыслу:

- `"corpus"` для общего отчета по корпусу
- строковый `id` документа, например `"1"`, для отчета по конкретному документу

### Запрос

```http
GET /export/csv/corpus
```

Тело запроса отсутствует.

### Успешный ответ

Статус: `200 OK`

Заголовки:

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename={identifier}_analysis.csv`

Пример содержимого:

```csv
Слово,Частота
текст,54
данные,43
анализ,38
```

### Особенности поведения

- CSV формируется из кэша, созданного после анализа.
- Если анализ еще не запускался, файл не будет найден.
- В начало CSV добавляется BOM `\ufeff` для корректного открытия в Excel.

### Ошибки

Статус: `404 Not Found`

```json
{
  "detail": "Analysis result not found"
}
```

## Последовательность использования API

1. Вызвать `PUT /corpus` для сохранения корпуса.
2. Вызвать `POST /analysis/run` для построения статистики и кэша.
3. При необходимости вызвать `GET /export/csv/{identifier}` для скачивания CSV.

## Важные замечания по текущему контракту

- `browser_id` передается клиентом, но не влияет на хранение данных.
- `PUT /corpus` перезаписывает весь корпус приложения.
- `POST /analysis/run` зависит от наличия сохраненного корпуса.
- `GET /export/csv/{identifier}` зависит от уже выполненного анализа.
- Успешные JSON-ответы backend возвращает в формате со `status: "success"`.
- Ошибки backend возвращаются в стандартном формате FastAPI через поле `detail`, а не через поле `message`.
