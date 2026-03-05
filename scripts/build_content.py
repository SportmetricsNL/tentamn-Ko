#!/usr/bin/env python3
from __future__ import annotations

import json
import random
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
MATERIALS_DIR = ROOT / "materials"
OUTPUT_FILE = ROOT / "data" / "modules.json"

STOPWORDS = {
    "aan",
    "aangaande",
    "aangezien",
    "achter",
    "af",
    "al",
    "aldus",
    "alhoewel",
    "als",
    "alsof",
    "altijd",
    "andere",
    "ben",
    "bij",
    "bijna",
    "bijvoorbeeld",
    "binnen",
    "blijkbaar",
    "boven",
    "bovendien",
    "daar",
    "daarna",
    "dan",
    "dat",
    "de",
    "deze",
    "die",
    "dit",
    "doen",
    "door",
    "dus",
    "een",
    "eens",
    "en",
    "er",
    "etc",
    "ge",
    "geen",
    "geweest",
    "haar",
    "had",
    "heb",
    "hebben",
    "heeft",
    "hem",
    "het",
    "hier",
    "hoe",
    "hun",
    "ieder",
    "iedere",
    "iemand",
    "iets",
    "ik",
    "in",
    "is",
    "ja",
    "je",
    "jij",
    "jou",
    "jouw",
    "kan",
    "konden",
    "kun",
    "kunnen",
    "later",
    "maar",
    "me",
    "meer",
    "men",
    "met",
    "mij",
    "mijn",
    "moet",
    "moeten",
    "na",
    "naar",
    "naast",
    "nee",
    "niet",
    "nog",
    "nu",
    "of",
    "om",
    "omdat",
    "onder",
    "ons",
    "onze",
    "ook",
    "op",
    "over",
    "pas",
    "reeds",
    "sinds",
    "sommige",
    "soms",
    "te",
    "tegen",
    "toch",
    "toen",
    "tot",
    "tussen",
    "uit",
    "uw",
    "van",
    "veel",
    "voor",
    "vooral",
    "want",
    "waren",
    "was",
    "wat",
    "we",
    "wel",
    "werd",
    "werden",
    "wie",
    "wij",
    "wil",
    "worden",
    "zal",
    "ze",
    "zei",
    "zelf",
    "zich",
    "zij",
    "zijn",
    "zo",
    "zonder",
    "zou",
    "about",
    "after",
    "all",
    "also",
    "and",
    "are",
    "around",
    "because",
    "been",
    "before",
    "between",
    "both",
    "but",
    "can",
    "could",
    "did",
    "does",
    "each",
    "for",
    "from",
    "had",
    "has",
    "have",
    "however",
    "into",
    "its",
    "more",
    "most",
    "not",
    "only",
    "other",
    "our",
    "out",
    "over",
    "should",
    "such",
    "than",
    "that",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "under",
    "used",
    "using",
    "very",
    "was",
    "were",
    "what",
    "when",
    "which",
    "while",
    "who",
    "will",
    "with",
    "within",
    "without",
    "you",
    "your",
}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return slug or "module"


def normalize_text(text: str) -> str:
    text = text.replace("\r", "\n")
    # Remove non-printable control chars that often leak from PDF extraction.
    text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", " ", text)
    text = re.sub(r"(?<=\w)-\n(?=\w)", "", text)
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    rough = re.split(r"(?<=[.!?])\s+", text)
    sentences = []
    for sentence in rough:
        s = sentence.strip()
        if 55 <= len(s) <= 260 and len(s.split()) >= 9:
            if re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ]", s):
                sentences.append(s)
    return sentences


def words_from_text(text: str) -> Iterable[str]:
    return re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\-']{2,}", text.lower())


def extract_keywords(text: str, limit: int = 16) -> list[str]:
    counts: Counter[str] = Counter()
    for word in words_from_text(text):
        cleaned = word.strip("-'")
        if len(cleaned) < 4:
            continue
        if cleaned in STOPWORDS:
            continue
        if cleaned.isnumeric():
            continue
        counts[cleaned] += 1

    ranked = [word for word, _ in counts.most_common(limit * 3)]
    unique = []
    for word in ranked:
        if word not in unique:
            unique.append(word)
        if len(unique) == limit:
            break
    return unique


def best_sentences(sentences: list[str], keywords: list[str], limit: int = 6) -> list[str]:
    if not sentences:
        return []

    keyword_set = set(keywords)

    def score(sentence: str) -> tuple[int, int]:
        tokens = [w.strip("-'") for w in words_from_text(sentence)]
        kw_hits = sum(1 for token in tokens if token in keyword_set)
        return kw_hits, -abs(140 - len(sentence))

    ranked = sorted(sentences, key=score, reverse=True)
    unique = []
    seen = set()
    for sentence in ranked:
        normalized = sentence.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        unique.append(sentence)
        if len(unique) >= limit:
            break
    return unique


