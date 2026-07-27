from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any


FIELD_MAP = {
    "yarn": ("invoice_number", "date", "yarn_weight_kg"),
    "processing": ("challan_number", "date", "yarn_consumed_kg", "fabric_produced_meters"),
    "dyeing": ("challan_number", "date", "fabric_dyed_meters"),
}
ALL_FIELDS = (
    "invoice_number",
    "date",
    "yarn_weight_kg",
    "challan_number",
    "yarn_consumed_kg",
    "fabric_produced_meters",
    "fabric_dyed_meters",
)
NUMERIC_FIELDS = {
    "yarn_weight_kg",
    "yarn_consumed_kg",
    "fabric_produced_meters",
    "fabric_dyed_meters",
}
IDENTIFIER_FIELDS = {"invoice_number", "challan_number"}
CONFIDENCE_ORDER = {"low": 0, "medium": 1, "high": 2}
MONTH_PATTERN = (
    r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
)
DATE_FORMATS = (
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d.%m.%Y",
    "%d-%m-%y",
    "%d/%m/%y",
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d %Y",
    "%B %d %Y",
)
NEGATIVE_NUMBER_CONTEXT = (
    "amount",
    "rate",
    "rs",
    "rupee",
    "invoice value",
    "tax",
    "gst",
    "cgst",
    "sgst",
    "igst",
    "lr",
    "l.r",
    "lorry",
    "transport",
    "freight",
    "vehicle",
    "eway",
    "e-way",
    "phone",
    "mobile",
)
TOTAL_CONTEXT = ("total", "net", "gross", "grand", "summary", "final", "balance")
WEIGHT_CONTEXT = ("kg", "kgs", "kilogram", "weight", "qty", "quantity", "wt")
METER_CONTEXT = ("meter", "meters", "mtr", "mtrs", "metre", "metres", "fabric")


def empty_detected_fields(document_type: str) -> dict[str, Any]:
    return {field: "" for field in FIELD_MAP.get(document_type, ())}


def empty_confidence(document_type: str) -> dict[str, str]:
    return {field: "low" for field in FIELD_MAP.get(document_type, ())}


def downgrade_confidence(current: str, next_level: str) -> str:
    if CONFIDENCE_ORDER.get(next_level, 0) < CONFIDENCE_ORDER.get(current, 0):
        return next_level
    return current


def render_document_images(file_path: Path) -> list[Image.Image]:
    from pdf2image import convert_from_path
    from PIL import Image

    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        return [image.convert("RGB") for image in convert_from_path(file_path, dpi=300)]

    with Image.open(file_path) as image:
        return [image.convert("RGB")]


def deskew_image(gray_image: np.ndarray) -> np.ndarray:
    import cv2

    inverted = cv2.bitwise_not(gray_image)
    coordinates = cv2.findNonZero(inverted)
    if coordinates is None:
        return gray_image

    angle = cv2.minAreaRect(coordinates)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.2:
        return gray_image

    height, width = gray_image.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        gray_image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def preprocess_image(image: Image.Image) -> Image.Image:
    import cv2
    import numpy as np
    from PIL import Image

    rgb_image = np.array(image.convert("RGB"))
    gray_image = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY)
    gray_image = cv2.fastNlMeansDenoising(gray_image, None, 12, 7, 21)
    gray_image = deskew_image(gray_image)
    thresholded = cv2.adaptiveThreshold(
        gray_image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15,
    )
    return Image.fromarray(thresholded)


