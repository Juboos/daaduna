-- Only an admin may change anyone's role (tutors could otherwise promote themselves).
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to re-run.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  if not is_staff() and (new.name_ar is distinct from old.name_ar
     or new.name_ar_tr is distinct from old.name_ar_tr or new.email is distinct from old.email) then
    raise exception 'Only a tutor or admin can change this';
  end if;
  return new;
end $$;
