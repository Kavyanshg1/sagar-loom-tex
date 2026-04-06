from __future__ import annotations

import sqlite3
import shutil
import sys
import os
from pathlib import Path


APP_NAME = "Sagar Loom Tex"
SOURCE_BASE_DIR = Path(__file__).resolve().parent
RESOURCE_BASE_DIR = Path(getattr(sys, "_MEIPASS", SOURCE_BASE_DIR))
SCHEMA_PATH = RESOURCE_BASE_DIR / "schema.sql"
DEFAULT_DATABASE_PATH = RESOURCE_BASE_DIR / "textile_flow.db"


def parse_sqlite_database_url(database_url: str) -> Path | None:
    if not database_url:
        return None
    if not database_url.startswith("sqlite:///"):
        return None
    raw_path = database_url.removeprefix("sqlite:///")
    return Path(raw_path).expanduser()


def get_storage_dir() -> Path:
    configured_storage_dir = os.getenv("APP_STORAGE_DIR", "").strip()
    if configured_storage_dir:
        return Path(configured_storage_dir).expanduser()
    if getattr(sys, "frozen", False):
        if sys.platform == "darwin":
            return Path.home() / "Library" / "Application Support" / APP_NAME
        if sys.platform.startswith("win"):
            return Path(os.getenv("APPDATA", Path.home())) / APP_NAME
        return Path.home() / f".{APP_NAME.lower().replace(' ', '-')}"
    return SOURCE_BASE_DIR


STORAGE_DIR = get_storage_dir()
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
CONFIGURED_DATABASE_PATH = (
    os.getenv("DATABASE_PATH", "").strip()
    or parse_sqlite_database_url(os.getenv("DATABASE_URL", "").strip())
)
DATABASE_PATH = (
    Path(CONFIGURED_DATABASE_PATH).expanduser()
    if CONFIGURED_DATABASE_PATH
    else STORAGE_DIR / "textile_flow.db"
)
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)


def ensure_writable_database_file(path: Path) -> None:
    try:
        path.chmod(0o600)
    except PermissionError:
        # Some packaged/runtime environments deny chmod even when the file is usable.
        pass


def ensure_database_file() -> None:
    if DATABASE_PATH.exists():
        ensure_writable_database_file(DATABASE_PATH)
        return
    if DEFAULT_DATABASE_PATH.exists():
        shutil.copy2(DEFAULT_DATABASE_PATH, DATABASE_PATH)
        ensure_writable_database_file(DATABASE_PATH)


def get_connection() -> sqlite3.Connection:
    ensure_database_file()
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def get_table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row["name"] for row in rows}


def get_config_value(connection: sqlite3.Connection, key: str, default: float = 0) -> float:
    row = connection.execute(
        "SELECT value FROM app_config WHERE key = ?",
        (key,),
    ).fetchone()
    if not row or row["value"] in (None, ""):
        return float(default)
    try:
        return float(row["value"])
    except (TypeError, ValueError):
        return float(default)


def migrate_dyeing_records(connection: sqlite3.Connection) -> None:
    columns = get_table_columns(connection, "dyeing_records")
    if "fabric_received_meters" not in columns:
        return

    connection.execute(
        """
        CREATE TABLE dyeing_records_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            challan_number TEXT NOT NULL,
            fabric_dyed_meters REAL NOT NULL,
            balance_meters REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        INSERT INTO dyeing_records_new (id, date, challan_number, fabric_dyed_meters, balance_meters, created_at)
        SELECT id, date, challan_number, fabric_dyed_meters, balance_meters, created_at
        FROM dyeing_records
        """
    )
    connection.execute("DROP TABLE dyeing_records")
    connection.execute("ALTER TABLE dyeing_records_new RENAME TO dyeing_records")




def migrate_dyeing_remarks(connection: sqlite3.Connection) -> None:
    columns = get_table_columns(connection, "dyeing_records")
    if "remarks" in columns:
        return

    connection.execute(
        "ALTER TABLE dyeing_records ADD COLUMN remarks TEXT NOT NULL DEFAULT ''"
    )

def migrate_yarn_purchases(connection: sqlite3.Connection) -> None:
    columns = get_table_columns(connection, "yarn_purchases")
    if "yarn_type" in columns:
        return

    connection.execute("ALTER TABLE yarn_purchases ADD COLUMN yarn_type TEXT NOT NULL DEFAULT 'white'")
    connection.execute(
        """
        UPDATE yarn_purchases
        SET yarn_type = 'white'
        WHERE yarn_type IS NULL OR yarn_type = ''
        """
    )


def refresh_dyeing_balances(connection: sqlite3.Connection) -> None:
    columns = get_table_columns(connection, "dyeing_records")
    if not {"fabric_dyed_meters", "balance_meters"}.issubset(columns):
        return

    total_produced_row = connection.execute(
        "SELECT COALESCE(SUM(fabric_produced_meters), 0) FROM processing_records"
    ).fetchone()
    total_produced = round(
        get_config_value(connection, "initial_fabric", 0) + float(total_produced_row[0] or 0),
        2,
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


def refresh_sagar_receipts(connection: sqlite3.Connection) -> None:
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


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(SCHEMA_PATH.read_text())
        migrate_yarn_purchases(connection)
        migrate_dyeing_records(connection)
        migrate_dyeing_remarks(connection)
        refresh_dyeing_balances(connection)
        refresh_sagar_receipts(connection)
        connection.commit()
