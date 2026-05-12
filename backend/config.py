import os
from typing import List, Optional

from dotenv import load_dotenv


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
MAX_DOCUMENTS = 30
SEO_ANALYSIS_TYPE = "seo"

DEFAULT_CORS_ALLOW_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:5176",
    "https://text-analyzer-frontend-ra8y.onrender.com",
]


def parse_cors_origins(value: Optional[str]) -> List[str]:
    if not value:
        return DEFAULT_CORS_ALLOW_ORIGINS

    origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
    return origins or DEFAULT_CORS_ALLOW_ORIGINS


CORS_ALLOW_ORIGINS = parse_cors_origins(os.getenv("CORS_ALLOW_ORIGINS"))
