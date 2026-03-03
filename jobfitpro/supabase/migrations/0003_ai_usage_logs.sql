-- AI usage log (one row per Claude API call)
create table public.ai_usage_logs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  operation     text not null,  -- 'resume_parse','jd_clean','gap_analysis','interview','rewrite','cover_letter','ats_score'
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  model         text not null,
  created_at    timestamptz not null default now()
);
alter table public.ai_usage_logs enable row level security;
-- No client RLS policies — service role only

create index ai_usage_logs_user_date
  on public.ai_usage_logs(user_id, created_at desc);

-- Storage helper: sum bytes across all buckets for a user
create or replace function public.get_user_storage_bytes(p_user_id uuid)
returns bigint language sql security definer as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint
  from storage.objects
  where name like (p_user_id::text || '/%')
    and bucket_id in ('resumes', 'job-descriptions', 'outputs');
$$;

-- Seed pricing settings (admin sets real values via /admin/settings)
insert into public.system_settings (key, value) values
  ('ai_cost_input_per_million',  '0'),
  ('ai_cost_output_per_million', '0')
on conflict (key) do nothing;
