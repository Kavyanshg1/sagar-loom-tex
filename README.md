# Textile Flow Tracker

Textile Flow Tracker is a working prototype for tracking textile production flow between:

- Manglam Yarn Agencies
- Shubham Syncotex
- Sai Leela Processors

The project includes:

- `frontend/`: React + TailwindCSS dashboard
- `backend/`: Flask API with configurable persistent SQLite storage
- OCR + AI-assisted upload flow alongside manual entry

## Features

- Live dashboard balances for:
  - Yarn with Shubham Syncotex
  - Fabric with Sai Leela Processors
- Three responsive workflow tabs with:
  - Manual entry modal
  - Upload document preview
  - Clean record tables
- Automatic calculations:
  - Shubham wastage = `4%` of yarn consumed
  - Yarn balance updates after each processing record
  - Fabric produced at Shubham updates Sai live balance automatically
- SQLite persistence for all records
- Login/signup authentication with protected API routes
- Admin-only controls for starting stock, clear-data, and admin password management
- AI-assisted `POST /upload` extraction that pre-fills the existing manual form without auto-saving

## Project Structure

```text
backend/
  app.py
  db.py
  requirements.txt
  schema.sql
  services.py

frontend/
  index.html
  package.json
  postcss.config.js
  tailwind.config.js
  vite.config.js
  src/
    App.jsx
    index.css
    main.jsx
    components/
      EntryModal.jsx
      RecordsTable.jsx
      SectionCard.jsx
      StatCard.jsx
      TabButton.jsx
      UploadPanel.jsx
    lib/
      api.js
```

## Backend Setup

1. Create and activate a Python virtual environment.
2. Install dependencies.
3. Run the Flask app.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The API will run on `http://localhost:5000`.

For secure local and hosted use, configure:

- `FLASK_SECRET_KEY`: required for signed auth tokens
- `APP_ALLOWED_ORIGINS`: optional comma-separated CORS origins
- `APP_STORAGE_DIR`: optional persistent directory for the database and uploads
- `DATABASE_PATH`: optional explicit SQLite file path
- `DATABASE_URL`: optional SQLite URL such as `sqlite:////var/data/textile_flow.db`
- `AUTH_TOKEN_MAX_AGE_SECONDS`: optional token lifetime

For AI-assisted extraction, configure:

- `OPENAI_API_KEY`
- optional `OPENAI_MODEL` (defaults to `gpt-4o-mini`)

The OCR pipeline also depends on local system binaries for:

- `tesseract`
- Poppler utilities used by `pdf2image`

## Frontend Setup

1. Install Node dependencies.
2. Start the Vite dev server.

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`.

For deployed frontend builds that call a separate API origin, configure:

- `VITE_API_BASE_URL`

If omitted, the frontend uses same-origin in production and `http://127.0.0.1:5000` in Vite development.

## Authentication

The hosted dashboard now requires authenticated access before loading records or admin controls.

Public auth endpoints:

- `GET /auth/status`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

Behavior:

- the first signup is created as `admin`
- later signups are created as regular `user`
- all record, upload, dashboard, PDF export, and admin endpoints require a bearer token
- admin-only endpoints remain:
  - `POST /set-password`
  - `POST /set-initial-stock`
  - `POST /clear-all-data`

## API Overview

### `GET /records`

Returns all tables plus dashboard balances.

Requires authentication.

### `POST /yarn-purchases`

Creates a Manglam Yarn Agencies entry.

Example:

```json
{
  "date": "2026-03-15",
  "invoice_number": "INV-101",
  "yarn_weight_kg": 1200,
  "notes": "Lot A"
}
```

### `POST /processing-records`

Creates a Shubham Syncotex entry.

Example:

```json
{
  "date": "2026-03-15",
  "challan_number": "B102",
  "yarn_consumed_kg": 520,
  "fabric_produced_meters": 1500
}
```

### `POST /dyeing-records`

Creates a Sai Leela Processors entry.

Example:

```json
{
  "date": "2026-03-15",
  "challan_number": "D307",
  "fabric_dyed_meters": 1260
}
```

### `POST /upload`

Accepts multipart form-data with:

- `file`
- `document_type`: `yarn`, `processing`, or `dyeing`

Runs OCR plus AI field extraction and returns detected fields for review before saving.
Requires authentication.

Example response:

```json
{
  "document_type": "processing",
  "filename": "challan.pdf",
  "detected_fields": {
    "date": "2026-03-15",
    "challan_number": "B102",
    "yarn_consumed_kg": 520,
    "fabric_produced_meters": 1500
  },
  "message": "AI fields detected. Please review before saving."
}
```

### `GET /export-pdf`

Generates a downloadable PDF report for yarn purchases, processing records, and dyeing records.

Query parameters:

- `range_type`: `week`, `month`, `year`, `lifetime`, or `custom`
- `start_date`: required when `range_type=custom`
- `end_date`: required when `range_type=custom`

Examples:

```text
/export-pdf?range_type=month
/export-pdf?range_type=custom&start_date=2026-03-01&end_date=2026-03-15
```

Requires authentication.

## Production Hosting

The backend already serves the built React app from `frontend/dist`, so you can deploy this as a single web service behind your domain.

Recommended hosted setup:

1. Build frontend:

```bash
cd frontend
npm install
npm run build
```

2. Deploy backend with a persistent disk mounted to a stable path, then set:

```bash
FLASK_SECRET_KEY=change-this
APP_STORAGE_DIR=/var/data/textile-flow
APP_ALLOWED_ORIGINS=https://your-domain.com
```

3. Start the app with Gunicorn:

```bash
cd backend
gunicorn --bind 0.0.0.0:${PORT:-8000} wsgi:application
```

This keeps:

- `textile_flow.db` on persistent storage
- uploaded documents under the same storage root
- the React build and Flask API under one domain

## Notes

- By default, local development stores the database at `backend/textile_flow.db`.
- In hosted environments, prefer `APP_STORAGE_DIR` or `DATABASE_PATH` so data survives restarts and redeploys.
- Uploaded files are stored under the same storage directory in `uploads/`.
- The live Sai dashboard balance is calculated from Shubham fabric output minus dyed meters.
- Sai Leela no longer logs received meters manually; received fabric is derived from Shubham production.
- The Sai table balance and dashboard both use `SUM(processing_records.fabric_produced_meters) - SUM(dyeing_records.fabric_dyed_meters)`.

## Future Enhancements

- Managed Postgres migration for multi-instance scaling
- Search and reporting filters
- Export to Excel/PDF