def extract_text_from_pdf(file_path: Path) -> str:
    import pdfplumber

    text_parts: list[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            page_text = page_text.strip()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def extract_text_with_ocr(file_path: Path) -> str:
    import pytesseract

    extracted_pages: list[str] = []
    for index, image in enumerate(render_document_images(file_path), start=1):
        processed_image = preprocess_image(image)
        page_text = pytesseract.image_to_string(processed_image, config="--oem 3 --psm 6")
        page_text = page_text.strip()
        if page_text:
            extracted_pages.append(f"--- PAGE {index} ---\n{page_text}")
    return "\n\n".join(extracted_pages)


def extract_text(file_path: Path) -> str:
    text = ""
    if file_path.suffix.lower() == ".pdf":
        try:
            text = extract_text_from_pdf(file_path)
        except Exception as pdf_error:
            print("PDF TEXT EXTRACTION FAILED:", pdf_error)

    if not text or len(text.strip()) < 20:
        try:
            text = extract_text_with_ocr(file_path)
        except Exception as ocr_error:
            print("OCR EXTRACTION FAILED:", ocr_error)

    print("EXTRACTED TEXT:", text)
    return text


def build_json_schema() -> dict[str, Any]:
    detected_properties = {
        field: {"type": ["number", "null"]} if field in NUMERIC_FIELDS else {"type": ["string", "null"]}
        for field in ALL_FIELDS
    }

    return {
        "name": "textile_document_extraction",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "detected_fields": {
                    "type": "object",
                    "properties": detected_properties,
                    "required": list(detected_properties.keys()),
                    "additionalProperties": False,
                },
            },
            "required": ["detected_fields"],
            "additionalProperties": False,
        },
    }


def extract_fields_with_ai(document_type: str, ocr_text: str) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        response_format={"type": "json_schema", "json_schema": build_json_schema()},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a highly reliable data extraction system for textile invoices and challans.\n\n"
                    "Extract structured data from the text.\n\n"
                    "Return ONLY JSON.\n\n"
                    "Always extract best possible values.\n\n"
                    "Never return empty unless nothing exists.\n\n"
                    "Recognize patterns like:\n"
                    "* Invoice numbers (INV, Bill No, Invoice No)\n"
                    "* Dates in any format\n"
                    "* Weights in kg\n"
                    "* Fabric in meters\n\n"
                    "Output format:\n\n"
                    "{\n"
                    '"date": "",\n'
                    '"invoice_number": "",\n'
                    '"challan_number": "",\n'
                    '"yarn_weight_kg": null,\n'
                    '"yarn_consumed_kg": null,\n'
                    '"fabric_produced_meters": null,\n'
                    '"fabric_dyed_meters": null\n'
                    "}\n"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Document type: {document_type}\n\n"
                    f"Text:\n{ocr_text}"
                ),
            },
        ],
    )

    content = response.choices[0].message.content or "{}"
    parsed = json.loads(content)
    if "detected_fields" in parsed:
        return parsed
    return {"detected_fields": parsed}


def compact_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def context_has_any(context: str, words: tuple[str, ...]) -> bool:
    for word in words:
        if " " in word or "-" in word:
            if word in context:
                return True
            continue
        if re.search(rf"\b{re.escape(word)}\b", context):
            return True
    return False


def clean_labelled_identifier(value: str) -> str:
    value = re.split(r"(?i)\b(date|dt|dated)\b", value, maxsplit=1)[0]
    value = re.sub(
        r"(?i)\b(invoice|bill|challan|chalan|chl|no|number)\b",
        " ",
        value,
    )
    value = re.sub(r"[^A-Za-z0-9/-]+", " ", value)
    return re.sub(r"\s+", " ", value).strip(" :-/")


def text_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def find_date_candidates(text: str) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    patterns = (
        r"\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b",
        r"\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b",
        rf"\b\d{{1,2}}\s+(?:{MONTH_PATTERN})\s+\d{{2,4}}\b",
        rf"\b(?:{MONTH_PATTERN})\s+\d{{1,2}},?\s+\d{{2,4}}\b",
    )
    for line_index, line in enumerate(text_lines(text)):
        lowered = line.lower()
        for pattern in patterns:
            for match in re.finditer(pattern, line, flags=re.IGNORECASE):
                normalized = normalize_date(match.group(0))
                if not normalized:
                    continue
                score = 20
                if "date" in lowered or "dated" in lowered or "dt" in lowered:
                    score += 16
                if "invoice" in lowered or "challan" in lowered or "bill" in lowered:
                    score += 6
                if "due" in lowered or "valid" in lowered or "eway" in lowered or "e-way" in lowered:
                    score -= 8
                candidates.append(
                    {
                        "value": normalized,
                        "score": score,
                        "line_index": line_index,
                        "raw": match.group(0),
                    }
                )
    return candidates


