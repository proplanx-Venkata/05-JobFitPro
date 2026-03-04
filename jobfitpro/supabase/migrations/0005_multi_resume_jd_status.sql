-- Migration 0005: Multi-resume profiles + JD status tracking
-- Apply manually in Supabase Dashboard → SQL Editor

-- ── Resumes: drop old single-active constraint ────────────────────────────
drop index if exists public.resumes_one_active_per_user;

-- ── Resumes: new columns ──────────────────────────────────────────────────
alter table public.resumes
  add column if not exists label text,
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists is_promoted boolean not null default false,
  add column if not exists promoted_from_version_id uuid
    references public.resume_versions(id) on delete set null;

-- ── Resumes: recreate unique index (one active non-archived per user) ─────
create unique index resumes_one_active_per_user
  on public.resumes (user_id)
  where is_active = true and is_archived = false;

-- ── JD application status enum ────────────────────────────────────────────
do $$ begin
  create type public.jd_application_status as enum (
    'saved','applied','phone_screen','interview','offer','rejected','withdrawn'
  );
exception
  when duplicate_object then null;
end $$;

-- ── Job descriptions: new columns ─────────────────────────────────────────
alter table public.job_descriptions
  add column if not exists status text not null default 'ready'
    check (status in ('processing','ready','error')),
  add column if not exists application_status public.jd_application_status not null default 'saved',
  add column if not exists notes text,
  add column if not exists applied_at timestamptz;