def pick_sentence_for_term(term: str, sentences: list[str]) -> str:
    term_l = term.lower()
    for sentence in sentences:
        if term_l in sentence.lower():
            return sentence
    return sentences[0] if sentences else f"{term} is een kernbegrip binnen dit document."


def make_flashcards(keywords: list[str], sentences: list[str], limit: int = 10) -> list[dict]:
    cards = []
    for index, term in enumerate(keywords[:limit], start=1):
        explanation = pick_sentence_for_term(term, sentences)
        cards.append(
            {
                "id": f"card-{index}",
                "term": term,
                "explanation": explanation,
            }
        )
    return cards


def make_quiz(module_id: str, keywords: list[str], sentences: list[str], count: int = 8) -> list[dict]:
    if len(keywords) < 4:
        return []

    rng = random.Random(module_id)
    quiz_items = []
    for index, term in enumerate(keywords[: count + 2], start=1):
        clue = pick_sentence_for_term(term, sentences)
        distractors = [word for word in keywords if word != term]
        if len(distractors) < 3:
            continue
        options = [term] + rng.sample(distractors, 3)
        rng.shuffle(options)

        quiz_items.append(
            {
                "id": f"q-{index}",
                "type": "mcq",
                "question": "Welk begrip past het best bij onderstaande omschrijving?",
                "prompt": clue,
                "options": options,
                "answer": term,
                "explanation": f"Het document koppelt deze omschrijving aan '{term}'.",
            }
        )

        if len(quiz_items) >= count:
            break

    return quiz_items


def fallback_from_filename(name: str) -> tuple[list[str], list[str]]:
    tokens = [
        t.lower()
        for t in re.split(r"[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+", name)
        if len(t) >= 4 and not t.isnumeric()
    ]
    terms = []
    for token in tokens:
        if token not in STOPWORDS and token not in terms:
            terms.append(token)
    if not terms:
        terms = ["kwalitatief", "onderzoek", "tentamen", "analyse"]

    bullets = [
        "Gebruik dit document als primaire bron voor begripsleren.",
        "Koppel de kernbegrippen uit de titel aan definities en voorbeelden.",
        "Verbind deze stof met andere hoorcolleges en werkgroepen.",
    ]
    return terms, bullets


def parse_pdf(path: Path) -> dict:
    reader = PdfReader(str(path))
    page_count = len(reader.pages)

    chunks = []
    for page in reader.pages:
        try:
            chunks.append(page.extract_text() or "")
        except Exception:
            chunks.append("")

    raw = "\n".join(chunks)
    text = normalize_text(raw)
    sentences = split_sentences(text)
    keywords = extract_keywords(text)

    if not keywords:
        keywords, fallback_summary = fallback_from_filename(path.stem)
    else:
        fallback_summary = []

    summary = best_sentences(sentences, keywords, limit=6)
    if not summary:
        summary = fallback_summary or [
            "Gebruik dit document als aanvullende bron voor tentamenvoorbereiding.",
            "Maak actieve koppelingen tussen kernbegrippen, methoden en voorbeelden.",
            "Controleer je begrip met de quizvragen onder dit onderdeel.",
        ]

    flashcards = make_flashcards(keywords, sentences or summary, limit=10)
    quiz = make_quiz(slugify(path.stem), keywords, sentences or summary, count=8)

    if not quiz:
        # Last-resort quiz generation from flashcards.
        quiz = []
        for idx, card in enumerate(flashcards[:4], start=1):
            options = [c["term"] for c in flashcards[:4]]
            quiz.append(
                {
                    "id": f"q-fallback-{idx}",
                    "type": "mcq",
                    "question": "Welk begrip hoort bij deze uitleg?",
                    "prompt": card["explanation"],
                    "options": options,
                    "answer": card["term"],
                    "explanation": f"De uitleg hoort bij '{card['term']}'.",
                }
            )

    return {
        "id": slugify(path.stem),
        "title": path.stem,
        "filename": path.name,
        "filePath": f"materials/{path.name}",
        "fileSizeKB": round(path.stat().st_size / 1024, 1),
        "pageCount": page_count,
        "keywords": keywords[:12],
        "summary": summary[:6],
        "flashcards": flashcards,
        "quiz": quiz,
    }


def main() -> None:
    pdf_files = sorted(MATERIALS_DIR.glob("*.pdf"), key=lambda item: item.name.lower())
    modules = [parse_pdf(path) for path in pdf_files]

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "moduleCount": len(modules),
        "modules": modules,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {OUTPUT_FILE} with {len(modules)} modules")


if __name__ == "__main__":
    main()
