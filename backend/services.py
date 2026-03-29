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
INITIAL_YARN_KEY = "initial_yarn"
INITIAL_FABRIC_KEY = "initial_fabric"
ADMIN_ROLE = "admin"
USER_ROLE = "user"


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
        f"SELECT date, invoice_number, yarn_weight_kg, notes FROM yarn_purchases{where_clause} ORDER BY date ASC, id ASC",
        params,
    )
    processing_records = serialize_rows(
        f"""
        SELECT date, challan_number, yarn_consumed_kg, wastage_kg, fabric_produced_meters
        FROM processing_records{where_clause}
        ORDER BY date ASC, id ASC
        """,
        params,
    )
    dyeing_records = serialize_rows(
        f"""
        SELECT date, challan_number, fabric_dyed_meters, balance_meters
        FROM dyeing_records{where_clause}
        ORDER BY date ASC, id ASC
        """,
        params,
    )
    direct_processing_records = serialize_rows(
        f"""
        SELECT date, challan_number, yarn_consumed_kg, wastage_kg, fabric_produced_meters
        FROM direct_processing_records{where_clause}
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
        return {
            "yarn_kg": fetch_config_number(connection, INITIAL_YARN_KEY),
            "fabric_meters": fetch_config_number(connection, INITIAL_FABRIC_KEY),
        }


def is_password_set() -> bool:
    with get_connection() as connection:
        return bool(fetch_config_value(connection, PASSWORD_KEY))


def get_admin_settings() -> dict[str, Any]:
    initial_stock = get_initial_stock()
    return {
        "initial_yarn_stock_kg": initial_stock["yarn_kg"],
        "initial_fabric_stock_meters": initial_stock["fabric_meters"],
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


def fetch_total_yarn_purchased(connection) -> float:
    row = connection.execute(
        "SELECT COALESCE(SUM(yarn_weight_kg), 0) FROM yarn_purchases"
    ).fetchone()
    return round(float(row[0] or 0), 2)


def fetch_total_yarn_draw(connection) -> float:
    row = connection.execute(
        """
        SELECT
            COALESCE((SELECT SUM(yarn_consumed_kg + wastage_kg) FROM processing_records), 0)
            +
            COALESCE((SELECT SUM(yarn_consumed_kg + wastage_kg) FROM direct_processing_records), 0)
        """
    ).fetchone()
    return round(float(row[0] or 0), 2)


def fetch_total_processing_fabric(connection) -> float:
    row = connection.execute(
        "SELECT COALESCE(SUM(fabric_produced_meters), 0) FROM processing_records"
    ).fetchone()
    return round(float(row[0] or 0), 2)


def fetch_total_direct_fabric(connection) -> float:
    row = connection.execute(
        "SELECT COALESCE(SUM(fabric_produced_meters), 0) FROM direct_processing_records"
    ).fetchone()
    return round(float(row[0] or 0), 2)


def fetch_total_fabric_dyed(connection) -> float:
    row = connection.execute(
        "SELECT COALESCE(SUM(fabric_dyed_meters), 0) FROM dyeing_records"
    ).fetchone()
    return round(float(row[0] or 0), 2)


def calculate_total_yarn_purchased() -> float:
    return fetch_scalar("SELECT COALESCE(SUM(yarn_weight_kg), 0) FROM yarn_purchases")


def calculate_processing_fabric_sent_to_sai() -> float:
    return fetch_scalar("SELECT COALESCE(SUM(fabric_produced_meters), 0) FROM processing_records")


def calculate_direct_fabric_sent_to_sagar() -> float:
    return fetch_scalar(
        "SELECT COALESCE(SUM(fabric_produced_meters), 0) FROM direct_processing_records"
    )


def calculate_total_shubham_fabric_produced() -> float:
    return round(
        calculate_processing_fabric_sent_to_sai() + calculate_direct_fabric_sent_to_sagar(), 2
    )


def calculate_total_fabric_dyed() -> float:
    return fetch_scalar("SELECT COALESCE(SUM(fabric_dyed_meters), 0) FROM dyeing_records")


def calculate_yarn_balance() -> float:
    initial_yarn = get_initial_stock()["yarn_kg"]
    purchased = calculate_total_yarn_purchased()
    draw = fetch_scalar(
        """
        SELECT
            COALESCE((SELECT SUM(yarn_consumed_kg + wastage_kg) FROM processing_records), 0)
            +
            COALESCE((SELECT SUM(yarn_consumed_kg + wastage_kg) FROM direct_processing_records), 0)
        """
    )
    return round(initial_yarn + purchased - draw, 2)


def calculate_fabric_balance() -> float:
    initial_fabric = get_initial_stock()["fabric_meters"]
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
    return {
        "manglam": {
            "total_yarn_purchased_kg": calculate_total_yarn_purchased(),
        },
        "shubham": {
            "yarn_balance_kg": calculate_yarn_balance(),
            "fabric_produced_meters": calculate_total_shubham_fabric_produced(),
            "fabric_sent_to_sai_meters": calculate_processing_fabric_sent_to_sai(),
            "fabric_sent_direct_meters": calculate_direct_fabric_sent_to_sagar(),
            "remaining_fabric_meters": calculate_shubham_remaining_fabric(),
        },
        "sai": {
            "fabric_received_meters": round(
                get_initial_stock()["fabric_meters"] + calculate_processing_fabric_sent_to_sai(),
                2,
            ),
            "fabric_dyed_meters": calculate_total_fabric_dyed(),
            "balance_meters": calculate_fabric_balance(),
        },
        "sagar": {
            "fabric_received_direct_meters": calculate_direct_fabric_sent_to_sagar(),
        },
    }


def get_dashboard() -> dict[str, Any]:
    initial_stock = get_initial_stock()
    return {
        "yarn_with_shubham_kg": calculate_yarn_balance(),
        "fabric_with_sai_meters": calculate_fabric_balance(),
        "logged_fabric_balance_meters": calculate_received_balance(),
        "fabric_sent_direct_to_sagar_meters": calculate_direct_fabric_sent_to_sagar(),
        "shubham_remaining_fabric_meters": calculate_shubham_remaining_fabric(),
        "initial_yarn_stock_kg": initial_stock["yarn_kg"],
        "initial_fabric_stock_meters": initial_stock["fabric_meters"],
        "flow_summary": get_flow_summary(),
    }


def recompute_processing_balances(connection) -> None:
    total_purchased = fetch_total_yarn_purchased(connection) + fetch_config_number(
        connection, INITIAL_YARN_KEY
    )
    rows = connection.execute(
        """
        SELECT source_table, id, yarn_consumed_kg, wastage_kg
        FROM (
            SELECT 'processing_records' AS source_table, id, date, created_at, yarn_consumed_kg, wastage_kg
            FROM processing_records
            UNION ALL
            SELECT 'direct_processing_records' AS source_table, id, date, created_at, yarn_consumed_kg, wastage_kg
            FROM direct_processing_records
        )
        ORDER BY date ASC, created_at ASC, source_table ASC, id ASC
        """
    ).fetchall()

    remaining = total_purchased
    for row in rows:
        remaining = round(
            remaining - float(row["yarn_consumed_kg"]) - float(row["wastage_kg"]), 2
        )
        connection.execute(
            f"UPDATE {row['source_table']} SET yarn_balance_kg = ? WHERE id = ?",
            (remaining, row["id"]),
        )


def recompute_dyeing_balances(connection) -> None:
    total_produced = fetch_total_processing_fabric(connection) + fetch_config_number(
        connection, INITIAL_FABRIC_KEY
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
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO yarn_purchases (date, invoice_number, yarn_weight_kg, notes)
            VALUES (?, ?, ?, ?)
            """,
            (
                payload["date"],
                payload["invoice_number"],
                float(payload["yarn_weight_kg"]),
                payload.get("notes", ""),
            ),
        )
        recompute_processing_balances(connection)
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
            (date, challan_number, fabric_dyed_meters, balance_meters)
            VALUES (?, ?, ?, ?)
            """,
            (
                payload["date"],
                payload["challan_number"],
                fabric_dyed,
                0,
            ),
        )
        recompute_dyeing_balances(connection)
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

    with get_connection() as connection:
        current_total = fetch_total_yarn_purchased(connection)
        projected_total = round(current_total - float(existing["yarn_weight_kg"]) + new_weight, 2)
        if projected_total < fetch_total_yarn_draw(connection):
            raise ValueError("Updated yarn purchase would drop below already consumed yarn.")

        connection.execute(
            """
            UPDATE yarn_purchases
            SET date = ?, invoice_number = ?, yarn_weight_kg = ?, notes = ?
            WHERE id = ?
            """,
            (
                payload["date"],
                payload["invoice_number"],
                new_weight,
                payload.get("notes", ""),
                record_id,
            ),
        )
        recompute_processing_balances(connection)
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
        current_total = fetch_total_yarn_purchased(connection)
        projected_total = round(current_total - float(existing["yarn_weight_kg"]), 2)
        if projected_total < fetch_total_yarn_draw(connection):
            raise ValueError("Cannot delete this purchase because the yarn has already been consumed.")

        connection.execute("DELETE FROM yarn_purchases WHERE id = ?", (record_id,))
        recompute_processing_balances(connection)
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
        total_purchased = fetch_total_yarn_purchased(connection)
        total_draw = fetch_total_yarn_draw(connection)
        projected_draw = round(total_draw - old_draw + new_draw, 2)
        if projected_draw > total_purchased:
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
            SET date = ?, challan_number = ?, fabric_dyed_meters = ?
            WHERE id = ?
            """,
            (
                payload["date"],
                payload["challan_number"],
                fabric_dyed,
                record_id,
            ),
        )
        recompute_dyeing_balances(connection)
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
        connection.commit()


def set_initial_stock(yarn_kg: float, fabric_meters: float) -> dict[str, Any]:
    with get_connection() as connection:
        upsert_config_value(connection, INITIAL_YARN_KEY, str(round(yarn_kg, 2)))
        upsert_config_value(connection, INITIAL_FABRIC_KEY, str(round(fabric_meters, 2)))
        recompute_processing_balances(connection)
        recompute_dyeing_balances(connection)
        connection.commit()
    return get_admin_settings()


def clear_all_data() -> None:
    with get_connection() as connection:
        for table_name in ("dyeing_records", "processing_records", "direct_processing_records", "yarn_purchases"):
            connection.execute(f"DELETE FROM {table_name}")
        connection.commit()