def find_identifier_candidates(text: str, labels: tuple[str, ...]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    joined_labels = "|".join(labels)
    line_list = text_lines(text)
    for line_index, line in enumerate(line_list):
        lowered = line.lower()
        if not any(label in lowered for label in labels):
            continue

        label_match = re.search(
            rf"(?i)\b(?:{joined_labels})\b\s*(?:no|number|#)?\.?\s*[:\-/]?\s*([A-Za-z0-9][A-Za-z0-9/\- ]{{0,24}})",
            line,
        )
        raw_value = label_match.group(1) if label_match else line
        value = clean_labelled_identifier(raw_value)
        if not value:
            continue

        tokens = [token for token in re.split(r"\s+", value) if re.search(r"[A-Za-z0-9]", token)]
        if tokens:
            value = tokens[0]

        score = 18
        if ":" in line or "no" in lowered or "number" in lowered:
            score += 8
        if len(value) <= 3 and value.isalpha():
            score -= 8
        if re.search(r"\d", value):
            score += 6
        candidates.append({"value": value, "score": score, "line_index": line_index, "raw": line})

    return candidates


def number_context(line_list: list[str], line_index: int, start: int, end: int) -> str:
    before_line = line_list[line_index - 1] if line_index > 0 else ""
    current_line = line_list[line_index]
    after_line = line_list[line_index + 1] if line_index + 1 < len(line_list) else ""
    local = current_line[max(0, start - 55) : min(len(current_line), end + 55)]
    return compact_text(" ".join([before_line, local, after_line])).lower()


def find_numeric_candidates(text: str) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    line_list = text_lines(text)
    number_pattern = r"(?<![A-Za-z0-9])(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?![A-Za-z0-9])"
    date_patterns = (
        r"\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b",
        r"\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b",
    )

    for line_index, line in enumerate(line_list):
        date_spans = [
            date_match.span()
            for pattern in date_patterns
            for date_match in re.finditer(pattern, line)
        ]
        for match in re.finditer(number_pattern, line):
            if any(match.start() >= start and match.end() <= end for start, end in date_spans):
                continue
            value = normalize_number(match.group(1))
            if value is None or value <= 0:
                continue
            local_context = compact_text(
                line[max(0, match.start() - 55) : min(len(line), match.end() + 55)]
            ).lower()
            context = number_context(line_list, line_index, match.start(), match.end())
            candidates.append(
                {
                    "value": value,
                    "context": context,
                    "local_context": local_context,
                    "line": line,
                    "line_index": line_index,
                    "position": match.start(),
                    "has_kg": bool(re.search(r"\b(kgs?|kilograms?)\b", local_context)),
                    "has_meter": bool(re.search(r"\b(m|mtrs?|meters?|metres?)\b", local_context)),
                }
            )
    return candidates


def score_numeric_candidate(candidate: dict[str, Any], field: str, all_values: list[float]) -> float:
    context = candidate["context"]
    local_context = candidate.get("local_context", context)
    value = float(candidate["value"])
    score = 0.0
    is_weight_field = field in ("yarn_weight_kg", "yarn_consumed_kg")
    has_local_weight_context = candidate["has_kg"] or any(word in local_context for word in WEIGHT_CONTEXT)
    has_local_meter_context = candidate["has_meter"] or any(word in local_context for word in METER_CONTEXT)
    has_weight_context = has_local_weight_context or context_has_any(context, WEIGHT_CONTEXT)
    has_meter_context = has_local_meter_context or context_has_any(context, METER_CONTEXT)
    money_words = (
            "rs",
            "rupee",
            "amount",
            "net amount",
            "taxable",
            "invoice value",
            "grand total",
            "gst",
            "cgst",
            "sgst",
            "igst",
            "round off",
            "payable",
    )
    has_money_context = context_has_any(context, money_words)
    has_local_money_context = context_has_any(local_context, money_words)

    if context_has_any(context, NEGATIVE_NUMBER_CONTEXT):
        score -= 35
    if context_has_any(context, TOTAL_CONTEXT):
        score += 18
    if "final" in context or "grand total" in context:
        score += 12

    if is_weight_field:
        if has_weight_context:
            score += 30
        else:
            score -= 28
        if has_meter_context:
            score -= 18
        if has_local_money_context and not has_local_weight_context:
            score -= 90
        if field == "yarn_weight_kg" and context_has_any(context, TOTAL_CONTEXT):
            score += 12
        if field == "yarn_consumed_kg" and context_has_any(
            context,
            ("consume", "consumed", "issue", "issued", "used", "yarn"),
        ):
            score += 14
    else:
        if has_meter_context:
            score += 30
        else:
            score -= 28
        if candidate["has_kg"]:
            score -= 18
        if has_money_context and not has_meter_context:
            score -= 90
        if field == "fabric_produced_meters" and context_has_any(
            context,
            ("produce", "produced", "grey", "fabric", "meter", "mtr"),
        ):
            score += 14
        if field == "fabric_dyed_meters" and context_has_any(
            context,
            ("dyed", "dyeing", "process", "processed", "finish", "fabric"),
        ):
            score += 14

    if all_values:
        largest = max(all_values)
        if (
            field == "yarn_weight_kg"
            and has_local_weight_context
            and abs(value - largest) <= max(1, largest * 0.02)
        ):
            score += 16

    if value < 1:
        score -= 20
    elif value < 10:
        score -= 8

    # Textile quantity fields are normally bigger than invoice numbers, rates, and GST percentages.
    if value >= 50:
        score += 7
    if value >= 100:
        score += 5

    return score


def pick_numeric_field(text: str, field: str) -> tuple[float | None, str]:
    candidates = find_numeric_candidates(text)
    if not candidates:
        return None, "low"

    if field in ("yarn_weight_kg", "yarn_consumed_kg"):
        quantity_candidates = [
            candidate
            for candidate in candidates
            if candidate["has_kg"] or context_has_any(candidate.get("local_context", ""), WEIGHT_CONTEXT)
        ]
        if quantity_candidates:
            candidates = quantity_candidates
    elif field in ("fabric_produced_meters", "fabric_dyed_meters"):
        quantity_candidates = [
            candidate
            for candidate in candidates
            if candidate["has_meter"] or context_has_any(candidate.get("local_context", ""), METER_CONTEXT)
        ]
        if quantity_candidates:
            candidates = quantity_candidates

    values = [float(candidate["value"]) for candidate in candidates]
    scored = [
        (score_numeric_candidate(candidate, field, values), candidate)
        for candidate in candidates
    ]
    scored.sort(key=lambda item: (item[0], item[1]["value"]), reverse=True)
    best_score, best_candidate = scored[0]

    if best_score >= 45:
        confidence = "high"
    elif best_score >= 25:
        confidence = "medium"
    else:
        confidence = "low"

    return round(float(best_candidate["value"]), 2), confidence


def extract_fields_locally(document_type: str, text: str) -> tuple[dict[str, Any], dict[str, str]]:
    fields = empty_detected_fields(document_type)
    confidence = empty_confidence(document_type)

    date_candidates = find_date_candidates(text)
    if date_candidates and "date" in fields:
        best_date = max(date_candidates, key=lambda candidate: candidate["score"])
        fields["date"] = best_date["value"]
        confidence["date"] = "high" if best_date["score"] >= 32 else "medium"

    if "invoice_number" in fields:
        invoice_candidates = find_identifier_candidates(
            text,
            ("invoice", "inv", "bill", "tax invoice", "bill no", "bill number"),
        )
        if invoice_candidates:
            best_invoice = max(invoice_candidates, key=lambda candidate: candidate["score"])
            fields["invoice_number"] = best_invoice["value"]
            confidence["invoice_number"] = "high" if best_invoice["score"] >= 28 else "medium"

    if "challan_number" in fields:
        challan_candidates = find_identifier_candidates(
            text,
            ("challan", "chalan", "chl", "delivery challan", "dc", "d/c"),
        )
        if challan_candidates:
            best_challan = max(challan_candidates, key=lambda candidate: candidate["score"])
            fields["challan_number"] = best_challan["value"]
            confidence["challan_number"] = "high" if best_challan["score"] >= 28 else "medium"

    for field in fields:
        if field not in NUMERIC_FIELDS:
            continue
        numeric_value, numeric_confidence = pick_numeric_field(text, field)
        if numeric_value is not None:
            fields[field] = int(numeric_value) if float(numeric_value).is_integer() else numeric_value
            confidence[field] = numeric_confidence

    return fields, confidence


def normalize_date(raw_value: Any) -> str:
    if raw_value in (None, ""):
        return ""

    value = str(raw_value).strip()
    value = re.sub(r"(?i)(date|dt|dated)[:\s-]*", "", value).strip()
    value = value.replace(",", " ")
    value = re.sub(r"\s+", " ", value)

    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(value, date_format).date().isoformat()
        except ValueError:
            continue

    match = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})", value)
    if match:
        return normalize_date(match.group(1).replace("/", "-"))

    match = re.search(r"(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})", value)
    if match:
        return normalize_date(match.group(1))

    return ""


