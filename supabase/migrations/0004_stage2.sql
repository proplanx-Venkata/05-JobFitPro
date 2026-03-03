-- Stage 2: Before/after ATS score distinction + shareable resume URLs
-- Apply manually in Supabase Dashboard → SQL Editor

-- Before/after ATS score distinction
alter table public.ats_scores
  add column if not exists is_pre_rewrite boolean not null default false;

-- Shareable URL: token (URL path) + PIN (shared separately out-of-band)
alter table public.resume_versions
  add column if not exists share_token uuid;
alter table public.resume_versions
  add column if not exists share_pin varchar(6);
create unique index if not exists resume_versions_share_token_idx
  on public.resume_versions(share_token) where share_token is not null;
