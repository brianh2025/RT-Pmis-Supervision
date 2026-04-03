-- Photo Logs for statutory photo verification
CREATE TABLE public.photo_logs (
  id uuid default gen_random_uuid() primary key,
  daily_report_id uuid references public.daily_reports(id) on delete cascade not null,
  storage_path text not null,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  location_note text,
  taken_at timestamptz not null,
  created_at timestamptz default now()
);

-- Labor/Personnel Logs
CREATE TABLE public.labor_logs (
  id uuid default gen_random_uuid() primary key,
  daily_report_id uuid references public.daily_reports(id) on delete cascade not null,
  worker_type text not null, -- e.g., 模板工, 鋼筋工
  today_count decimal(10, 2) default 0,
  cumulative_count decimal(10, 2) default 0,
  created_at timestamptz default now()
);

-- Equipment/Machinery Logs
CREATE TABLE public.equipment_logs (
  id uuid default gen_random_uuid() primary key,
  daily_report_id uuid references public.daily_reports(id) on delete cascade not null,
  equipment_name text not null,
  today_count integer default 0,
  cumulative_count integer default 0,
  created_at timestamptz default now()
);

-- Material Logs
CREATE TABLE public.material_logs (
  id uuid default gen_random_uuid() primary key,
  daily_report_id uuid references public.daily_reports(id) on delete cascade not null,
  material_name text not null,
  unit text not null,
  today_usage decimal(10, 2) default 0,
  cumulative_usage decimal(10, 2) default 0,
  created_at timestamptz default now()
);

-- Safety & Health Checklist
CREATE TABLE public.safety_checks (
  id uuid default gen_random_uuid() primary key,
  daily_report_id uuid references public.daily_reports(id) on delete cascade not null,
  pre_job_education boolean default false,
  insurance_verified boolean default false,
  ppe_checked boolean default false,
  environmental_maintained boolean default false,
  other_notes text,
  created_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE public.photo_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_checks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can manage photo_logs" ON public.photo_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage labor_logs" ON public.labor_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage equipment_logs" ON public.equipment_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage material_logs" ON public.material_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage safety_checks" ON public.safety_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Re-run audit triggers for new tables
CREATE TRIGGER photo_logs_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.photo_logs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER labor_logs_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.labor_logs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER equipment_logs_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.equipment_logs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER material_logs_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.material_logs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER safety_checks_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.safety_checks FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
