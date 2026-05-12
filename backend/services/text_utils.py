import re
from functools import lru_cache
from typing import List


TOKEN_RE = re.compile(r"[A-Za-zА-Яа-яЁё]+(?:[-'][A-Za-zА-Яа-яЁё]+)*")
CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")


def normalize_text_unit(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower().replace("ё", "е"))


@lru_cache(maxsize=1)
def get_morph_analyzer():
    try:
        import pymorphy3
    except ImportError:
        return None

    return pymorphy3.MorphAnalyzer(lang="ru")


@lru_cache(maxsize=20000)
def lemmatize_word(value: str) -> str:
    word = normalize_text_unit(value)
    if not word or not CYRILLIC_RE.search(word):
        return word

    morph = get_morph_analyzer()
    if morph is None:
        return word

    return normalize_text_unit(morph.parse(word)[0].normal_form)


def normalize_phrase(value: str, lemmatize: bool = False) -> str:
    words = TOKEN_RE.findall(value)
    if not words:
        return normalize_text_unit(value)
    if lemmatize:
        return " ".join(lemmatize_word(word) for word in words)
    return " ".join(normalize_text_unit(word) for word in words)


def tokenize(text: str, normalize: bool = True, lemmatize: bool = False) -> List[str]:
    words = TOKEN_RE.findall(text)
    if not normalize:
        return words
    if lemmatize:
        return [lemmatize_word(word) for word in words if word.strip()]
    return [normalize_text_unit(word) for word in words if word.strip()]


def count_words(text: str) -> int:
    return len(tokenize(text))
