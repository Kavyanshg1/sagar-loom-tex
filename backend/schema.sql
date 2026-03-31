CREATE TABLE IF NOT EXISTS yarn_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    yarn_type TEXT NOT NULL DEFAULT 'white',
    yarn_weight_kg REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    challan_number TEXT NOT NULL,
    yarn_consumed_kg REAL NOT NULL,
    wastage_kg REAL NOT NULL,
    fabric_produced_meters REAL NOT NULL,
    yarn_balance_kg REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS direct_processing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    challan_number TEXT NOT NULL,
    yarn_consumed_kg REAL NOT NULL,
    wastage_kg REAL NOT NULL,
    fabric_produced_meters REAL NOT NULL,
    yarn_balance_kg REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dyeing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    challan_number TEXT NOT NULL,
    fabric_dyed_meters REAL NOT NULL,
    balance_meters REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sagar_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_table TEXT NOT NULL,
    source_record_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    challan_number TEXT NOT NULL,
    fabric_type TEXT NOT NULL,
    meters REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_table, source_record_id)
);

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
