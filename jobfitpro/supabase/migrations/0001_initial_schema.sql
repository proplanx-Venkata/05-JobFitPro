-- =============================================================================
-- JobFit Pro — Initial Schema
-- Phase 0: Auth & Storage
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type public.subscription_tier as enum ('free', 'paid');
create type public.resume_status     as enum ('uploading', 'processing', 'ready', 'error');
create type public.jd_source_type    as enum ('pdf', 'docx', 'url');
create type public.output_status     as enum ('pending', 'generating', 'ready', 'error');
create type public.ats_category      as enum ('Excellent', 'Strong', 'Weak');
create type public.interview_status  as enum ('pending', 'in_progress', 'completed', 'aborted');

-- ---------------------------------------------------------------------------
-- HELPER: updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- TABLE: profiles
-- Extends auth.users — one row per user, auto-created by trigger.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid        primary key references auth.users(id) on delete cascade,
  email                 text        not null,
  full_name             text,
  tier                  public.subscription_tier not null default 'free',
  monthly_version_count int         not null default 0 check (monthly_version_count >= 0),
  monthly_reset_at      timestamptz not null default date_trunc('month', now()) + interval '1 month',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- RLS: users can read and update their own profile; insert handled by trigger
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- TRIGGER: auto-create profile on new user signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- TABLE: resumes
-- Master resume — immutable once parsed; soft-deleted via is_active.
-- ---------------------------------------------------------------------------
create table public.resumes (
  id                uuid          primary key default uuid_generate_v4(),
  user_id           uuid          not null references auth.users(id) on delete cascade,
  storage_path      text          not null,
  original_filename text          not null,
  file_size_bytes   int           not null check (file_size_bytes > 0 and file_size_bytes <= 5242880), -- ≤5 MB
  mime_type         text          not null check (mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  page_count        smallint      check (page_count between 1 and 3),
  status            public.resume_status not null default 'uploading',
  parsed_content    jsonb,
  parsed_at         timestamptz,
  is_active         boolean       not null default true,
  replaced_at       timestamptz,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

-- Only one active resume per user (partial unique index enforces this)
create unique index resumes_one_active_per_user
  on public.resumes (user_id)
  where is_active = true;

create index resumes_user_id_is_active_idx
  on public.resumes (user_id, is_active)
  where is_active = true;

alter table public.resumes enable row level security;

create trigger resumes_updated_at
  before update on public.resumes
  for each row execute function public.handle_updated_at();

-- RLS: owner select/insert/update; no client-side delete (soft-delete only)
create policy "resumes: select own"
  on public.resumes for select
  using (auth.uid() = user_id);

create policy "resumes: insert own"
  on public.resumes for insert
  with check (auth.uid() = user_id);

create policy "resumes: update own"
  on public.resumes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- TABLE: job_descriptions
-- ---------------------------------------------------------------------------
create table public.job_descriptions (
  id                uuid        primary key default uuid_generate_v4(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  title             text,
  company           text,
  source_type       public.jd_source_type not null,
  storage_path      text,                                            -- null for URL source
  source_url        text,                                            -- null for file source
  raw_text          text,
  cleaned_text      text,
  page_count        smallint    check (page_count between 1 and 5),
  text_size_bytes   int         check (text_size_bytes <= 51200),    -- ≤50 KB
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index job_descriptions_user_id_created_at_idx
  on public.job_descriptions (user_id, created_at desc);

alter table public.job_descriptions enable row level security;

create trigger job_descriptions_updated_at
  before update on public.job_descriptions
  for each row execute function public.handle_updated_at();

create policy "job_descriptions: select own"
  on public.job_descriptions for select
  using (auth.uid() = user_id);

create policy "job_descriptions: insert own"
  on public.job_descriptions for insert
  with check (auth.uid() = user_id);

create policy "job_descriptions: update own"
  on public.job_descriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "job_descriptions: delete own"
  on public.job_descriptions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- TABLE: resume_versions
-- One JD-specific derived resume per (resume, job_description) pair.
-- ---------------------------------------------------------------------------
create table public.resume_versions (
  id                   uuid        primary key default uuid_generate_v4(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  resume_id            uuid        not null references public.resumes(id) on delete cascade,
  job_description_id   uuid        not null references public.job_descriptions(id) on delete cascade,
  output_storage_path  text,
  output_filename      text,
  status               public.output_status not null default 'pending',
  rewritten_content    jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (resume_id, job_description_id)
);

create index resume_versions_user_id_idx        on public.resume_versions (user_id);
create index resume_versions_resume_id_idx      on public.resume_versions (resume_id);
create index resume_versions_jd_id_idx          on public.resume_versions (job_description_id);

alter table public.resume_versions enable row level security;

create trigger resume_versions_updated_at
  before update on public.resume_versions
  for each row execute function public.handle_updated_at();

create policy "resume_versions: select own"
  on public.resume_versions for select
  using (auth.uid() = user_id);

create policy "resume_versions: insert own"
  on public.resume_versions for insert
  with check (auth.uid() = user_id);

create policy "resume_versions: update own"
  on public.resume_versions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- TABLE: cover_letters
-- ---------------------------------------------------------------------------
create table public.cover_letters (
  id                  uuid        primary key default uuid_generate_v4(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  resume_version_id   uuid        not null references public.resume_versions(id) on delete cascade,
  output_storage_path text,
  status              public.output_status not null default 'pending',
  generated_content   jsonb,
  recruiter_name      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index cover_letters_user_id_idx              on public.cover_letters (user_id);
create index cover_letters_resume_version_id_idx    on public.cover_letters (resume_version_id);

alter table public.cover_letters enable row level security;

create trigger cover_letters_updated_at
  before update on public.cover_letters
  for each row execute function public.handle_updated_at();

create policy "cover_letters: select own"
  on public.cover_letters for select
  using (auth.uid() = user_id);

create policy "cover_letters: insert own"
  on public.cover_letters for insert
  with check (auth.uid() = user_id);

create policy "cover_letters: update own"
  on public.cover_letters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- TABLE: interview_sessions
-- One session per resume_version; captures gap list, Q&A transcript.
-- ---------------------------------------------------------------------------
create table public.interview_sessions (
  id                      uuid        primary key default uuid_generate_v4(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  resume_version_id       uuid        not null references public.resume_versions(id) on delete cascade,
  status                  public.interview_status not null default 'pending',
  identified_gaps         jsonb,
  conversation_transcript jsonb       not null default '[]'::jsonb,
  approved_answers        jsonb,
  question_count          int         not null default 0 check (question_count >= 0 and question_count <= 20),
  started_at              timestamptz,
  completed_at            timestamptz,
  aborted_at              timestamptz,
  abort_reason            text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  unique (resume_version_id)
);

create index interview_sessions_user_id_idx            on public.interview_sessions (user_id);
create index interview_sessions_resume_version_id_idx  on public.interview_sessions (resume_version_id);

alter table public.interview_sessions enable row level security;

create trigger interview_sessions_updated_at
  before update on public.interview_sessions
  for each row execute function public.handle_updated_at();

create policy "interview_sessions: select own"
  on public.interview_sessions for select
  using (auth.uid() = user_id);

create policy "interview_sessions: insert own"
  on public.interview_sessions for insert
  with check (auth.uid() = user_id);

create policy "interview_sessions: update own"
  on public.interview_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- TABLE: ats_scores
-- Immutable once written (no UPDATE policy for clients).
-- ---------------------------------------------------------------------------
create table public.ats_scores (
  id                    uuid        primary key default uuid_generate_v4(),
  user_id               uuid        not null references auth.users(id) on delete cascade,
  resume_version_id     uuid        not null references public.resume_versions(id) on delete cascade,
  overall_score         smallint    not null check (overall_score between 0 and 100),
  category              public.ats_category not null,
  keyword_match_score   smallint    check (keyword_match_score between 0 and 100),
  format_score          smallint    check (format_score between 0 and 100),
  skills_score          smallint    check (skills_score between 0 and 100),
  experience_score      smallint    check (experience_score between 0 and 100),
  missing_keywords      jsonb,
  gap_explanations      jsonb,
  threshold             smallint    not null default 75 check (threshold between 0 and 100),
  passes_threshold      boolean     generated always as (overall_score >= threshold) stored,
  created_at            timestamptz not null default now()
);

create index ats_scores_user_id_idx            on public.ats_scores (user_id);
create index ats_scores_resume_version_id_idx  on public.ats_scores (resume_version_id);

alter table public.ats_scores enable row level security;

create policy "ats_scores: select own"
  on public.ats_scores for select
  using (auth.uid() = user_id);

create policy "ats_scores: insert own"
  on public.ats_scores for insert
  with check (auth.uid() = user_id);

-- No UPDATE policy — scores are immutable once written

-- ---------------------------------------------------------------------------
-- STORAGE BUCKET POLICIES
-- Buckets must be created separately (CLI or Dashboard) as private buckets:
--   supabase storage create resumes --private
--   supabase storage create job-descriptions --private
--   supabase storage create outputs --private
-- Path convention: {user_id}/{entity_id}/filename.ext
-- ---------------------------------------------------------------------------

-- resumes bucket
create policy "storage resumes: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage resumes: owner select"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage resumes: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- job-descriptions bucket
create policy "storage job-descriptions: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'job-descriptions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage job-descriptions: owner select"
  on storage.objects for select
  using (
    bucket_id = 'job-descriptions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage job-descriptions: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'job-descriptions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- outputs bucket — server writes via admin client; clients can only read
create policy "storage outputs: owner select"
  on storage.objects for select
  using (
    bucket_id = 'outputs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- QUOTA HELPER FUNCTIONS
-- ---------------------------------------------------------------------------

-- Total resume_versions count for a user (all time).
-- Used by the API layer, which applies the actual limits via env vars
-- (QUOTA_FREE_LIMIT, QUOTA_PAID_MONTHLY_LIMIT) so limits can be changed
-- without a DB migration.
create or replace function public.get_user_version_count(p_user_id uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
  select count(*)::int
  from public.resume_versions
  where user_id = p_user_id;
$$;
