-- Create users table
CREATE TABLE public.users (
  id uuid references auth.users not null primary key,
  email text,
  role text default 'user',
  created_at timestamptz default now()
);

-- Create projects table
CREATE TABLE public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text default 'active',
  created_at timestamptz default now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create daily_reports table
CREATE TABLE public.daily_reports (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  date date not null default current_date,
  weather text,
  content text,
  status text default 'draft', -- draft, submitted, locked
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  table_name text not null,
  record_id uuid not null,
  operation text not null, -- INSERT, UPDATE, DELETE
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users,
  changed_at timestamptz default now()
);

-- Create trigger function for audit log
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (table_name, record_id, operation, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Check if daily_report is locked
    IF (TG_TABLE_NAME = 'daily_reports' AND OLD.status = 'locked') THEN
      RAISE EXCEPTION 'Cannot update a locked daily report';
    END IF;
    
    INSERT INTO public.audit_logs (table_name, record_id, operation, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (table_name, record_id, operation, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to tasks
CREATE TRIGGER tasks_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Add triggers to daily_reports
CREATE TRIGGER daily_reports_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.daily_reports
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_modtime
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

CREATE TRIGGER update_daily_reports_modtime
BEFORE UPDATE ON public.daily_reports
FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();


-- Setup RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- projects policies
CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);

-- tasks policies
CREATE POLICY "Authenticated users can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (true);

-- daily_reports policies
CREATE POLICY "Authenticated users can view daily_reports" ON public.daily_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert daily_reports" ON public.daily_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update daily_reports" ON public.daily_reports FOR UPDATE TO authenticated USING (status != 'locked') WITH CHECK (true);
CREATE POLICY "Authenticated users can delete daily_reports" ON public.daily_reports FOR DELETE TO authenticated USING (status != 'locked');

-- audit_logs policies
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (exists (select 1 from public.users where public.users.id = auth.uid() and public.users.role = 'admin'));
-- No insert/update/delete policies for audit_logs as it's modified by trigger with SECURITY DEFINER
