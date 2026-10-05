/**
 * Domain types and interfaces for Law Firm Management Platform
 */

export type Bindings = {
  DB: D1Database
}

export type AppContext = {
  Bindings: Bindings
}

export interface User {
  id: number
  name: string
  title: string | null
  email: string
  phone: string | null
  role: 'managing_partner' | 'partner' | 'senior' | 'lawyer' | 'intern' | 'admin' | 'accountant' | 'secretary'
  department: string | null
  bar_number: string | null
  bar_year: number | null
  hourly_rate: number
  bio: string | null
  initials: string
  color: string
  is_active: number
  created_at?: string
}

export interface SessionRecord {
  token: string
  user_id: number
  expires_at: string
  created_at?: string
}

export interface Court {
  id: number
  name: string
  type: string | null
  city: string | null
  circuit: string | null
  address: string | null
}

export interface CaseType {
  id: number
  name: string
  category: string
  code: string | null
}

export interface Client {
  id: number
  type: 'individual' | 'company'
  name: string
  national_id: string | null
  tax_id: string | null
  commercial_reg: string | null
  nationality: string | null
  phone: string | null
  phone2: string | null
  email: string | null
  address: string | null
  city: string | null
  occupation: string | null
  company_rep: string | null
  notes: string | null
  status: 'active' | 'vip' | 'inactive'
  assigned_lawyer_id: number | null
  created_at?: string
}

export interface Case {
  id: number
  case_no: string
  year: number
  title: string
  case_type_id: number | null
  court_id: number | null
  circuit: string | null
  degree: string
  status: string
  priority: string
  client_id: number
  opposing_name: string | null
  opposing_lawyer: string | null
  lead_lawyer_id: number | null
  subject: string | null
  claim_value: number
  currency: string
  filing_date: string | null
  next_action: string | null
  outcome: string | null
  closed_at: string | null
  created_at?: string
  updated_at?: string
}

export interface Hearing {
  id: number
  case_id: number
  hearing_date: string
  hearing_time: string | null
  court_id: number | null
  circuit: string | null
  type: string
  purpose: string | null
  result: string | null
  next_date: string | null
  lawyer_id: number | null
  status: string
  notes: string | null
  created_at?: string
}

export interface Task {
  id: number
  title: string
  description: string | null
  case_id: number | null
  client_id: number | null
  assignee_id: number | null
  creator_id: number | null
  due_date: string | null
  due_time: string | null
  priority: string
  status: string
  category: string | null
  created_at?: string
  completed_at: string | null
}

export interface DocumentRecord {
  id: number
  case_id: number | null
  client_id: number | null
  title: string
  doc_type: string | null
  ref_no: string | null
  date_issued: string | null
  pages: number | null
  notes: string | null
  uploaded_by: number | null
  created_at?: string
}

export interface PowerOfAttorney {
  id: number
  poa_no: string
  client_id: number
  case_id: number | null
  lawyer_id: number | null
  type: string
  notary_office: string | null
  issue_date: string | null
  expiry_date: string | null
  status: string
  scope: string | null
  notes: string | null
  created_at?: string
}

export interface Invoice {
  id: number
  invoice_no: string
  client_id: number
  case_id: number | null
  issue_date: string
  due_date: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  paid: number
  status: string
  notes: string | null
  created_by: number | null
  created_at?: string
}

export interface InvoiceItem {
  id: number
  invoice_id: number
  description: string
  qty: number
  unit_price: number
  amount: number
}

export interface Payment {
  id: number
  invoice_id: number | null
  client_id: number
  amount: number
  method: string
  paid_at: string
  reference: string | null
  notes: string | null
  received_by: number | null
  created_at?: string
}

export interface Expense {
  id: number
  case_id: number | null
  title: string
  category: string | null
  amount: number
  expense_date: string
  billable: number
  billed: number
  vendor: string | null
  notes: string | null
  created_by: number | null
  created_at?: string
}

export interface TimeEntry {
  id: number
  user_id: number
  case_id: number | null
  work_date: string
  hours: number
  description: string | null
  billable: number
  billed: number
  rate: number
  created_at?: string
}

export interface Contract {
  id: number
  title: string
  client_id: number
  type: string | null
  start_date: string | null
  end_date: string | null
  value: number
  status: string
  notes: string | null
  created_at?: string
}

export interface Note {
  id: number
  case_id: number | null
  client_id: number | null
  user_id: number | null
  content: string
  pinned: number
  created_at?: string
}

export interface Activity {
  id: number
  user_id: number | null
  entity_type: string | null
  entity_id: number | null
  action: string | null
  detail: string | null
  created_at?: string
}

export interface KPISummary {
  open_cases: number
  total_cases: number
  closed_cases: number
  urgent_cases: number
  hearings_today: number
  open_tasks: number
  overdue_invoices: number
  overdue_amount: number
  month_collected: number
  month_invoiced: number
  outstanding: number
  overdue: number
  month_expenses: number
}
