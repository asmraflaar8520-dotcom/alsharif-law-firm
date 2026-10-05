-- مكتب الشريف وشركاه للمحاماة — مخطط قاعدة البيانات الكامل

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lawyer', -- managing_partner, partner, senior, lawyer, intern, admin, accountant, secretary
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
  FOREIGN KEY (user_id) REFERENCES users(id)
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
  type TEXT NOT NULL DEFAULT 'individual', -- individual, company
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
  status TEXT DEFAULT 'active', -- active, vip, inactive
  assigned_lawyer_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (assigned_lawyer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_no TEXT NOT NULL,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  case_type_id INTEGER,
  court_id INTEGER,
  circuit TEXT,
  degree TEXT DEFAULT 'ابتدائي', -- ابتدائي، استئناف، نقض، إداري
  status TEXT DEFAULT 'متداولة',
  priority TEXT DEFAULT 'عادية', -- عاجلة، عالية، عادية، منخفضة
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
  FOREIGN KEY (case_type_id) REFERENCES case_types(id),
  FOREIGN KEY (court_id) REFERENCES courts(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (lead_lawyer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS case_lawyers (
  case_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'مساعد',
  PRIMARY KEY (case_id, user_id),
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS hearings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  hearing_date TEXT NOT NULL,
  hearing_time TEXT,
  court_id INTEGER,
  circuit TEXT,
  type TEXT DEFAULT 'مرافعة', -- مرافعة، حكم، تحقيق، خبرة، صلح، تنفيذ
  purpose TEXT,
  result TEXT,
  next_date TEXT,
  lawyer_id INTEGER,
  status TEXT DEFAULT 'قادمة', -- قادمة، تمت، تأجيل، شطب، حجز للحكم
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (court_id) REFERENCES courts(id),
  FOREIGN KEY (lawyer_id) REFERENCES users(id)
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
  status TEXT DEFAULT 'مفتوحة', -- مفتوحة، جارية، مكتملة، ملغاة
  category TEXT, -- مرافعة، بحث، صياغة، إعلان، تنفيذ، إداري
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (assignee_id) REFERENCES users(id),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  client_id INTEGER,
  title TEXT NOT NULL,
  doc_type TEXT, -- صحيفة، مذكرة، حكم، توكيل، عقد، إنذار، صورة بطاقة، سجل تجاري، أخرى
  ref_no TEXT,
  date_issued TEXT,
  pages INTEGER,
  notes TEXT,
  uploaded_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS powers_of_attorney (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poa_no TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  case_id INTEGER,
  lawyer_id INTEGER,
  type TEXT NOT NULL, -- عام قضايا، رسمي عام، خاص، إداري، بيع، إدارة
  notary_office TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'ساري', -- ساري، منتهٍ، ملغى
  scope TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (lawyer_id) REFERENCES users(id)
);

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
  status TEXT DEFAULT 'مسودة', -- مسودة، صادرة، جزئي، مسددة، متأخرة، ملغاة
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  qty REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  client_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT 'تحويل', -- نقدي، شيك، تحويل، بطاقة
  paid_at TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  received_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (received_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  title TEXT NOT NULL,
  category TEXT, -- رسوم محكمة، إعلانات، خبرة، انتقالات، تصوير، ترجمة، أخرى
  amount REAL NOT NULL,
  expense_date TEXT NOT NULL,
  billable INTEGER DEFAULT 1,
  billed INTEGER DEFAULT 0,
  vendor TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
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
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  type TEXT, -- أتعاب، استشارة، شراكة، عمل، إيجار، بيع، تسوية
  start_date TEXT,
  end_date TEXT,
  value REAL DEFAULT 0,
  status TEXT DEFAULT 'ساري', -- مسودة، ساري، منتهٍ، مفسوخ
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,
  client_id INTEGER,
  user_id INTEGER,
  content TEXT NOT NULL,
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  entity_type TEXT,
  entity_id INTEGER,
  action TEXT,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  remind_at TEXT NOT NULL,
  case_id INTEGER,
  is_done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer ON cases(lead_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_hearings_date ON hearings(hearing_date);
CREATE INDEX IF NOT EXISTS idx_hearings_case ON hearings(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_poas_client ON powers_of_attorney(client_id);
CREATE INDEX IF NOT EXISTS idx_poas_expiry ON powers_of_attorney(expiry_date);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_case ON expenses(case_id);
CREATE INDEX IF NOT EXISTS idx_time_user ON time_entries(user_id);

