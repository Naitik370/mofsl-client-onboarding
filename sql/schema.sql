PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS role_master (
    id INTEGER PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES role_master(id),
    password_hash BLOB NOT NULL,
    password_salt BLOB NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_master (
    id INTEGER PRIMARY KEY,
    status_name TEXT NOT NULL UNIQUE,
    stage TEXT NOT NULL,
    query_start_key TEXT,
    query_end_key TEXT,
    is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
    is_exception INTEGER NOT NULL DEFAULT 0 CHECK (is_exception IN (0, 1))
);

CREATE TABLE IF NOT EXISTS location_master (
    id INTEGER PRIMARY KEY,
    location_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS segment_master (
    id INTEGER PRIMARY KEY,
    segment_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS holiday_master (
    holiday_date TEXT PRIMARY KEY,
    holiday_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
    client_name TEXT NOT NULL,
    pan TEXT NOT NULL,
    account_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    location_id INTEGER NOT NULL REFERENCES location_master(id),
    segment_id INTEGER NOT NULL REFERENCES segment_master(id),
    rm_name TEXT NOT NULL DEFAULT '',
    cse_name TEXT NOT NULL DEFAULT '',
    touch_count INTEGER NOT NULL DEFAULT 0 CHECK(touch_count >= 0),
    touch_count_baseline INTEGER NOT NULL DEFAULT 0 CHECK(touch_count_baseline >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    request_id TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('New', 'Resubmission', 'Discrepancy Resolution', 'Modification')),
    processor_name TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL CHECK (owner IN ('Operations', 'CSE', 'MOFSL')),
    inward_date TEXT NOT NULL,
    outward_date TEXT,
    resubmission_date TEXT,
    signed_form_date TEXT,
    submitted_date TEXT,
    account_opening_date TEXT,
    account_number TEXT NOT NULL DEFAULT '',
    latest_status_id INTEGER NOT NULL REFERENCES status_master(id),
    query_details TEXT NOT NULL DEFAULT '',
    remarks TEXT NOT NULL DEFAULT '',
    status_date TEXT,
    stage1_query_raised_date TEXT,
    stage1_resubmission_date TEXT,
    form_prepared_date TEXT,
    physical_form_submitted_date TEXT,
    digital_form_sent_date TEXT,
    discrepancy_raised_date TEXT,
    form_returned_to_cse_date TEXT,
    discrepancy_resolution_received_date TEXT,
    resubmitted_form_received_date TEXT,
    mofsl_query_raised_date TEXT,
    mofsl_query_resolved_date TEXT,
    communication_sent_date TEXT,
    stage1_query_details TEXT,
    discrepancy_type TEXT,
    stage4_review_outcome TEXT,
    mofsl_query_type TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    entry_id INTEGER NOT NULL REFERENCES case_entries(id) ON DELETE RESTRICT,
    event_timestamp TEXT NOT NULL,
    business_date TEXT,
    old_status_id INTEGER REFERENCES status_master(id),
    new_status_id INTEGER NOT NULL REFERENCES status_master(id),
    changed_by TEXT NOT NULL,
    owner TEXT NOT NULL,
    event_notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_case_entries_case_id ON case_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_case_entries_status_id ON case_entries(latest_status_id);
CREATE INDEX IF NOT EXISTS idx_status_history_case_time ON status_history(case_id, event_timestamp);
