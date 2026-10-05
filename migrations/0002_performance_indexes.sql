-- Performance Indexes for High-Velocity Queries & Dashboards
-- Accelerated index-only scans for hearings, invoices, tasks, and cases

CREATE INDEX IF NOT EXISTS idx_hearings_upcoming ON hearings(hearing_date, status);
CREATE INDEX IF NOT EXISTS idx_hearings_case_date ON hearings(case_id, hearing_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_billable ON expenses(billable, billed);
CREATE INDEX IF NOT EXISTS idx_time_billable ON time_entries(billable, billed);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_status ON cases(lead_lawyer_id, status);
