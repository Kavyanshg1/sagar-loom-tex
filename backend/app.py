from __future__ import annotations

from io import BytesIO
from datetime import date
from functools import wraps
import os
from pathlib import Path
import sys

from flask import Flask, g, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from db import STORAGE_DIR, init_db
from services import (
    WASTAGE_RATE,
    add_dyeing_record,
    add_direct_processing_record,
    add_processing_record,
    add_yarn_purchase,
    calculate_fabric_balance,
    calculate_black_yarn_balance,
    calculate_white_yarn_balance,
    calculate_yarn_balance,
    clear_all_data,
    create_user,
    delete_dyeing_record,
    delete_direct_processing_record,
    delete_processing_record,
    delete_yarn_purchase,
    get_user_by_id,
    get_user_count,
    get_admin_settings,
    get_filtered_records,
    get_dashboard,
    is_password_set,
    set_initial_stock,
    set_initial_stock_by_type,
    set_password,
    serialize_rows,
    serialize_user,
    update_dyeing_record,
    update_direct_processing_record,
    update_processing_record,
    update_yarn_purchase,
    verify_password,
    authenticate_user,
)


app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
allowed_origins = [
    origin.strip()
    for origin in os.getenv("APP_ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]
CORS(app, origins=allowed_origins or "*")
BASE_DIR = Path(__file__).resolve().parent
RESOURCE_BASE_DIR = Path(getattr(sys, "_MEIPASS", BASE_DIR.parent))
FRONTEND_DIST_DIR = RESOURCE_BASE_DIR / "frontend" / "dist"
LOGO_PATH = BASE_DIR.parent / "frontend" / "src" / "assets" / "logo.png"
UPLOAD_DIR = STORAGE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
init_db()
TOKEN_MAX_AGE_SECONDS = int(os.getenv("AUTH_TOKEN_MAX_AGE_SECONDS", str(60 * 60 * 24 * 7)))
serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="textile-flow-auth")


def error(message: str, status_code: int = 400):
    return jsonify({"error": message}), status_code


def required_fields(payload: dict, fields: list[str]):
    missing = [field for field in fields if payload.get(field) in (None, "")]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None


def create_access_token(user: dict) -> str:
    return serializer.dumps({"user_id": user["id"]})


def read_access_token(token: str) -> dict | None:
    try:
        payload = serializer.loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def get_authorization_token() -> str | None:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header.removeprefix("Bearer ").strip()


def current_user() -> dict | None:
    token = get_authorization_token()
    if not token:
        return None
    payload = read_access_token(token)
    if not payload:
        return None
    user_id = payload.get("user_id")
    if not user_id:
        return None
    return get_user_by_id(int(user_id))


def auth_required(admin_only: bool = False):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = current_user()
            if not user:
                return error("Authentication required.", 401)
            if admin_only and user.get("role") != "admin":
                return error("Admin access required.", 403)
            g.current_user = serialize_user(user)
            return view(*args, **kwargs)

        return wrapped

    return decorator


def format_table_data(columns: list[str], rows: list[dict], keys: list[str]) -> list[list[str]]:
    data = [columns]
    for row in rows:
        data.append([str(row.get(key, "")) for key in keys])
    if len(data) == 1:
        data.append(["No records found for this range."] + [""] * (len(columns) - 1))
    return data


def create_report_table(data: list[list[str]], column_widths: list[float]):
    table = Table(data, colWidths=column_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def draw_pdf_header(canvas, doc):
    canvas.saveState()
    if LOGO_PATH.exists():
        logo_width = 0.7 * inch
        logo_height = 0.7 * inch
        canvas.drawImage(
            str(LOGO_PATH),
            doc.pagesize[0] - doc.rightMargin - logo_width,
            doc.pagesize[1] - 0.85 * inch,
            width=logo_width,
            height=logo_height,
            preserveAspectRatio=True,
            mask="auto",
        )
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawRightString(
        doc.pagesize[0] - doc.rightMargin,
        0.45 * inch,
        f"Page {canvas.getPageNumber()}",
    )
    canvas.restoreState()


@app.get("/health")
def health_check():
    return jsonify({"status": "ok"})


@app.get("/auth/status")
def auth_status():
    return jsonify({"user_count": get_user_count()})


@app.post("/auth/signup")
def signup():
    payload = request.get_json(force=True, silent=True) or {}
    try:
        user = create_user(
            str(payload.get("name", "")),
            str(payload.get("email", "")),
            str(payload.get("password", "")),
        )
    except ValueError as exc:
        return error(str(exc))

    return jsonify({"user": user, "access_token": create_access_token(user)}), 201


@app.post("/auth/login")
def login():
    payload = request.get_json(force=True, silent=True) or {}
    email = str(payload.get("email", ""))
    password = str(payload.get("password", ""))
    user = authenticate_user(email, password)
    if not user:
        return error("Invalid email or password.", 401)
    return jsonify({"user": user, "access_token": create_access_token(user)})


@app.get("/auth/me")
@auth_required()
def me():
    return jsonify({"user": g.current_user})


@app.get("/dashboard")
@auth_required()
def dashboard():
    return jsonify(get_dashboard())


@app.get("/records")
@auth_required()
def records():
    return jsonify(
        {
            "yarn_purchases": serialize_rows(
                "SELECT * FROM yarn_purchases ORDER BY date DESC, id DESC"
            ),
            "processing_records": serialize_rows(
                "SELECT * FROM processing_records ORDER BY date DESC, id DESC"
            ),
            "direct_processing_records": serialize_rows(
                "SELECT * FROM direct_processing_records ORDER BY date DESC, id DESC"
            ),
            "dyeing_records": serialize_rows(
                """
                SELECT id, date, challan_number, fabric_dyed_meters, remarks, balance_meters, created_at
                FROM dyeing_records
                ORDER BY date DESC, id DESC
                """
            ),
            "sagar_receipts": serialize_rows(
                """
                SELECT id, date, challan_number, fabric_type, meters, source_table, source_record_id, created_at
                FROM sagar_receipts
                ORDER BY date DESC, id DESC
                """
            ),
            "dashboard": get_dashboard(),
            "admin": get_admin_settings() if g.current_user["role"] == "admin" else None,
            "current_user": g.current_user,
        }
    )


@app.get("/export-pdf")
@auth_required()
def export_pdf():
    range_type = request.args.get("range_type", "month")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    selected_tab = request.args.get("tab")

    try:
        report_data = get_filtered_records(range_type, start_date, end_date)
    except ValueError as exc:
        return error(str(exc))

    buffer = BytesIO()
    pagesize = landscape(A4)
    left_margin = 0.5 * inch
    right_margin = 0.5 * inch
    top_margin = 1.15 * inch
    bottom_margin = 0.6 * inch
    gutter = 0.3 * inch
    usable_width = pagesize[0] - left_margin - right_margin - gutter
    frame_width = usable_width / 2
    frame_height = pagesize[1] - top_margin - bottom_margin

    doc = BaseDocTemplate(
        buffer,
        pagesize=pagesize,
        leftMargin=left_margin,
        rightMargin=right_margin,
        topMargin=top_margin,
        bottomMargin=bottom_margin,
    )
    doc.addPageTemplates(
        [
            PageTemplate(
                id="two-column-report",
                frames=[
                    Frame(left_margin, bottom_margin, frame_width, frame_height, id="col-1"),
                    Frame(left_margin + frame_width + gutter, bottom_margin, frame_width, frame_height, id="col-2"),
                ],
                onPage=draw_pdf_header,
            )
        ]
    )
    styles = getSampleStyleSheet()
    story = []

    title_style = styles["Title"]
    title_style.fontName = "Helvetica-Bold"
    title_style.fontSize = 18
    title_style.textColor = colors.HexColor("#0f172a")
    title_style.spaceAfter = 6

    subtitle_style = styles["BodyText"]
    subtitle_style.fontName = "Helvetica"
    subtitle_style.fontSize = 9
    subtitle_style.leading = 12
    subtitle_style.textColor = colors.HexColor("#475569")

    section_style = styles["Heading2"]
    section_style.fontName = "Helvetica-Bold"
    section_style.fontSize = 11
    section_style.textColor = colors.HexColor("#0f172a")
    section_style.spaceAfter = 6

    story.append(Paragraph("SAGAR LOOM TEX", title_style))
    story.append(Paragraph("Textile Production Flow Report", styles["Heading3"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Generated on: {date.today().isoformat()}", subtitle_style))
    story.append(Paragraph(f"Range: {report_data['range_label']}", subtitle_style))
    story.append(Spacer(1, 12))

    available_tabs = {
        "Manglam Yarn Purchases",
        "Shubham White Yarn",
        "Shubham Black Yarn",
        "Sai Leela Processors",
        "Sagar Loom Tex Receipts",
    }
    if selected_tab and selected_tab not in available_tabs:
        return error("Invalid tab selection for export.")

    def include_tab(tab_name: str) -> bool:
        return selected_tab in (None, "", tab_name)

    stock_summary_map = {
        "Shubham White Yarn": (
            "Opening Stock",
            f"{get_dashboard()['initial_white_yarn_stock_kg']} kg",
            "Current Stock",
            f"{get_dashboard()['white_yarn_with_shubham_kg']} kg",
        ),
        "Shubham Black Yarn": (
            "Opening Stock",
            f"{get_dashboard()['initial_black_yarn_stock_kg']} kg",
            "Current Stock",
            f"{get_dashboard()['black_yarn_with_shubham_kg']} kg",
        ),
        "Sai Leela Processors": (
            "Opening Stock",
            f"{get_dashboard()['initial_white_fabric_stock_meters']} m",
            "Current Stock",
            f"{get_dashboard()['white_fabric_with_sai_meters']} m",
        ),
    }

    def append_stock_summary(tab_name: str):
        stock_summary = stock_summary_map.get(tab_name)
        if not stock_summary:
            return
        opening_label, opening_value, current_label, current_value = stock_summary
        story.append(Paragraph(f"{opening_label}: {opening_value}", subtitle_style))
        story.append(Paragraph(f"{current_label}: {current_value}", subtitle_style))
        story.append(Spacer(1, 8))

    if include_tab("Manglam Yarn Purchases"):
        story.append(Paragraph("1. Yarn Purchases (Manglam Yarn Agencies)", section_style))
        story.append(
            create_report_table(
                format_table_data(
                    ["Date", "Invoice Number", "Yarn Type", "Yarn Weight (kg)", "Notes"],
                    report_data["yarn_purchases"],
                    ["date", "invoice_number", "yarn_type", "yarn_weight_kg", "notes"],
                ),
                [0.75 * inch, 1.0 * inch, 0.75 * inch, 0.85 * inch, 2.1 * inch],
            )
        )
        story.append(Spacer(1, 12))

    if include_tab("Shubham White Yarn"):
        story.append(Paragraph("2. Shubham White Yarn (To Sai Leela)", section_style))
        append_stock_summary("Shubham White Yarn")
        story.append(
            create_report_table(
                format_table_data(
                    [
                        "Date",
                        "Challan Number",
                        "Yarn Consumed (kg)",
                        "Wastage (kg)",
                        "Net Consumed Yarn (kg)",
                        "Fabric Produced (meters)",
                    ],
                    report_data["processing_records"],
                    [
                        "date",
                        "challan_number",
                        "yarn_consumed_kg",
                        "wastage_kg",
                        "net_consumed_yarn_kg",
                        "fabric_produced_meters",
                    ],
                ),
                [0.65 * inch, 0.9 * inch, 0.8 * inch, 0.7 * inch, 0.95 * inch, 1.0 * inch],
            )
        )
        story.append(Spacer(1, 12))

    if include_tab("Shubham Black Yarn"):
        story.append(Paragraph("3. Shubham Black Yarn (Direct To Sagar Loom Tex)", section_style))
        append_stock_summary("Shubham Black Yarn")
        story.append(
            create_report_table(
                format_table_data(
                    [
                        "Date",
                        "Challan Number",
                        "Yarn Consumed (kg)",
                        "Wastage (kg)",
                        "Net Consumed Yarn (kg)",
                        "Fabric Produced (meters)",
                    ],
                    report_data["direct_processing_records"],
                    [
                        "date",
                        "challan_number",
                        "yarn_consumed_kg",
                        "wastage_kg",
                        "net_consumed_yarn_kg",
                        "fabric_produced_meters",
                    ],
                ),
                [0.65 * inch, 0.9 * inch, 0.8 * inch, 0.7 * inch, 0.95 * inch, 1.0 * inch],
            )
        )
        story.append(Spacer(1, 12))

    if include_tab("Sai Leela Processors"):
        story.append(Paragraph("4. Dyeing Records (Sai Leela Processors)", section_style))
        append_stock_summary("Sai Leela Processors")
        story.append(
            create_report_table(
                format_table_data(
                    ["Date", "Challan Number", "Fabric Dyed (meters)", "Remarks", "Balance (meters)"],
                    report_data["dyeing_records"],
                    ["date", "challan_number", "fabric_dyed_meters", "remarks", "balance_meters"],
                ),
                [0.7 * inch, 0.95 * inch, 0.9 * inch, 1.45 * inch, 0.85 * inch],
            )
        )
        story.append(Spacer(1, 12))

    if include_tab("Sagar Loom Tex Receipts"):
        story.append(Paragraph("5. Fabric Incoming At Sagar Loom Tex", section_style))
        story.append(
            create_report_table(
                format_table_data(
                    ["Date", "Challan Number", "Fabric Type", "Meters"],
                    report_data["sagar_receipts"],
                    ["date", "challan_number", "fabric_type", "meters"],
                ),
                [0.95 * inch, 1.45 * inch, 0.95 * inch, 0.95 * inch],
            )
        )

    doc.build(story)
    buffer.seek(0)

    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"textile-production-report-{(selected_tab or 'all').lower().replace(' ', '-')}-{range_type}.pdf",
    )


@app.post("/yarn-purchases")
@auth_required()
def create_yarn_purchase():
    payload = request.get_json(force=True, silent=True) or {}
    validation_error = required_fields(
        payload, ["date", "invoice_number", "yarn_type", "yarn_weight_kg"]
    )
    if validation_error:
        return error(validation_error)

    record = add_yarn_purchase(payload)
    return jsonify({"record": record, "dashboard": get_dashboard()}), 201


@app.put("/yarn-purchases/<int:record_id>")
@auth_required()
def edit_yarn_purchase(record_id: int):
    payload = request.get_json(force=True, silent=True) or {}
    validation_error = required_fields(
        payload, ["date", "invoice_number", "yarn_type", "yarn_weight_kg"]
    )
    if validation_error:
        return error(validation_error)

    try:
        record = update_yarn_purchase(record_id, payload)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Record not found." else 400
        return error(str(exc), status_code)

    return jsonify({"record": record, "dashboard": get_dashboard()})


@app.delete("/yarn-purchases/<int:record_id>")
@auth_required()
def remove_yarn_purchase(record_id: int):
    try:
        delete_yarn_purchase(record_id)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Record not found." else 400
        return error(str(exc), status_code)

    return jsonify({"success": True, "dashboard": get_dashboard()})


@app.post("/processing-records")
@auth_required()
def create_processing_record():
    payload = request.get_json(force=True, silent=True) or {}
    validation_error = required_fields(
        payload, ["date", "challan_number", "yarn_consumed_kg", "fabric_produced_meters"]
    )
    if validation_error:
        return error(validation_error)

    yarn_consumed = float(payload["yarn_consumed_kg"])
    total_draw = round(yarn_consumed + (yarn_consumed * WASTAGE_RATE), 2)
    if total_draw > calculate_white_yarn_balance():
        return error("White processing entry exceeds available white yarn balance at Shubham Syncotex.")

    record = add_processing_record(payload)
    return jsonify(
        {
            "record": record,
            "dashboard": get_dashboard(),
            "meta": {"wastage_rate": WASTAGE_RATE},
        }
    ), 201


@app.get("/direct-processing-records")
@auth_required()
def direct_processing_records():
    return jsonify(
        {
            "records": serialize_rows(
                "SELECT * FROM direct_processing_records ORDER BY date DESC, id DESC"
            ),
            "dashboard": get_dashboard(),
        }
    )


@app.post("/direct-processing-records")
@auth_required()
def create_direct_processing_record():
    payload = request.get_json(force=True, silent=True) or {}
    validation_error = required_fields(
        payload, ["date", "challan_number", "yarn_consumed_kg", "fabric_produced_meters"]
    )
    if validation_error:
        return error(validation_error)

    yarn_consumed = float(payload["yarn_consumed_kg"])
    total_draw = round(yarn_consumed + (yarn_consumed * WASTAGE_RATE), 2)
    if total_draw > calculate_black_yarn_balance():
        return error("Black processing entry exceeds available black yarn balance at Shubham Syncotex.")

    record = add_direct_processing_record(payload)
    return jsonify(
        {
            "record": record,
            "dashboard": get_dashboard(),
            "meta": {"wastage_rate": WASTAGE_RATE},
        }
    ), 201


@app.put("/processing-records/<int:record_id>")
@auth_required()
def edit_processing_record(record_id: int):
    payload = request.get_json(force=True, silent=True) or {}
    validation_error = required_fields(
        payload, ["date", "challan_number", "yarn_consumed_kg", "fabric_produced_meters"]
    )
    if validation_error:
        return error(validation_error)

    try:
        record = update_processing_record(record_id, payload)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Record not found." else 400
        return error(str(exc), status_code)

    return jsonify(
        {
            "record": record,
            "dashboard": get_dashboard(),
            "meta": {"wastage_rate": WASTAGE_RATE},
        }
    )


@app.delete("/processing-records/<int:record_id>")
@auth_required()
def remove_processing_record(record_id: int):
    try:
        delete_processing_record(record_id)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Record not found." else 400
        return error(str(exc), status_code)

    return jsonify({"success": True, "dashboard": get_dashboard()})


@app.put("/direct-processing-records/<int:record_id>")
@auth_required()
def edit_direct_processing_record(record_id: int):
    payload = request.get_json(force=True, silent=True) or {}
    validation_error = required_fields(
        payload, ["date", "challan_number", "yarn_consumed_kg", "fabric_produced_meters"]
    )
    if validation_error:
        return error(validation_error)

    try:
        record = update_direct_processing_record(record_id, payload)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Record not found." else 400
        return error(str(exc), status_code)

    return jsonify(
        {
            "record": record,
            "dashboard": get_dashboard(),
            "meta": {"wastage_rate": WASTAGE_RATE},
        }
    )


@app.delete("/direct-processing-records/<int:record_id>")
@auth_required()
def remove_direct_processing_record(record_id: int):
    try:
        delete_direct_processing_record(record_id)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Record not found." else 400
        return error(str(exc), status_code)

    return jsonify({"success": True, "dashboard": get_dashboard()})


@app.post("/dyeing-records")
@auth_required()
def create_dyeing_record():
    payload = request.get_json(force=True, silent=True) or {}
    validation_error = required_fields(
        payload, ["date", "challan_number", "fabric_dyed_meters"]
    )
    if validation_error:
        return error(validation_error)

    fabric_dyed = float(payload["fabric_dyed_meters"])
    if fabric_dyed > calculate_fabric_balance():
        return error("Dyeing entry exceeds available fabric balance at Sai Leela Processors.")

    record = add_dyeing_record(payload)
    return jsonify({"record": record, "dashboard": get_dashboard()}), 201


@app.put("/dyeing-records/<int:record_id>")
@auth_required()
def edit_dyeing_record(record_id: int):
    payload = request.get_json(force=True, silent=True) or {}
    validation_error = required_fields(
        payload, ["date", "challan_number", "fabric_dyed_meters"]
    )
    if validation_error:
        return error(validation_error)

    try:
        record = update_dyeing_record(record_id, payload)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Record not found." else 400
        return error(str(exc), status_code)

    return jsonify({"record": record, "dashboard": get_dashboard()})


@app.delete("/dyeing-records/<int:record_id>")
@auth_required()
def remove_dyeing_record(record_id: int):
    try:
        delete_dyeing_record(record_id)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Record not found." else 400
        return error(str(exc), status_code)

    return jsonify({"success": True, "dashboard": get_dashboard()})


@app.post("/upload")
@auth_required()
def upload_document():
    if "file" not in request.files:
        return error("No file uploaded.")

    file = request.files["file"]
    document_type = request.form.get("document_type", "generic")

    if not file.filename:
        return error("Uploaded file has no filename.")

    save_path = UPLOAD_DIR / file.filename
    file.save(save_path)
    try:
        from ai_extraction import process_document_upload

        extraction_result = process_document_upload(save_path, document_type)
    except ModuleNotFoundError:
        extraction_result = {
            "detected_fields": {},
            "confidence": {},
            "ocr_text": "",
            "message": "Review detected values before saving.",
        }

    return jsonify(
        {
            "document_type": document_type,
            "filename": file.filename,
            "detected_fields": extraction_result["detected_fields"],
            "confidence": extraction_result.get("confidence", {}),
            "ocr_text": extraction_result.get("ocr_text", ""),
            "message": extraction_result["message"],
        }
    )


@app.post("/set-password")
@auth_required(admin_only=True)
def update_password():
    payload = request.get_json(force=True, silent=True) or {}
    password = str(payload.get("password", "")).strip()
    if not password:
        return error("Password is required.")

    set_password(password)
    return jsonify(
        {
            "success": True,
            "dashboard": get_dashboard(),
            "admin": get_admin_settings(),
        }
    )


@app.post("/set-initial-stock")
@auth_required(admin_only=True)
def update_initial_stock():
    payload = request.get_json(force=True, silent=True) or {}

    try:
        white_yarn_kg = round(
            float(payload.get("white_yarn_kg", payload.get("yarn_kg", 0))), 2
        )
        black_yarn_kg = round(float(payload.get("black_yarn_kg", 0)), 2)
        white_fabric_meters = round(
            float(payload.get("white_fabric_meters", payload.get("fabric_meters", 0))), 2
        )
    except (TypeError, ValueError):
        return error("Initial stock values must be numeric.")

    if white_yarn_kg < 0 or black_yarn_kg < 0 or white_fabric_meters < 0:
        return error("Initial stock values must be zero or positive.")

    set_initial_stock_by_type(white_yarn_kg, black_yarn_kg, white_fabric_meters)
    return jsonify(
        {
            "success": True,
            "dashboard": get_dashboard(),
            "admin": get_admin_settings(),
        }
    )


@app.post("/clear-all-data")
@auth_required(admin_only=True)
def clear_data():
    payload = request.get_json(force=True, silent=True) or {}
    password = str(payload.get("password", ""))

    if not is_password_set():
        return error("Set an admin password before clearing data.", 400)

    if not password:
        return error("Password is required.", 400)

    if not verify_password(password):
        return error("Incorrect password.", 403)

    clear_all_data()
    return jsonify(
        {
            "success": True,
            "dashboard": get_dashboard(),
            "admin": get_admin_settings(),
        }
    )


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path: str):
    target_path = FRONTEND_DIST_DIR / path
    if path and target_path.exists() and target_path.is_file():
        return send_from_directory(FRONTEND_DIST_DIR, path)
    return send_from_directory(FRONTEND_DIST_DIR, "index.html")


if __name__ == "__main__":
    try:
        from flaskwebgui import FlaskUI

        ui = FlaskUI(
            server="flask",
            app=app,
            port=8000,
            width=1200,
            height=800,
            fullscreen=False,
        )
        ui.run()
    except ModuleNotFoundError:
        app.run(debug=False, port=8000)
