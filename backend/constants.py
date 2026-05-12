from pathlib import Path
from typing import List


LEXICON_DIR = Path(__file__).resolve().parent / "lexicons"


def load_lexicon(filename: str) -> List[str]:
    path = LEXICON_DIR / filename
    values: List[str] = []
    seen = set()

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip().lower().replace("ё", "е")
        if not line or line.startswith("#"):
            continue
        if line not in seen:
            values.append(line)
            seen.add(line)

    return values


DEFAULT_STOP_WORDS = load_lexicon("default_stop_words_ru.txt") + load_lexicon("default_stop_words_en.txt")
DEFAULT_WATER_MARKERS = load_lexicon("water_markers_ru.txt")

MIXED_LAYOUT_MAP = str.maketrans(
    {
        "a": "а",
        "c": "с",
        "e": "е",
        "o": "о",
        "p": "р",
        "x": "х",
        "y": "у",
        "k": "к",
        "m": "м",
        "h": "н",
        "t": "т",
        "b": "в",
        "A": "А",
        "C": "С",
        "E": "Е",
        "O": "О",
        "P": "Р",
        "X": "Х",
        "Y": "У",
        "K": "К",
        "M": "М",
        "H": "Н",
        "T": "Т",
        "B": "В",
    }
)
