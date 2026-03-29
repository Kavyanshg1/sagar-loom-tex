from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pdfplumber
import pytesseract
from openai import OpenAI
from pdf2image import convert_from_path
from PIL import Image


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


def empty_detected_fields(document_type: str) -> dict[str, Any]:
    return {field: "" for field in FIELD_MAP.get(document_type, ())}


def empty_confidence(document_type: str) -> dict[str, str]:
    return {field: "low" for field in FIELD_MAP.get(document_type, ())}


def downgrade_confidence(current: str, next_level: str) -> str:
    if CONFIDENCE_ORDER.get(next_level, 0) < CONFIDENCE_ORDER.get(current, 0):
        return next_level
    return current


def render_document_images(file_path: Path) -> list[Image.Image]:
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        return [image.convert("RGB") for image in convert_from_path(file_path, dpi=300)]

    with Image.open(file_path) as image:
        return [image.convert("RGB")]


def deskew_image(gray_image: np.ndarray) -> np.ndarray:
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
    text_parts: list[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            page_text = page_text.strip()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def extract_text_with_ocr(file_path: Path) -> str:
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
        text = extract_text_from_pdf(file_path)

    if not text or len(text.strip()) < 20:
        text = extract_text_with_ocr(file_path)

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

    try:
        ai_payload = extract_fields_with_ai(document_type, raw_text)
        normalized_fields, confidence = normalize_ai_output(document_type, ai_payload, raw_text)

        return {
            "detected_fields": normalized_fields,
            "confidence": confidence,
            "ocr_text": raw_text,
            "message": "Review detected values before saving.",
        }
    except Exception:
        regex_fields = extract_with_regex(raw_text)
        fallback_fields = empty_detected_fields(document_type)
        fallback_fields.update(
            {
                key: value
                for key, value in regex_fields.items()
                if key in fallback_fields
            }
        )
        return {
            "detected_fields": fallback_fields,
            "confidence": {
                field: ("medium" if fallback_fields.get(field) not in ("", None) else "low")
                for field in fallback_fields
            },
            "ocr_text": raw_text,
            "message": "Review detected values before saving.",
        }
