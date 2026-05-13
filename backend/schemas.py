from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

from config import MAX_DOCUMENTS


class StopWordsSettings(BaseModel):
    mode: Literal["off", "default", "custom", "default_custom"] = "default"
    custom: List[str] = Field(default_factory=list)


class NgramSettings(BaseModel):
    sizes: List[int] = Field(default_factory=lambda: [2, 3])


class SpamSettings(BaseModel):
    threshold_percent: float = Field(default=3, ge=0)


class AnalysisSettings(BaseModel):
    stop_words: StopWordsSettings = Field(default_factory=StopWordsSettings)
    keywords: List[str] = Field(default_factory=list)
    lemmatization: bool = True
    ngrams: NgramSettings = Field(default_factory=NgramSettings)
    spam: SpamSettings = Field(default_factory=SpamSettings)


class DocumentPayload(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    client_document_id: Optional[str] = None

    @field_validator("title", "content")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class DocumentCreateRequest(DocumentPayload):
    browser_id: str = Field(..., min_length=1)


class DocumentPatchRequest(BaseModel):
    browser_id: str = Field(..., min_length=1)
    title: Optional[str] = Field(default=None, min_length=1)
    content: Optional[str] = Field(default=None, min_length=1)

    @field_validator("title", "content")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class BulkDocumentItem(BaseModel):
    id: Optional[Union[str, int]] = None
    client_document_id: Optional[str] = None
    title: Optional[str] = None
    content: str = Field(..., min_length=1)

    @field_validator("title")
    @classmethod
    def strip_optional_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("content")
    @classmethod
    def strip_required_content(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class BulkDocumentsRequest(BaseModel):
    browser_id: str = Field(..., min_length=1)
    documents: List[BulkDocumentItem] = Field(default_factory=list, max_length=MAX_DOCUMENTS)


class SettingsRequest(BaseModel):
    browser_id: str = Field(..., min_length=1)
    settings: AnalysisSettings


class SeoAnalysisRequest(BaseModel):
    browser_id: str = Field(..., min_length=1)
    document_ids: List[str] = Field(default_factory=list)
    params: Optional[AnalysisSettings] = None


class LegacyDocumentModel(BaseModel):
    id: int
    content: str


class LegacyCorpusRequest(BaseModel):
    browser_id: str
    documents: List[LegacyDocumentModel] = Field(..., max_length=MAX_DOCUMENTS)


class LegacyAnalysisRequest(BaseModel):
    browser_id: str
    params: Dict[str, Any] = Field(default_factory=dict)