def normalize_number(raw_value: Any) -> float | None:
    if raw_value in (None, ""):
        return None

    if isinstance(raw_value, (int, float)):
        return round(float(raw_value), 2)

    value = str(raw_value)
    match = re.search(r"[-+]?\d[\d,\s]*(?:\.\d+)?", value)
    if not match:
        return None

    cleaned = match.group(0).replace(",", "").replace(" ", "")
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def normalize_identifier(raw_value: Any) -> str:
    if raw_value in (None, ""):
        return ""

    value = str(raw_value).strip()
    value = re.sub(r"\s+", " ", value)
    return value


def extract_with_regex(text: str) -> dict[str, Any]:
    data: dict[str, Any] = {}

    date_match = re.search(r"\d{2}[/-]\d{2}[/-]\d{2,4}", text)
    if date_match:
        data["date"] = date_match.group()

    invoice_match = re.search(r"(INV[- ]?\d+|Invoice\s*No\.?\s*[:\-]?\s*[A-Za-z0-9/-]+)", text, re.I)
    if invoice_match:
        data["invoice_number"] = invoice_match.group().strip()

    challan_match = re.search(
        r"(Challan\s*No\.?\s*[:\-]?\s*[A-Za-z0-9/-]+|CH[- ]?\d+|BILL[- ]?\d+)",
        text,
        re.I,
    )
    if challan_match:
        data["challan_number"] = challan_match.group().strip()

    kg_matches = re.findall(r"(\d+\.?\d*)\s*kg", text, re.I)
    if kg_matches:
        numeric_weights = [float(value) for value in kg_matches]
        data["yarn_weight_kg"] = max(numeric_weights)
        if len(numeric_weights) > 1:
            data["yarn_consumed_kg"] = numeric_weights[0]

    meter_matches = re.findall(r"(\d+\.?\d*)\s*(?:m|meter|meters)\b", text, re.I)
    if meter_matches:
        numeric_meters = [float(value) for value in meter_matches]
        data["fabric_produced_meters"] = max(numeric_meters)
        data["fabric_dyed_meters"] = numeric_meters[0]

    return data


