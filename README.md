# Лексема

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Render](https://img.shields.io/badge/Render-部署-46E3B7?logo=render)](https://render.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Веб-приложение для частотного анализа текстов с возможностью настраивать параметры анализа и экспортировать результаты в CSV.

Деплой: [https://text-analyzer-frontend-ra8y.onrender.com/](https://text-analyzer-frontend-ra8y.onrender.com/)

## Возможности

- загрузка `.txt` файлов через проводник и drag-and-drop;
- создание и редактирование документов прямо в интерфейсе;
- работа с корпусом до 30 документов;
- частотный анализ слов по всему корпусу;
- фильтрация по:
  - `Top-N`
  - минимальной длине слова
  - порядку сортировки;
- просмотр:
  - общей статистики;
  - таблицы частот;
- экспорт:
  - общего CSV по корпусу;
  - CSV по выбранным документам.

## Архитектура

Проект состоит из трех основных частей:

- `frontend` — клиентское приложение на React + TypeScript;
- `backend` — REST API на FastAPI;
- `database` — схема PostgreSQL и SQL-миграции.

Дополнительно в репозитории есть:

- `scripts/db` — скрипты применения миграций;
- `.github/workflows` — CI и миграции;
- `render.yaml` — конфигурация деплоя на Render.

## Стек

### Frontend

- React 19
- TypeScript
- Vite
- CSS Modules
- lucide-react

### Backend

- Python 3.12
- FastAPI
- Pydantic

### Database / Infra

- PostgreSQL
- GitHub Actions
- Render

## Структура репозитория

```text
text-analyzer/
├─ backend/                  # FastAPI backend
├─ frontend/                 # React/Vite frontend
├─ database/migrations/      # SQL-миграции
├─ scripts/db/               # запуск миграций
├─ .github/workflows/        # CI / DB migration workflows
├─ API.md                    # описание API
├─ render.yaml               # deploy config
└─ README.md
```

## Быстрый старт

### 1. Backend

```bash
cd backend
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

macOS / Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend будет доступен на `http://localhost:8000`.

### 2. Frontend

```bash
cd frontend
npm install
```

Создай `frontend/.env.local`:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8000
```

Запуск:

```bash
npm run dev
```

Frontend будет доступен на `http://127.0.0.1:5173`.

### 3. Миграции базы данных

Если нужно применить SQL-миграции вручную:

```bash
export DATABASE_URL=postgresql://user:password@host:5432/dbname
bash scripts/db/apply-migrations.sh
```

Для Windows удобнее запускать из Git Bash / WSL.

## Переменные окружения

### Frontend

- `VITE_USE_MOCK_API`
  - `true` — использовать mock API;
  - `false` — использовать реальный backend.
- `VITE_API_BASE_URL`
  - базовый URL backend.

### Backend

- `DATABASE_URL`
  - строка подключения к PostgreSQL;
- `CORS_ALLOW_ORIGINS`
  - список разрешенных origin'ов для CORS.

## Команды

### Frontend

```bash
npm run dev
npm run build
npm run preview
```

### Backend

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
python -m compileall main.py
```

## API

Основные endpoint'ы:

- `PUT /corpus`
- `POST /analysis/run`
- `GET /export/csv/{identifier}`

Подробный контракт описан в [API.md](./API.md).

## CI / Deploy

В проекте уже настроены:

- `CI` workflow:
  - проверка SQL-схемы;
  - сборка frontend;
  - smoke-check backend;
- `DB Migrations (Render Only)` workflow для применения миграций;
- `render.yaml` для frontend, backend и PostgreSQL.

## Команда

### Frontend

- Бузмаков Даниил Александрович

### Backend

- Бусыгин Степан Алексеевич

### DevOps / База данных

- Костарев Егор Евгеньевич

### TeamLead / Документация / Аналитика

- Губин Павел Сергеевич

### Тестирование

- Четвертных Лев Константинович
