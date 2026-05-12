import re
from typing import Any, Dict, List

from services.text_utils import count_words


PREVIEW_LIMIT = 160


def split_paragraphs(text: str) -> List[str]:
    normalized_text = text.replace("\r\n", "\n").replace("\r", "\n")
    return [paragraph.strip() for paragraph in re.split(r"\n+", normalized_text) if paragraph.strip()]


def split_sentences(text: str) -> List[str]:
    sentences = [sentence.strip() for sentence in re.split(r"[.!?;]+", text) if sentence.strip()]
    return [sentence for sentence in sentences if count_words(sentence) > 0]


def make_preview(paragraph: str) -> str:
    return re.sub(r"\s+", " ", paragraph).strip()[:PREVIEW_LIMIT]


def analyze_text_structure(text: str) -> Dict[str, Any]:
    words_count = count_words(text)

    if words_count == 0:
        return {
            "paragraphs_count": 0,
            "sentences_count": 0,
            "words_count": 0,
            "avg_words_per_paragraph": 0,
            "avg_words_per_sentence": 0,
            "paragraphs": [],
        }

    paragraphs = split_paragraphs(text)
    if not paragraphs:
        paragraphs = [text.strip()]

    sentences_count = len(split_sentences(text)) or 1
    paragraphs_count = len(paragraphs)

    paragraph_rows = []
    for index, paragraph in enumerate(paragraphs, start=1):
        paragraph_words_count = count_words(paragraph)
        paragraph_sentences_count = len(split_sentences(paragraph))
        if paragraph_words_count > 0 and paragraph_sentences_count == 0:
            paragraph_sentences_count = 1

        paragraph_rows.append(
            {
                "index": index,
                "words_count": paragraph_words_count,
                "sentences_count": paragraph_sentences_count,
                "percent_of_text": round(paragraph_words_count / words_count * 100, 2),
                "preview": make_preview(paragraph),
            }
        )

    return {
        "paragraphs_count": paragraphs_count,
        "sentences_count": sentences_count,
        "words_count": words_count,
        "avg_words_per_paragraph": round(words_count / paragraphs_count, 2),
        "avg_words_per_sentence": round(words_count / sentences_count, 2),
        "paragraphs": paragraph_rows,
    }


def build_structure_charts(structure: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    paragraph_share = []
    paragraph_words = []
    sentence_words = []

    for paragraph in structure.get("paragraphs", []):
        label = f"Абзац {paragraph['index']}"
        words_count = paragraph["words_count"]
        sentences_count = paragraph["sentences_count"]

        paragraph_share.append({"label": label, "value": paragraph["percent_of_text"]})
        paragraph_words.append({"label": label, "value": words_count})
        sentence_words.append(
            {
                "label": label,
                "value": round(words_count / sentences_count, 2) if sentences_count else 0,
            }
        )

    return {
        "paragraph_share": paragraph_share,
        "paragraph_words": paragraph_words,
        "sentence_words": sentence_words,
    }
