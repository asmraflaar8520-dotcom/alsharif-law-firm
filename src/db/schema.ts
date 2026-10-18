/**
 * Database Schema Definition — مكتب الشريف وشركاه للمحاماة
 * Idempotent DDL with foreign keys, constraints, generated columns, views, and indexes.
 */

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lawyer',
  department TEXT,
  bar_number TEXT,
  bar_year INTEGER,
  hourly_rate REAL DEFAULT 0,
  bio TEXT,
  initials TEXT,
  color TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT,
  city TEXT,
  circuit TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS case_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'individual',
  name TEXT NOT NULL,
  national_id TEXT,
  tax_id TEXT,
  commercial_reg TEXT,
  nationality TEXT DEFAULT 'مصري',
  phone TEXT,
  phone2 TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  occupation TEXT,
  company_rep TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  assigned_lawyer_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (assigned_lawyer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_no TEXT NOT NULL,
  case_number TEXT GENERATED ALWAYS AS (case_no) VIRTUAL,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  case_type_id INTEGER,
  court_id INTEGER,
  circuit TEXT,
  degree TEXT DEFAULT 'ابتدائي',
  status TEXT DEFAULT 'متداولة',
  priority TEXT DEFAULT 'عادية',
  client_id INTEGER NOT NULL,
  opposing_name TEXT,
  opposing_lawyer TEXT,
  lead_lawyer_id INTEGER,
  subject TEXT,
  claim_value REAL DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  filing_date TEXT,
  next_action TEXT,
  outcome TEXT,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_type_id) REFERENCES case_types(id) ON DELETE SET NULL,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_lawyer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS case_lawyers (
  case_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'مساعد',
  PRIMARY KEY (case_id, user_id),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hearings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  hearing_date TEXT NOT NULL,
  hearing_time TEXT,
  court_id INTEGER,
  circuit TEXT,
  type TEXT DEFAULT 'مرافعة',
  purpose TEXT,
  result TEXT,
  next_date TEXT,
  lawyer_id INTEGER,
  status TEXT DEFAULT 'قادمة',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE SET NULL,
  FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  case_id INTEGER,
  client_id INTEGER,
  assignee_id INTEGER,
  creator_id INTEGER,
  due_date TEXT,
  due_time TEXT,
  priority TEXT DEFAULT 'عادية',
  status TEXT DEFAULT 'مفتوحة',
  category TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  client_id INTEGER,
  title TEXT NOT NULL,
  doc_type TEXT,
  ref_no TEXT,
  date_issued TEXT,
  pages INTEGER,
  notes TEXT,
  uploaded_by INTEGER,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS powers_of_attorney (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poa_no TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  case_id INTEGER,
  lawyer_id INTEGER,
  type TEXT NOT NULL,
  notary_office TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'ساري',
  scope TEXT,
  notes TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Transparent view and triggers for 'poas' table name compatibility
CREATE VIEW IF NOT EXISTS poas AS SELECT * FROM powers_of_attorney;

CREATE TRIGGER IF NOT EXISTS trg_poas_insert INSTEAD OF INSERT ON poas
BEGIN
  INSERT INTO powers_of_attorney (id, poa_no, client_id, case_id, lawyer_id, type, notary_office, issue_date, expiry_date, status, scope, notes, file_url, file_name, file_size, mime_type, storage_key, created_at)
  VALUES (new.id, new.poa_no, new.client_id, new.case_id, new.lawyer_id, new.type, new.notary_office, new.issue_date, new.expiry_date, new.status, new.scope, new.notes, new.file_url, new.file_name, new.file_size, new.mime_type, new.storage_key, coalesce(new.created_at, datetime('now')));
END;

CREATE TRIGGER IF NOT EXISTS trg_poas_update INSTEAD OF UPDATE ON poas
BEGIN
  UPDATE powers_of_attorney SET
    poa_no = new.poa_no,
    client_id = new.client_id,
    case_id = new.case_id,
    lawyer_id = new.lawyer_id,
    type = new.type,
    notary_office = new.notary_office,
    issue_date = new.issue_date,
    expiry_date = new.expiry_date,
    status = new.status,
    scope = new.scope,
    notes = new.notes,
    file_url = new.file_url,
    file_name = new.file_name,
    file_size = new.file_size,
    mime_type = new.mime_type,
    storage_key = new.storage_key
  WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_poas_delete INSTEAD OF DELETE ON poas
BEGIN
  DELETE FROM powers_of_attorney WHERE id = old.id;
END;

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  case_id INTEGER,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  subtotal REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  paid REAL DEFAULT 0,
  status TEXT DEFAULT 'مسودة',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  qty REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  client_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT 'تحويل',
  paid_at TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  received_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  title TEXT NOT NULL,
  category TEXT,
  amount REAL NOT NULL,
  expense_date TEXT NOT NULL,
  billable INTEGER DEFAULT 1,
  billed INTEGER DEFAULT 0,
  vendor TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  case_id INTEGER,
  work_date TEXT NOT NULL,
  hours REAL NOT NULL,
  description TEXT,
  billable INTEGER DEFAULT 1,
  billed INTEGER DEFAULT 0,
  rate REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  type TEXT,
  start_date TEXT,
  end_date TEXT,
  value REAL DEFAULT 0,
  status TEXT DEFAULT 'ساري',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  client_id INTEGER,
  user_id INTEGER,
  content TEXT NOT NULL,
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  entity_type TEXT,
  entity_id INTEGER,
  action TEXT,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  case_id INTEGER,
  is_done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appeal_deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  deadline_type TEXT NOT NULL,
  judgment_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

-- ========================================================
-- Indexes & Performance Accelerators
-- ========================================================

-- Mandatory Required Indexes
CREATE INDEX IF NOT EXISTS idx_cases_case_number_client ON cases(case_number, client_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_no_client ON cases(case_no, client_id);
CREATE INDEX IF NOT EXISTS idx_hearings_hearing_date_case ON hearings(hearing_date, case_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);

-- Appeal Deadlines Performance Indexes
CREATE INDEX IF NOT EXISTS idx_appeal_deadlines_case_id ON appeal_deadlines(case_id);
CREATE INDEX IF NOT EXISTS idx_appeal_deadlines_due_date ON appeal_deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_appeal_deadlines_status ON appeal_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_appeal_deadlines_radar ON appeal_deadlines(status, due_date);

-- Query Acceleration & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer ON cases(lead_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_status ON cases(lead_lawyer_id, status);
CREATE INDEX IF NOT EXISTS idx_hearings_date ON hearings(hearing_date);
CREATE INDEX IF NOT EXISTS idx_hearings_case ON hearings(case_id);
CREATE INDEX IF NOT EXISTS idx_hearings_upcoming ON hearings(hearing_date, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_poas_client ON powers_of_attorney(client_id);
CREATE INDEX IF NOT EXISTS idx_poas_expiry ON powers_of_attorney(expiry_date);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_expenses_case ON expenses(case_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_billable ON expenses(billable, billed);
CREATE INDEX IF NOT EXISTS idx_time_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_billable ON time_entries(billable, billed);
`
