-- Daaduna: initial schema, row-level security, triggers and storage.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: everything is created only if missing.

-- ───────────── People and roles ─────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name_en text not null default '',
  name_ar text,
  name_ar_tr text,
  role text not null default 'student' check (role in ('student', 'tutor', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('tutor', 'admin'))
$$;

-- New auth user → profile. The very first account becomes admin (you); everyone after is a student.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name_en, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name_en', ''),
          case when exists (select 1 from profiles) then 'student' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Students may edit their English name only; role and Arabic name are set by staff.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() and (new.role is distinct from old.role or new.name_ar is distinct from old.name_ar
     or new.name_ar_tr is distinct from old.name_ar_tr or new.email is distinct from old.email) then
    raise exception 'Only a tutor or admin can change this';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on profiles;
create trigger guard_profile before update on profiles for each row execute function public.guard_profile();

create table if not exists public.user_settings (
  user_id uuid primary key references profiles on delete cascade,
  data jsonb not null default '{}'
);

-- ───────────── Progress (a reset closes the run and opens a new one) ─────────────
create table if not exists public.path_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create table if not exists public.lesson_progress (
  run_id uuid not null references path_runs on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  lesson_id text not null,
  status text not null check (status in ('in_progress', 'completed')),
  last_slide int not null default 0,
  completed_at timestamptz,
  primary key (run_id, lesson_id)
);
create table if not exists public.exercise_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles on delete cascade,
  run_id uuid not null references path_runs on delete cascade,
  lesson_id text not null,
  exercise_id text not null,
  type text not null,
  correct boolean,
  response jsonb,
  at timestamptz not null default now()
);

-- ───────────── Submissions, feedback, notifications ─────────────
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  run_id uuid references path_runs on delete set null,   -- history survives a reset
  lesson_id text not null,
  exercise_id text not null,
  kind text not null check (kind in ('sheet', 'recording')),
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'needs_redo')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  self_rating text,
  duration_ms int,
  mime text,
  target text
);
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions on delete cascade,
  reviewer_id uuid not null references profiles,
  reviewer_name text not null default '',
  note text not null default '',
  annotations jsonb not null default '{}',
  status text not null check (status in ('reviewed', 'needs_redo')),
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  kind text not null check (kind in ('submission', 'feedback')),
  ref_id uuid not null,
  text text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
-- Emails wait here; an Edge Function with Resend will send them once a domain is set up.
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- New submission → notify every tutor/admin (in-app + email).
create or replace function public.on_submission() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; r record;
begin
  select name_en into who from profiles where id = new.user_id;
  for r in select id, email from profiles where role in ('tutor', 'admin') loop
    insert into notifications (user_id, kind, ref_id, text)
    values (r.id, 'submission', new.id, coalesce(who, 'A student') || ' sent ' ||
      case when new.kind = 'sheet' then 'a writing sheet' else 'a recording' end || ': ' || new.title);
    insert into email_outbox (to_email, subject, body)
    values (r.email, 'New ' || new.kind || ' to review from ' || coalesce(who, 'a student'),
      coalesce(who, 'A student') || ' submitted "' || new.title || '" (' || new.lesson_id || '). Open the review queue to give feedback.');
  end loop;
  return new;
end $$;
drop trigger if exists on_submission on submissions;
create trigger on_submission after insert on submissions for each row execute function public.on_submission();

-- New feedback → update the submission's status and notify the student.
create or replace function public.on_feedback() returns trigger
language plpgsql security definer set search_path = public as $$
declare s submissions; msg text; mail text;
begin
  update submissions set status = new.status, reviewed_at = new.created_at where id = new.submission_id returning * into s;
  select email into mail from profiles where id = s.user_id;
  msg := case when new.status = 'needs_redo' then 'Please try "' || s.title || '" again. Your tutor left a note.'
              else 'Your tutor reviewed "' || s.title || '".' end;
  insert into notifications (user_id, kind, ref_id, text) values (s.user_id, 'feedback', s.id, msg);
  insert into email_outbox (to_email, subject, body)
  values (mail, msg, case when new.note = '' then 'Open Daaduna to see the feedback on your work.' else new.note end);
  return new;
end $$;
drop trigger if exists on_feedback on feedback;
create trigger on_feedback after insert on feedback for each row execute function public.on_feedback();

-- ───────────── Row-level security ─────────────
alter table profiles enable row level security;
alter table user_settings enable row level security;
alter table path_runs enable row level security;
alter table lesson_progress enable row level security;
alter table exercise_attempts enable row level security;
alter table submissions enable row level security;
alter table feedback enable row level security;
alter table notifications enable row level security;
alter table email_outbox enable row level security;

drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select using (id = auth.uid() or is_staff());
drop policy if exists "profiles update" on profiles;
create policy "profiles update" on profiles for update using (id = auth.uid() or is_staff());

drop policy if exists "settings own" on user_settings;
create policy "settings own" on user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "runs own" on path_runs;
create policy "runs own" on path_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "runs staff" on path_runs;
create policy "runs staff" on path_runs for select using (is_staff());

drop policy if exists "progress own" on lesson_progress;
create policy "progress own" on lesson_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "progress staff" on lesson_progress;
create policy "progress staff" on lesson_progress for select using (is_staff());

drop policy if exists "attempts own" on exercise_attempts;
create policy "attempts own" on exercise_attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "attempts staff" on exercise_attempts;
create policy "attempts staff" on exercise_attempts for select using (is_staff());

drop policy if exists "submissions read" on submissions;
create policy "submissions read" on submissions for select using (user_id = auth.uid() or is_staff());
drop policy if exists "submissions insert" on submissions;
create policy "submissions insert" on submissions for insert with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "feedback read" on feedback;
create policy "feedback read" on feedback for select
  using (is_staff() or exists (select 1 from submissions s where s.id = submission_id and s.user_id = auth.uid()));
drop policy if exists "feedback insert" on feedback;
create policy "feedback insert" on feedback for insert with check (is_staff() and reviewer_id = auth.uid());

drop policy if exists "notifications own" on notifications;
create policy "notifications own" on notifications for select using (user_id = auth.uid());
drop policy if exists "notifications mark read" on notifications;
create policy "notifications mark read" on notifications for update using (user_id = auth.uid());

drop policy if exists "outbox staff" on email_outbox;
create policy "outbox staff" on email_outbox for select using (is_staff());

-- ───────────── Storage: recordings and sheets (private) ─────────────
insert into storage.buckets (id, name, public) values ('submissions', 'submissions', false) on conflict (id) do nothing;
-- Files live at <user id>/<submission id>/<file>. Students upload into their own folder; staff can read all.
drop policy if exists "submission files upload" on storage.objects;
create policy "submission files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "submission files read" on storage.objects;
create policy "submission files read" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ───────────── Live updates for the bell and the review queue ─────────────
do $$ begin
  alter publication supabase_realtime add table notifications, submissions, feedback;
exception when duplicate_object then null; end $$;
