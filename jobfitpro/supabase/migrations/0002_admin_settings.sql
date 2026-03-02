-- Admin system settings table (key/value store)
-- Only accessible via service role key (admin client) — no RLS policies granted.

create table public.system_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enable RLS but grant no policies — effectively blocks all non-service-role access
alter table public.system_settings enable row level security;

-- Trigger to auto-update updated_at on every write
create trigger handle_updated_at_system_settings
  before update on public.system_settings
  for each row execute function public.handle_updated_at();

-- Seed defaults (signup closed by default for alpha)
insert into public.system_settings (key, value) values
  ('signup_enabled',           'false'),
  ('quota_free_limit',         '2'),
  ('quota_paid_monthly_limit', '30');
