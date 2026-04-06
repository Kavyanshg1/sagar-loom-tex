from __future__ import annotations

import hashlib
import hmac
from datetime import date, timedelta
from typing import Any

from db import get_connection
from werkzeug.security import check_password_hash, generate_password_hash


WASTAGE_RATE = 0.04
PROCESSING_TABLES = ("processing_records", "direct_processing_records")
PASSWORD_KEY = "password_hash"
INITIAL_WHITE_YARN_KEY = "initial_white_yarn"
INITIAL_BLACK_YARN_KEY = "initial_black_yarn"
INITIAL_WHITE_FABRIC_KEY = "initial_white_fabric"
LEGACY_INITIAL_YARN_KEY = "initial_yarn"
LEGACY_INITIAL_FABRIC_KEY = "initial_fabric"
ADMIN_ROLE = "admin"
USER_ROLE = "user"
WHITE_YARN = "white"
BLACK_YARN = "black"
YARN_TYPES = (WHITE_YARN, BLACK_YARN)


def serialize_rows(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def build_date_filters(
    range_type: str, start_date: str | None = None, end_date: str | None = None
) -> tuple[str, tuple[Any, ...], str]:
    today = date.today()

    if range_type == "lifetime":
        return "", (), "Lifetime"
    if range_type == "week":
        start = today - timedelta(days=6)
        return " WHERE date BETWEEN ? AND ?", (str(start), str(today)), "Past Week"
    if range_type == "month":
        start = today - timedelta(days=29)
        return " WHERE date BETWEEN ? AND ?", (str(start), str(today)), "Past Month"
    if range_type == "year":
        start = today - timedelta(days=364)
        return " WHERE date BETWEEN ? AND ?", (str(start), str(today)), "Past Year"
    if range_type == "custom":
        if not start_date or not end_date:
            raise ValueError("Custom range requires start_date and end_date.")
        parsed_start = date.fromisoformat(start_date)
        parsed_end = date.fromisoformat(end_date)
        if parsed_start > parsed_end:
            raise ValueError("start_date cannot be later than end_date.")
        return (
            " WHERE date BETWEEN ? AND ?",
            (str(parsed_start), str(parsed_end)),
            f"{parsed_start.isoformat()} to {parsed_end.isoformat()}",
        )

    raise ValueError("range_type must be one of: week, month, year, lifetime, custom.")


def get_filtered_records(
    range_type: str, start_date: str | None = None, end_date: str | None = None
) -> dict[str, Any]:
    where_clause, params, range_label = build_date_filters(range_type, start_date, end_date)

    yarn_purchases = serialize_rows(
        f"""
        SELECT date, invoice_number, yarn_type, yarn_weight_kg, notes
        FROM yarn_purchases{where_clause}
        ORDER BY date ASC, id ASC
        """,
        params,
    )
    processing_records = serialize_rows(
        f"""
        SELECT
            date,
            challan_number,
            yarn_consumed_kg,
            wastage_kg,
            (yarn_consumed_kg + wastage_kg) AS net_consumed_yarn_kg,
            fabric_produced_meters
        FROM processing_records{where_clause}
        ORDER BY date ASC, id ASC
        """,
        params,
    )
    dyeing_records = serialize_rows(
        f"""
        SELECT date, challan_number, fabric_dyed_meters, remarks, balance_meters
        FROM dyeing_records{where_clause}
        ORDER BY date ASC, id ASC
        """,
        params,
    )
    direct_processing_records = serialize_rows(
        f"""
        SELECT
            date,
            challan_number,
            yarn_consumed_kg,
            wastage_kg,
            (yarn_consumed_kg + wastage_kg) AS net_consumed_yarn_kg,
            fabric_produced_meters
        FROM direct_processing_records{where_clause}
        ORDER BY date ASC, id ASC
        """,
        params,
    )
    sagar_receipts = serialize_rows(
        f"""
        SELECT date, challan_number, fabric_type, meters
        FROM sagar_receipts{where_clause}
        ORDER BY date ASC, id ASC
        """,
        params,
    )

    return {
        "range_label": range_label,
        "yarn_purchases": yarn_purchases,
        "processing_records": processing_records,
        "dyeing_records": dyeing_records,
        "direct_processing_records": direct_processing_records,
        "sagar_receipts": sagar_receipts,
    }


def fetch_scalar(query: str, params: tuple[Any, ...] = ()) -> float:
    with get_connection() as connection:
        row = connection.execute(query, params).fetchone()
    value = row[0] if row and row[0] is not None else 0
    return round(float(value), 2)


def fetch_record_by_id(table_name: str, record_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            f"SELECT * FROM {table_name} WHERE id = ?", (record_id,)
        ).fetchone()
    return dict(row) if row else None


def fetch_config_value(connection, key: str, default: str = "") -> str:
    row = connection.execute(
        "SELECT value FROM app_config WHERE key = ?",
        (key,),
    ).fetchone()
    if not row or row["value"] is None:
        return default
    return str(row["value"])


def fetch_config_number(connection, key: str) -> float:
    raw_value = fetch_config_value(connection, key, "0")
    try:
        return round(float(raw_value), 2)
    except ValueError:
        return 0.0


def parse_config_number(raw_value: str | None, default: float = 0.0) -> float:
    try:
        return round(float(raw_value), 2)
    except (TypeError, ValueError):
        return default


def resolve_stock_value(connection, primary_key: str, fallback_key: str | None = None) -> float:
    primary_value = fetch_config_value(connection, primary_key, "")
    if primary_value != "":
        return parse_config_number(primary_value)
    if fallback_key:
        return parse_config_number(fetch_config_value(connection, fallback_key, "0"))
    return 0.0


def normalize_yarn_type(raw_value: str | None) -> str:
    yarn_type = str(raw_value or WHITE_YARN).strip().lower()
    if yarn_type not in YARN_TYPES:
        raise ValueError("yarn_type must be either 'white' or 'black'.")
    return yarn_type


def upsert_config_value(connection, key: str, value: str) -> None:
    connection.execute(
        """
        INSERT INTO app_config (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key, value),
    )


def get_initial_stock() -> dict[str, float]:
    with get_connection() as connection:
        white_yarn = resolve_stock_value(connection, INITIAL_WHITE_YARN_KEY, LEGACY_INITIAL_YARN_KEY)
        black_yarn = resolve_stock_value(connection, INITIAL_BLACK_YARN_KEY)
        white_fabric = resolve_stock_value(
            connection, INITIAL_WHITE_FABRIC_KEY, LEGACY_INITIAL_FABRIC_KEY
        )

    return {
        "white_yarn_kg": white_yarn,
        "black_yarn_kg": black_yarn,
        "white_fabric_meters": white_fabric,
    }


def is_password_set() -> bool:
    with get_connection() as connection:
        return bool(fetch_config_value(connection, PASSWORD_KEY))


def get_admin_settings() -> dict[str, Any]:
    initial_stock = get_initial_stock()
    return {
        "initial_white_yarn_stock_kg": initial_stock["white_yarn_kg"],
        "initial_black_yarn_stock_kg": initial_stock["black_yarn_kg"],
        "initial_white_fabric_stock_meters": initial_stock["white_fabric_meters"],
        "password_set": is_password_set(),
    }


def normalize_email(email: str) -> str:
    return email.strip().lower()


def serialize_user(row: Any) -> dict[str, Any]:
    user = dict(row)
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "created_at": user["created_at"],
    }


def get_user_count() -> int:
    with get_connection() as connection:
        row = connection.execute("SELECT COUNT(*) FROM users").fetchone()
    return int(row[0] or 0)


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (normalize_email(email),),
        ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def create_user(name: str, email: str, password: str) -> dict[str, Any]:
    clean_name = name.strip()
    clean_email = normalize_email(email)
    if not clean_name:
        raise ValueError("Name is required.")
    if not clean_email or "@" not in clean_email:
        raise ValueError("A valid email address is required.")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if get_user_by_email(clean_email):
        raise ValueError("An account already exists for that email.")

    role = ADMIN_ROLE if get_user_count() == 0 else USER_ROLE

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
            """,
            (clean_name, clean_email, generate_password_hash(password), role),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()

    return serialize_user(row)


def authenticate_user(email: str, password: str) -> dict[str, Any] | None:
    user = get_user_by_email(email)
    if not user:
        return None
    if not check_password_hash(user["password_hash"], password):
        return None
    return serialize_user(user)


def hash_admin_password(password: str) -> str:
    return generate_password_hash(password)


def set_password(password: str) -> None:
    with get_connection() as connection:
        upsert_config_value(connection, PASSWORD_KEY, hash_admin_password(password))
        connection.commit()


def verify_password(input_password: str) -> bool:
    with get_connection() as connection:
        stored_hash = fetch_config_value(connection, PASSWORD_KEY)
    if not stored_hash:
        return False
    if stored_hash.startswith("scrypt:") or stored_hash.startswith("pbkdf2:"):
        return check_password_hash(stored_hash, input_password)
    legacy_hash = hashlib.sha256(input_password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(stored_hash, legacy_hash)


def fetch_total_yarn_purchased(connection, yarn_type: str | None = None) -> float:
    if yarn_type:
        row = connection.execute(
            "SELECT COALESCE(SUM(yarn_weight_kg), 0) FROM yarn_purchases WHERE yarn_type = ?",
            (yarn_type,),
        ).fetchone()
    else:
        row = connection.execute(
            "SELECT COALESCE(SUM(yarn_weight_kg), 0) FROM yarn_purchases"
        ).fetchone()
    return round(float(row[0] or 0), 2)


def fetch_total_yarn_draw(connection, yarn_type: str | None = None) -> float:
    if yarn_type == WHITE_YARN:
        row = connection.execute(
            "SELECT COALESCE(SUM(yarn_consumed_kg + wastage_kg), 0) FROM processing_records"
        ).fetchone()
    elif yarn_type == BLACK_YARN:
        row = connection.execute(
            "SELECT COALESCE(SUM(yarn_consumed_kg + wastage_kg), 0) FROM direct_processing_records"
        ).fetchone()
    else:
        row = connection.execute(
            """
            SELECT
                COALESCE((SELECT SUM(yarn_consumed_kg + wastage_kg) FROM processing_records), 0)
                +
                COALESCE((SELECT SUM(yarn_consumed_kg + wastage_kg) FROM direct_processing_records), 0)
            """
        ).fetchone()
    return round(float(row[0] or 0), 2)


def fetch_total_processing_fabric(connection, table_name: str = "processing_records") -> float:
    row = connection.execute(
        f"SELECT COALESCE(SUM(fabric_produced_meters), 0) FROM {table_name}"
    ).fetchone()
    return round(float(row[0] or 0), 2)


def fetch_total_direct_fabric(connection) -> float:
    return fetch_total_processing_fabric(connection, "direct_processing_records")


def fetch_total_fabric_dyed(connection) -> float:
    row = connection.execute(
        "SELECT COALESCE(SUM(fabric_dyed_meters), 0) FROM dyeing_records"
    ).fetchone()
    return round(float(row[0] or 0), 2)


def calculate_total_yarn_purchased() -> float:
    return fetch_scalar("SELECT COALESCE(SUM(yarn_weight_kg), 0) FROM yarn_purchases")


def calculate_yarn_purchased_by_type(yarn_type: str) -> float:
    return fetch_scalar(
        "SELECT COALESCE(SUM(yarn_weight_kg), 0) FROM yarn_purchases WHERE yarn_type = ?",
        (yarn_type,),
    )


def calculate_processing_fabric_sent_to_sai() -> float:
    return fetch_scalar("SELECT COALESCE(SUM(fabric_produced_meters), 0) FROM processing_records")


def calculate_direct_fabric_sent_to_sagar() -> float:
    return fetch_scalar(
        "SELECT COALESCE(SUM(fabric_produced_meters), 0) FROM direct_processing_records"
    )


def sync_sagar_receipts(connection) -> None:
    connection.execute("DELETE FROM sagar_receipts")
    connection.execute(
        """
        INSERT INTO sagar_receipts (source_table, source_record_id, date, challan_number, fabric_type, meters, created_at)
        SELECT 'dyeing_records', id, date, challan_number, 'white', fabric_dyed_meters, created_at
        FROM dyeing_records
        """
    )
    connection.execute(
        """
        INSERT INTO sagar_receipts (source_table, source_record_id, date, challan_number, fabric_type, meters, created_at)
        SELECT 'direct_processing_records', id, date, challan_number, 'black', fabric_produced_meters, created_at
        FROM direct_processing_records
        """
    )


def calculate_total_shubham_fabric_produced() -> float:
    return round(
        calculate_processing_fabric_sent_to_sai() + calculate_direct_fabric_sent_to_sagar(), 2
    )


def calculate_total_fabric_dyed() -> float:
    return fetch_scalar("SELECT COALESCE(SUM(fabric_dyed_meters), 0) FROM dyeing_records")


def calculate_white_yarn_balance() -> float:
    initial_white = get_initial_stock()["white_yarn_kg"]
    purchased = calculate_yarn_purchased_by_type(WHITE_YARN)
    draw = fetch_scalar(
        "SELECT COALESCE(SUM(yarn_consumed_kg + wastage_kg), 0) FROM processing_records"
    )
    return round(initial_white + purchased - draw, 2)


def calculate_black_yarn_balance() -> float:
    initial_black = get_initial_stock()["black_yarn_kg"]
    purchased = calculate_yarn_purchased_by_type(BLACK_YARN)
    draw = fetch_scalar(
        "SELECT COALESCE(SUM(yarn_consumed_kg + wastage_kg), 0) FROM direct_processing_records"
    )
    return round(initial_black + purchased - draw, 2)


def calculate_yarn_balance() -> float:
    return round(calculate_white_yarn_balance() + calculate_black_yarn_balance(), 2)


def calculate_fabric_balance() -> float:
    initial_fabric = get_initial_stock()["white_fabric_meters"]
    produced_for_sai = calculate_processing_fabric_sent_to_sai()
    dyed = calculate_total_fabric_dyed()
    return round(initial_fabric + produced_for_sai - dyed, 2)


def calculate_received_balance() -> float:
    return calculate_fabric_balance()


def calculate_shubham_remaining_fabric() -> float:
    total_produced = calculate_total_shubham_fabric_produced()
    sent_to_sai = calculate_processing_fabric_sent_to_sai()
    sent_direct = calculate_direct_fabric_sent_to_sagar()
    return round(total_produced - sent_to_sai - sent_direct, 2)


def get_flow_summary() -> dict[str, dict[str, float]]:
    white_to_sai = calculate_processing_fabric_sent_to_sai()
    black_to_sagar = calculate_direct_fabric_sent_to_sagar()
    dyed_white = calculate_total_fabric_dyed()
    return {
        "manglam": {
            "white_yarn_purchased_kg": calculate_yarn_purchased_by_type(WHITE_YARN),
            "black_yarn_purchased_kg": calculate_yarn_purchased_by_type(BLACK_YARN),
        },
        "shubham_white": {
            "yarn_balance_kg": calculate_white_yarn_balance(),
            "fabric_produced_meters": white_to_sai,
            "fabric_sent_to_sai_meters": white_to_sai,
        },
        "shubham_black": {
            "yarn_balance_kg": calculate_black_yarn_balance(),
            "fabric_produced_meters": black_to_sagar,
            "fabric_sent_to_sagar_meters": black_to_sagar,
        },
        "sai": {
            "fabric_received_meters": round(get_initial_stock()["white_fabric_meters"] + white_to_sai, 2),
            "fabric_dyed_meters": dyed_white,
            "balance_meters": calculate_fabric_balance(),
        },
        "sagar": {
            "white_fabric_received_meters": dyed_white,
            "black_fabric_received_meters": black_to_sagar,
            "total_fabric_received_meters": round(dyed_white + black_to_sagar, 2),
        },
    }


def get_dashboard() -> dict[str, Any]:
    initial_stock = get_initial_stock()
    flow_summary = get_flow_summary()
    return {
        "white_yarn_with_shubham_kg": calculate_white_yarn_balance(),
        "black_yarn_with_shubham_kg": calculate_black_yarn_balance(),
        "white_fabric_with_sai_meters": calculate_fabric_balance(),
        "white_fabric_with_sagar_meters": flow_summary["sagar"]["white_fabric_received_meters"],
        "black_fabric_with_sagar_meters": calculate_direct_fabric_sent_to_sagar(),
        "total_fabric_with_sagar_meters": flow_summary["sagar"]["total_fabric_received_meters"],
        "yarn_with_shubham_kg": calculate_yarn_balance(),
        "fabric_with_sai_meters": calculate_fabric_balance(),
        "logged_fabric_balance_meters": calculate_received_balance(),
        "fabric_sent_direct_to_sagar_meters": calculate_direct_fabric_sent_to_sagar(),
        "shubham_remaining_fabric_meters": calculate_shubham_remaining_fabric(),
        "initial_white_yarn_stock_kg": initial_stock["white_yarn_kg"],
        "initial_black_yarn_stock_kg": initial_stock["black_yarn_kg"],
        "initial_white_fabric_stock_meters": initial_stock["white_fabric_meters"],
        "flow_summary": flow_summary,
    }


def recompute_processing_balances(connection) -> None:
    balance_groups = (
        ("processing_records", WHITE_YARN, INITIAL_WHITE_YARN_KEY, LEGACY_INITIAL_YARN_KEY),
        ("direct_processing_records", BLACK_YARN, INITIAL_BLACK_YARN_KEY, None),
    )

    for table_name, yarn_type, config_key, fallback_key in balance_groups:
        opening_stock = resolve_stock_value(connection, config_key, fallback_key)

        remaining = round(opening_stock + fetch_total_yarn_purchased(connection, yarn_type), 2)
        rows = connection.execute(
            f"""
            SELECT id, yarn_consumed_kg, wastage_kg
            FROM {table_name}
            ORDER BY date ASC, created_at ASC, id ASC
            """
        ).fetchall()

        for row in rows:
            remaining = round(
                remaining - float(row["yarn_consumed_kg"]) - float(row["wastage_kg"]), 2
            )
            connection.execute(
                f"UPDATE {table_name} SET yarn_balance_kg = ? WHERE id = ?",
                (remaining, row["id"]),
            )


def recompute_dyeing_balances(connection) -> None:
    total_produced = fetch_total_processing_fabric(connection) + (
        fetch_config_number(connection, INITIAL_WHITE_FABRIC_KEY)
        or fetch_config_number(connection, LEGACY_INITIAL_FABRIC_KEY)
    )

    rows = connection.execute(
        """
        SELECT id, fabric_dyed_meters
        FROM dyeing_records
        ORDER BY date ASC, id ASC
        """
    ).fetchall()

    cumulative_dyed = 0.0
    for row in rows:
        cumulative_dyed = round(cumulative_dyed + float(row["fabric_dyed_meters"]), 2)
        balance = round(total_produced - cumulative_dyed, 2)
        connection.execute(
            "UPDATE dyeing_records SET balance_meters = ? WHERE id = ?",
            (balance, row["id"]),
        )


def add_yarn_purchase(payload: dict[str, Any]) -> dict[str, Any]:
    yarn_type = normalize_yarn_type(payload.get("yarn_type"))
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO yarn_purchases (date, invoice_number, yarn_type, yarn_weight_kg, notes)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                payload["date"],
                payload["invoice_number"],
                yarn_type,
                float(payload["yarn_weight_kg"]),
                payload.get("notes", ""),
            ),
        )
        recompute_processing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()
        record = connection.execute(
            "SELECT * FROM yarn_purchases WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return dict(record)


def add_processing_like_record(table_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    yarn_consumed = round(float(payload["yarn_consumed_kg"]), 2)
    wastage = round(yarn_consumed * WASTAGE_RATE, 2)

    with get_connection() as connection:
        cursor = connection.execute(
            f"""
            INSERT INTO {table_name}
            (date, challan_number, yarn_consumed_kg, wastage_kg, fabric_produced_meters, yarn_balance_kg)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload["date"],
                payload["challan_number"],
                yarn_consumed,
                wastage,
                round(float(payload["fabric_produced_meters"]), 2),
                0,
            ),
        )
        recompute_processing_balances(connection)
        if table_name == "processing_records":
            recompute_dyeing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()
        record = connection.execute(
            f"SELECT * FROM {table_name} WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return dict(record)


def add_processing_record(payload: dict[str, Any]) -> dict[str, Any]:
    return add_processing_like_record("processing_records", payload)


def add_direct_processing_record(payload: dict[str, Any]) -> dict[str, Any]:
    return add_processing_like_record("direct_processing_records", payload)


def add_dyeing_record(payload: dict[str, Any]) -> dict[str, Any]:
    fabric_dyed = round(float(payload["fabric_dyed_meters"]), 2)

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO dyeing_records
            (date, challan_number, fabric_dyed_meters, remarks, balance_meters)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                payload["date"],
                payload["challan_number"],
                fabric_dyed,
                str(payload.get("remarks", "")).strip(),
                0,
            ),
        )
        recompute_dyeing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()
        record = connection.execute(
            "SELECT * FROM dyeing_records WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return dict(record)


def update_yarn_purchase(record_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    existing = fetch_record_by_id("yarn_purchases", record_id)
    if not existing:
        raise ValueError("Record not found.")

    new_weight = round(float(payload["yarn_weight_kg"]), 2)
    new_yarn_type = normalize_yarn_type(payload.get("yarn_type"))

    with get_connection() as connection:
        existing_type = normalize_yarn_type(existing.get("yarn_type"))
        current_total = fetch_total_yarn_purchased(connection, new_yarn_type)
        adjusted_total = current_total + new_weight
        if existing_type == new_yarn_type:
            adjusted_total = round(current_total - float(existing["yarn_weight_kg"]) + new_weight, 2)
        if adjusted_total < fetch_total_yarn_draw(connection, new_yarn_type):
            raise ValueError("Updated yarn purchase would drop below already consumed yarn.")

        if existing_type != new_yarn_type:
            old_type_projected_total = round(
                fetch_total_yarn_purchased(connection, existing_type) - float(existing["yarn_weight_kg"]),
                2,
            )
            if old_type_projected_total < fetch_total_yarn_draw(connection, existing_type):
                raise ValueError("Cannot move this purchase to another yarn type because that stock has already been consumed.")

        connection.execute(
            """
            UPDATE yarn_purchases
            SET date = ?, invoice_number = ?, yarn_type = ?, yarn_weight_kg = ?, notes = ?
            WHERE id = ?
            """,
            (
                payload["date"],
                payload["invoice_number"],
                new_yarn_type,
                new_weight,
                payload.get("notes", ""),
                record_id,
            ),
        )
        recompute_processing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()
        record = connection.execute(
            "SELECT * FROM yarn_purchases WHERE id = ?", (record_id,)
        ).fetchone()
    return dict(record)


def delete_yarn_purchase(record_id: int) -> None:
    existing = fetch_record_by_id("yarn_purchases", record_id)
    if not existing:
        raise ValueError("Record not found.")

    with get_connection() as connection:
        yarn_type = normalize_yarn_type(existing.get("yarn_type"))
        current_total = fetch_total_yarn_purchased(connection, yarn_type)
        projected_total = round(current_total - float(existing["yarn_weight_kg"]), 2)
        if projected_total < fetch_total_yarn_draw(connection, yarn_type):
            raise ValueError("Cannot delete this purchase because the yarn has already been consumed.")

        connection.execute("DELETE FROM yarn_purchases WHERE id = ?", (record_id,))
        recompute_processing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()


def update_processing_like_record(
    table_name: str, record_id: int, payload: dict[str, Any]
) -> dict[str, Any]:
    existing = fetch_record_by_id(table_name, record_id)
    if not existing:
        raise ValueError("Record not found.")

    yarn_consumed = round(float(payload["yarn_consumed_kg"]), 2)
    wastage = round(yarn_consumed * WASTAGE_RATE, 2)
    fabric_produced = round(float(payload["fabric_produced_meters"]), 2)
    old_draw = round(float(existing["yarn_consumed_kg"]) + float(existing["wastage_kg"]), 2)
    new_draw = round(yarn_consumed + wastage, 2)

    with get_connection() as connection:
        yarn_type = WHITE_YARN if table_name == "processing_records" else BLACK_YARN
        total_purchased = fetch_total_yarn_purchased(connection, yarn_type)
        opening_key = INITIAL_WHITE_YARN_KEY if yarn_type == WHITE_YARN else INITIAL_BLACK_YARN_KEY
        fallback_key = LEGACY_INITIAL_YARN_KEY if yarn_type == WHITE_YARN else None
        opening_stock = fetch_config_number(connection, opening_key)
        if fallback_key and opening_stock == 0:
            opening_stock = fetch_config_number(connection, fallback_key)
        total_draw = fetch_total_yarn_draw(connection, yarn_type)
        projected_draw = round(total_draw - old_draw + new_draw, 2)
        if projected_draw > total_purchased + opening_stock:
            raise ValueError("Updated processing record exceeds available yarn balance.")

        if table_name == "processing_records":
            total_processing = fetch_total_processing_fabric(connection)
            total_dyed = fetch_total_fabric_dyed(connection)
            projected_processing = round(
                total_processing - float(existing["fabric_produced_meters"]) + fabric_produced, 2
            )
            if projected_processing < total_dyed:
                raise ValueError("Updated processing record would reduce fabric below dyed output.")

        connection.execute(
            f"""
            UPDATE {table_name}
            SET date = ?, challan_number = ?, yarn_consumed_kg = ?, wastage_kg = ?, fabric_produced_meters = ?
            WHERE id = ?
            """,
            (
                payload["date"],
                payload["challan_number"],
                yarn_consumed,
                wastage,
                fabric_produced,
                record_id,
            ),
        )
        recompute_processing_balances(connection)
        if table_name == "processing_records":
            recompute_dyeing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()
        record = connection.execute(
            f"SELECT * FROM {table_name} WHERE id = ?", (record_id,)
        ).fetchone()
    return dict(record)


def update_processing_record(record_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return update_processing_like_record("processing_records", record_id, payload)


def update_direct_processing_record(record_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return update_processing_like_record("direct_processing_records", record_id, payload)


def delete_processing_like_record(table_name: str, record_id: int) -> None:
    existing = fetch_record_by_id(table_name, record_id)
    if not existing:
        raise ValueError("Record not found.")

    with get_connection() as connection:
        if table_name == "processing_records":
            total_processing = fetch_total_processing_fabric(connection)
            total_dyed = fetch_total_fabric_dyed(connection)
            projected_processing = round(
                total_processing - float(existing["fabric_produced_meters"]), 2
            )
            if projected_processing < total_dyed:
                raise ValueError(
                    "Cannot delete this processing record because Sai Leela has already dyed that fabric."
                )

        connection.execute(f"DELETE FROM {table_name} WHERE id = ?", (record_id,))
        recompute_processing_balances(connection)
        if table_name == "processing_records":
            recompute_dyeing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()


def delete_processing_record(record_id: int) -> None:
    delete_processing_like_record("processing_records", record_id)


def delete_direct_processing_record(record_id: int) -> None:
    delete_processing_like_record("direct_processing_records", record_id)


def update_dyeing_record(record_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    existing = fetch_record_by_id("dyeing_records", record_id)
    if not existing:
        raise ValueError("Record not found.")

    fabric_dyed = round(float(payload["fabric_dyed_meters"]), 2)

    with get_connection() as connection:
        total_produced = fetch_total_processing_fabric(connection)
        total_dyed = fetch_total_fabric_dyed(connection)
        projected_dyed = round(total_dyed - float(existing["fabric_dyed_meters"]) + fabric_dyed, 2)
        if projected_dyed > total_produced:
            raise ValueError("Updated dyeing record exceeds available unfinished fabric at Sai Leela Processors.")

        connection.execute(
            """
            UPDATE dyeing_records
            SET date = ?, challan_number = ?, fabric_dyed_meters = ?, remarks = ?
            WHERE id = ?
            """,
            (
                payload["date"],
                payload["challan_number"],
                fabric_dyed,
                str(payload.get("remarks", "")).strip(),
                record_id,
            ),
        )
        recompute_dyeing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()
        record = connection.execute(
            "SELECT * FROM dyeing_records WHERE id = ?", (record_id,)
        ).fetchone()
    return dict(record)


def delete_dyeing_record(record_id: int) -> None:
    existing = fetch_record_by_id("dyeing_records", record_id)
    if not existing:
        raise ValueError("Record not found.")

    with get_connection() as connection:
        connection.execute("DELETE FROM dyeing_records WHERE id = ?", (record_id,))
        recompute_dyeing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()


def set_initial_stock(yarn_kg: float, fabric_meters: float) -> dict[str, Any]:
    return set_initial_stock_by_type(yarn_kg, 0, fabric_meters)


def set_initial_stock_by_type(
    white_yarn_kg: float, black_yarn_kg: float, white_fabric_meters: float
) -> dict[str, Any]:
    with get_connection() as connection:
        upsert_config_value(connection, INITIAL_WHITE_YARN_KEY, str(round(white_yarn_kg, 2)))
        upsert_config_value(connection, INITIAL_BLACK_YARN_KEY, str(round(black_yarn_kg, 2)))
        upsert_config_value(
            connection, INITIAL_WHITE_FABRIC_KEY, str(round(white_fabric_meters, 2))
        )
        recompute_processing_balances(connection)
        recompute_dyeing_balances(connection)
        sync_sagar_receipts(connection)
        connection.commit()
    return get_admin_settings()


def clear_all_data() -> None:
    with get_connection() as connection:
        for table_name in (
            "sagar_receipts",
            "dyeing_records",
            "processing_records",
            "direct_processing_records",
            "yarn_purchases",
        ):
            connection.execute(f"DELETE FROM {table_name}")
        connection.commit()
