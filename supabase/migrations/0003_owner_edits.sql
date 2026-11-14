-- 1. The profile guard applies only to people using the app. You, in the Supabase dashboard
--    (Table Editor or SQL Editor), can change roles, Arabic names and anything else freely.
-- 2. Deleting a tutor/admin account keeps their feedback (the reviewer's name stays on it)
--    instead of failing with "still referenced from table feedback".
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to re-run.

-- (Also defined in 0002; repeated so this script works on its own.)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Dashboard and server-side edits carry no app login: allow everything.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  if not is_staff() and (new.name_ar is distinct from old.name_ar
     or new.name_ar_tr is distinct from old.name_ar_tr or new.email is distinct from old.email) then
    raise exception 'Only a tutor or admin can change this';
  end if;
  return new;
end $$;

alter table public.feedback alter column reviewer_id drop not null;
alter table public.feedback drop constraint if exists feedback_reviewer_id_fkey;
alter table public.feedback add constraint feedback_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles (id) on delete set null;
