PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_token ON sessions(token_hash);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  organization TEXT,
  project_type TEXT NOT NULL,
  business_model TEXT,
  location TEXT,
  description TEXT,
  owner_name TEXT,
  team TEXT,
  companies TEXT,
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Média',
  criticality TEXT NOT NULL DEFAULT 'Média',
  dc_power_mwp REAL,
  ac_power_mw REAL,
  bess_power_mw REAL,
  bess_energy_mwh REAL,
  connection_voltage TEXT,
  generation_mode TEXT,
  distributor TEXT,
  annual_generation_mwh REAL,
  technical_notes TEXT,
  capex_estimated_cents INTEGER,
  capex_contracted_cents INTEGER,
  annual_opex_cents INTEGER,
  annual_revenue_cents INTEGER,
  sei_process TEXT,
  contract_number TEXT,
  contractor TEXT,
  contract_value_cents INTEGER,
  start_date TEXT,
  planned_end_date TEXT,
  actual_end_date TEXT,
  next_milestone TEXT,
  next_milestone_due TEXT,
  physical_progress REAL NOT NULL DEFAULT 0,
  schedule_status TEXT,
  delay_reason TEXT,
  last_activity_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_phase ON projects(phase);
CREATE INDEX idx_projects_deleted ON projects(deleted_at);

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  activity_date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  action_taken TEXT,
  result TEXT,
  people TEXT,
  activity_type TEXT NOT NULL,
  future_action INTEGER NOT NULL DEFAULT 0,
  future_due_date TEXT,
  next_owner TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE INDEX idx_activities_project ON activities(project_id, activity_date DESC);

CREATE TABLE pending_items (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  description TEXT NOT NULL,
  category TEXT,
  internal_owner TEXT,
  external_owner TEXT,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'Média',
  criticality TEXT NOT NULL DEFAULT 'Média',
  status TEXT NOT NULL DEFAULT 'Não iniciada',
  origin TEXT,
  required_action TEXT,
  comments TEXT,
  completed_at TEXT,
  completion_evidence TEXT,
  last_activity_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE INDEX idx_pending_due ON pending_items(due_date, status);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  sei_number TEXT,
  official_letter_number TEXT,
  version_label TEXT,
  document_date TEXT,
  owner_name TEXT,
  status TEXT,
  external_url TEXT,
  file_key TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('project','pending_item')),
  entity_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  deleted_at TEXT
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  occurred_at TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reason TEXT
);
CREATE INDEX idx_audit_record ON audit_log(module, record_id, occurred_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, occurred_at DESC);

CREATE TABLE favorite_filters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  filters_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