def extract_weight_candidates(raw_text: str) -> list[float]:
    candidates: list[float] = []
    patterns = (
        r"(\d[\d,]*(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)",
        r"(?:total|net|summary|gross weight|net weight)[:\s-]*?(\d[\d,]*(?:\.\d+)?)",
    )
    for pattern in patterns:
        for match in re.finditer(pattern, raw_text, flags=re.IGNORECASE):
            value = normalize_number(match.group(1))
            if value and value > 0:
                candidates.append(value)
    return sorted(candidates)


def normalize_ai_output(document_type: str, ai_payload: dict[str, Any], raw_text: str) -> tuple[dict[str, Any], dict[str, str]]:
    relevant_fields = FIELD_MAP[document_type]
    detected_fields = ai_payload.get("detected_fields", {}) or {}
    regex_fields = extract_with_regex(raw_text)

    normalized: dict[str, Any] = {}
    confidence: dict[str, str] = {}
    weight_candidates = extract_weight_candidates(raw_text)
    largest_weight = max(weight_candidates) if weight_candidates else None

    for field in relevant_fields:
        current_confidence = "medium"

        raw_value = detected_fields.get(field)
        if raw_value in (None, "") and field in regex_fields:
            raw_value = regex_fields[field]
            current_confidence = "medium"

        if field in NUMERIC_FIELDS:
            numeric_value = normalize_number(raw_value)
            if numeric_value is None or numeric_value <= 0:
                normalized[field] = ""
                confidence[field] = "low"
                continue

            if field == "yarn_weight_kg" and largest_weight:
                if abs(numeric_value - largest_weight) <= max(1.0, largest_weight * 0.03):
                    current_confidence = "high"
                else:
                    current_confidence = downgrade_confidence(current_confidence, "low")

            normalized[field] = int(numeric_value) if float(numeric_value).is_integer() else numeric_value
            confidence[field] = current_confidence
            continue

        if field == "date":
            normalized_date = normalize_date(raw_value)
            if not normalized_date:
                normalized[field] = ""
                confidence[field] = "low"
                continue

            normalized[field] = normalized_date
            confidence[field] = current_confidence
            continue

        identifier = normalize_identifier(raw_value)
        if not identifier or not re.search(r"[A-Za-z0-9]", identifier):
            normalized[field] = ""
            confidence[field] = "low"
            continue

        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9/\- ]*", identifier):
            current_confidence = downgrade_confidence(current_confidence, "low")

        normalized[field] = identifier
        confidence[field] = current_confidence

    return normalized, confidence


