#!/usr/bin/env python3
"""Regenerate _data/cv_pdf.json from the current two-column CV PDF.

Requires pypdf: python3 -m pip install pypdf
Run from any directory: python3 bin/extract-cv.py
No PDF content is inferred or updated; only layout and extracted glyphs are normalized.
"""

import hashlib
import json
import re
import unicodedata
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/pdf/resume.pdf"
DESTINATION = ROOT / "_data/cv_pdf.json"
SECTIONS = {
    "EDUCATION": ("education", "Education", "entries"),
    "RESEARCH INTERESTS": ("research-interests", "Research interests", "list"),
    "PUBLICATIONS": ("publications", "Publications", "list"),
    "EXPERIENCE": ("experience", "Experience", "entries"),
    "ACHIEVEMENTS": ("achievements", "Achievements", "entries"),
    "SKILLS": ("skills", "Skills", "list"),
    "PROJECTS": ("projects", "Projects", "paragraph"),
    "EXTRACURRICULAR ACTIVITIES": ("extracurricular", "Extracurricular activities", "entries"),
}


def normalize(text):
    for source, target in {
        "¨a": "ä", "¨u": "ü", "¨O": "Ö", "¸c": "ç",
        "¸s": "ş", "S¸": "Ş", "˜a": "ã", "˙I": "İ",
    }.items():
        text = text.replace(source, target)
    text = unicodedata.normalize("NFKC", text)
    for source, target in {"Github": "GitHub", "Linkedin": "LinkedIn", "Pytorch": "PyTorch", "NAZIR NAYAL": "Nazir Nayal"}.items():
        text = text.replace(source, target)
    return text


def clean(text):
    return re.sub(r"\s+", " ", normalize(text)).strip()


def join_lines(lines):
    result = ""
    for line in lines:
        text = clean(line)
        result = result[:-1] + text if result.endswith("-") else (result + " " + text).strip()
    return result


def parse_list(lines):
    items = []
    for line in lines:
        text = line.strip()
        if text.startswith("•"):
            items.append([text.lstrip("• ")])
        elif text:
            if not items:
                items.append([])
            items[-1].append(text)
    return [join_lines(item) for item in items]


def columns(line):
    values = re.split(r"\s{2,}", normalize(line).strip())
    if len(values) != 2:
        raise ValueError("Expected a title/date or role/location pair: " + line)
    return [clean(value) for value in values]


def parse_entries(lines):
    entries = []
    current = None
    for line in lines:
        if not line.strip():
            continue
        if not line[0].isspace():
            if current is None or "subtitle" in current:
                title, date = columns(line)
                current = {"title": title, "date": date, "bullets": []}
                entries.append(current)
            else:
                current["subtitle"], current["location"] = columns(line)
        elif line.strip().startswith("•"):
            if current is None:
                raise ValueError("Bullet without a preceding CV entry")
            current["bullets"].append(clean(line.strip().lstrip("• ")))
        elif current and current["bullets"]:
            current["bullets"][-1] = join_lines([current["bullets"][-1], line])
        else:
            raise ValueError("Unrecognized CV line: " + line)
    if any("subtitle" not in entry for entry in entries):
        raise ValueError("CV entry is missing its role or qualification")
    return entries


def main():
    reader = PdfReader(SOURCE)
    sections = []
    header = []
    current = None
    for page in reader.pages:
        for line in page.extract_text(extraction_mode="layout").splitlines():
            if not line.strip():
                continue
            heading = line.strip()
            if heading in SECTIONS:
                identifier, title, kind = SECTIONS[heading]
                current = {"id": identifier, "title": title, "kind": kind, "lines": []}
                sections.append(current)
            elif current is not None:
                current["lines"].append(line)
            else:
                header.append(clean(line))
    if len(sections) != len(SECTIONS):
        raise ValueError("CV section headings have changed; review the extractor before regenerating")
    for section in sections:
        lines = section.pop("lines")
        if section["kind"] == "entries":
            section["items"] = parse_entries(lines)
        elif section["kind"] == "list":
            section["items"] = parse_list(lines)
        else:
            section["text"] = join_lines(lines)
    result = {
        "source": "assets/pdf/resume.pdf",
        "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "pages": len(reader.pages),
        "header": header,
        "sections": sections,
    }
    DESTINATION.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print("Generated", DESTINATION.relative_to(ROOT), "from", len(reader.pages), "PDF pages")
    for section in sections:
        print(section["title"] + ":", len(section.get("items", [section.get("text")])))


if __name__ == "__main__":
    main()