def process_document_upload(file_path: Path, document_type: str) -> dict[str, Any]:
    if document_type not in FIELD_MAP:
        return {
            "detected_fields": {},
            "confidence": {},
            "ocr_text": "",
            "message": "Review detected values before saving.",
        }

    try:
        raw_text = extract_text(file_path)
    except Exception:
        return {
            "detected_fields": empty_detected_fields(document_type),
            "confidence": empty_confidence(document_type),
            "ocr_text": "",
            "message": "Review detected values before saving.",
        }

    if not raw_text.strip():
        return {
            "detected_fields": empty_detected_fields(document_type),
            "confidence": empty_confidence(document_type),
            "ocr_text": "",
            "message": "Review detected values before saving.",
        }

    local_fields, local_confidence = extract_fields_locally(document_type, raw_text)

    if os.getenv("USE_OPENAI_EXTRACTION", "").strip().lower() in {"1", "true", "yes"}:
        try:
            ai_payload = extract_fields_with_ai(document_type, raw_text)
            ai_fields, ai_confidence = normalize_ai_output(document_type, ai_payload, raw_text)
            for field in FIELD_MAP[document_type]:
                if ai_fields.get(field) not in ("", None) and (
                    local_fields.get(field) in ("", None)
                    or CONFIDENCE_ORDER.get(ai_confidence.get(field, "low"), 0)
                    > CONFIDENCE_ORDER.get(local_confidence.get(field, "low"), 0)
                ):
                    local_fields[field] = ai_fields[field]
                    local_confidence[field] = ai_confidence.get(field, "medium")
        except Exception as extraction_error:
            print("OPTIONAL AI EXTRACTION FAILED:", extraction_error)

    regex_fields = extract_with_regex(raw_text)
    for field, value in regex_fields.items():
        if field in local_fields and local_fields.get(field) in ("", None):
            normalized_value = normalize_number(value) if field in NUMERIC_FIELDS else value
            local_fields[field] = normalized_value if normalized_value is not None else value
            local_confidence[field] = "medium"

    return {
        "detected_fields": local_fields,
        "confidence": local_confidence,
        "ocr_text": raw_text,
        "message": "Review detected values before saving.",
    }
