-- ============================================================
-- Chorus — database schema backup
-- Reconstructed from live Supabase project trijworqombajiutmfcx
-- Captured: 2026-08-31
--
-- This file recreates structure only (no row data).
-- Run against a fresh Postgres/Supabase project to rebuild.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists pg_cron;

-- ---------- Enum types ----------
create type assignment_type   as enum ('dedicated', 'alternating', 'adhoc');
create type chore_freq        as enum ('daily', 'weekly', 'monthly');
create type monthly_mode      as enum ('day_of_month', 'nth_weekday');
create type occurrence_status as enum ('open', 'done', 'skipped');
create type activity_action   as enum (
  'completed', 'skipped', 'deferred', 'handed_off',
  'chore_created', 'chore_updated', 'chore_archived', 'member_joined'
);

-- ---------- Tables ----------

create table households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  auth_user_id uuid references auth.users(id),
  email        text not null check (position('@' in email) > 1),
  display_name text not null check (length(trim(display_name)) > 0),
  colour       text not null default '#1D9E75',
  joined_at    timestamptz not null default now()
);

-- NOTE: auth_user_id is deliberately NOT unique — one auth user may
-- belong to multiple households (multi-household support).
create index members_auth_user_idx on members (auth_user_id);
create index members_household_idx on members (household_id);
create unique index members_household_email_idx on members (household_id, lower(email));

create table chores (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references households(id) on delete cascade,
  name                text not null check (length(trim(name)) > 0),
  assignment          assignment_type not null,
  dedicated_member_id uuid references members(id),
  next_in_rotation    uuid references members(id),
  weight              integer not null default 1 check (weight in (1, 2, 3, 5)),
  anchor_date         date not null default current_date,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  freq                chore_freq not null default 'weekly',
  interval_n          integer not null default 1 check (interval_n between 1 and 60),
  byweekday           smallint[] not null default '{}',
  monthly_pattern     monthly_mode,
  room                text check (room is null or length(trim(room)) between 1 and 40),
  notes               text check (notes is null or length(notes) <= 500)
);

create index chores_household_idx on chores (household_id) where archived_at is null;
create index chores_room_idx on chores (household_id, room) where archived_at is null;

create table rotation_members (
  chore_id  uuid not null references chores(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  position  integer not null,
  primary key (chore_id, member_id)
);

create unique index rotation_members_position_idx on rotation_members (chore_id, position);

create table occurrences (
  id                   uuid primary key default gen_random_uuid(),
  chore_id             uuid not null references chores(id) on delete cascade,
  due_on               date not null,
  original_due_on      date not null,
  assigned_member_id   uuid references members(id),
  override_member_id   uuid references members(id),
  status               occurrence_status not null default 'open',
  completed_by         uuid references members(id),
  completed_at         timestamptz,
  weight_at_completion integer,
  credited_members     uuid[],
  created_at           timestamptz not null default now()
);

create unique index occurrences_chore_slot_idx on occurrences (chore_id, original_due_on);
create index occurrences_chore_recent_idx on occurrences (chore_id, original_due_on desc);
create index occurrences_open_due_idx on occurrences (due_on) where status = 'open';

create table activity (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  occurrence_id   uuid references occurrences(id) on delete set null,
  actor_member_id uuid references members(id),
  action          activity_action not null,
  detail          jsonb,
  created_at      timestamptz not null default now()
);

create index activity_household_recent_idx on activity (household_id, created_at desc);

-- ============================================================
-- Functions
-- ============================================================

-- Returns the household ids the current auth user belongs to.
-- Used by every RLS policy below.
CREATE OR REPLACE FUNCTION public.my_household_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select household_id from members where auth_user_id = auth.uid()
$function$;

-- Core recurrence engine: given a schedule and a cursor date,
-- returns the next matching date (or null after ~800 days).
CREATE OR REPLACE FUNCTION public.chorus_next_date(p_freq chore_freq, p_interval integer, p_byweekday smallint[], p_monthly monthly_mode, p_anchor date, p_after date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  d date;
  i int;
  m int;
  target int;
  anchor_nth int;
begin
  if p_after is null then
    d := p_anchor;
  else
    d := p_after + 1;
  end if;

  if d < p_anchor then
    d := p_anchor;
  end if;

  anchor_nth := ceil(extract(day from p_anchor) / 7.0);

  for i in 0..799 loop
    if p_freq = 'daily' then
      if (d - p_anchor) % p_interval = 0 then
        return d;
      end if;

    elsif p_freq = 'weekly' then
      if extract(dow from d)::smallint = any (p_byweekday) then
        if ((((d - extract(dow from d)::int) - (p_anchor - extract(dow from p_anchor)::int)) / 7)
              % p_interval) = 0 then
          return d;
        end if;
      end if;

    else
      m := (extract(year from d)::int - extract(year from p_anchor)::int) * 12
           + (extract(month from d)::int - extract(month from p_anchor)::int);

      if m >= 0 and m % p_interval = 0 then
        if p_monthly = 'nth_weekday' then
          if extract(dow from d) = extract(dow from p_anchor) then
            if anchor_nth >= 5 then
              if date_trunc('month', (d + 7)::timestamp) <> date_trunc('month', d::timestamp) then
                return d;
              end if;
            elsif ceil(extract(day from d) / 7.0) = anchor_nth then
              return d;
            end if;
          end if;
        else
          target := least(
            extract(day from p_anchor)::int,
            extract(day from (date_trunc('month', d::timestamp) + interval '1 month - 1 day'))::int
          );
          if extract(day from d)::int = target then
            return d;
          end if;
        end if;
      end if;
    end if;

    d := d + 1;
  end loop;

  return null;
end;
$function$;

-- Creates one open occurrence for every active chore that has none.
-- NOTE: generates a single occurrence ahead per chore, not a date horizon.
CREATE OR REPLACE FUNCTION public.sync_all_occurrences()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  v_last date;
  v_due date;
  v_assigned uuid;
  v_made int := 0;
begin
  for c in
    select ch.id, ch.assignment, ch.dedicated_member_id, ch.next_in_rotation,
           ch.freq, ch.interval_n, ch.byweekday, ch.monthly_pattern, ch.anchor_date
      from chores ch
     where ch.archived_at is null
       and not exists (
             select 1 from occurrences o
              where o.chore_id = ch.id and o.status = 'open'
           )
  loop
    select max(original_due_on) into v_last
      from occurrences where chore_id = c.id;

    v_due := chorus_next_date(
      c.freq, c.interval_n, c.byweekday, c.monthly_pattern, c.anchor_date, v_last
    );

    if v_due is null then
      continue;
    end if;

    v_assigned := case c.assignment
                    when 'dedicated' then c.dedicated_member_id
                    when 'alternating' then c.next_in_rotation
                    else null
                  end;

    insert into occurrences (chore_id, due_on, original_due_on, assigned_member_id)
    values (c.id, v_due, v_due, v_assigned)
    on conflict (chore_id, original_due_on) do nothing;

    v_made := v_made + 1;
  end loop;

  return v_made;
end;
$function$;

-- Creates a household plus its first member, called at onboarding.
CREATE OR REPLACE FUNCTION public.create_household(p_household_name text, p_display_name text, p_colour text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_household uuid;
  v_member uuid;
begin
  if v_user is null then
    raise exception 'You are not signed in.';
  end if;

  select email into v_email from auth.users where id = v_user;

  insert into households (name)
  values (trim(p_household_name))
  returning id into v_household;

  insert into members (household_id, auth_user_id, email, display_name, colour)
  values (v_household, v_user, v_email, trim(p_display_name), p_colour)
  returning id into v_member;

  insert into activity (household_id, actor_member_id, action)
  values (v_household, v_member, 'member_joined');

  return v_household;
end;
$function$;

-- Trigger function: links a pre-invited member row to a new auth user.
CREATE OR REPLACE FUNCTION public.link_member_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update members
     set auth_user_id = new.id
   where auth_user_id is null
     and lower(email) = lower(new.email);

  insert into activity (household_id, actor_member_id, action)
  select m.household_id, m.id, 'member_joined'
    from members m
   where m.auth_user_id = new.id;

  return new;
end;
$function$;

-- Trigger on auth.users. Must be created by a role with rights on the auth schema.
create trigger link_member_on_signup_trigger
  after insert on auth.users
  for each row execute function public.link_member_on_signup();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table households      enable row level security;
alter table members         enable row level security;
alter table chores          enable row level security;
alter table rotation_members enable row level security;
alter table occurrences     enable row level security;
alter table activity        enable row level security;

create policy households_select on households for select to authenticated
  using (id in (select my_household_ids()));

create policy households_update on households for update to authenticated
  using (id in (select my_household_ids()))
  with check (id in (select my_household_ids()));

create policy members_select on members for select to authenticated
  using (household_id in (select my_household_ids()));

create policy members_insert on members for insert to authenticated
  with check (household_id in (select my_household_ids()));

create policy members_update on members for update to authenticated
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

-- A member cannot remove themselves.
create policy members_delete on members for delete to authenticated
  using (household_id in (select my_household_ids())
         and auth_user_id is distinct from auth.uid());

create policy chores_all on chores for all to authenticated
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

create policy rotation_members_all on rotation_members for all to authenticated
  using (chore_id in (select id from chores where household_id in (select my_household_ids())))
  with check (chore_id in (select id from chores where household_id in (select my_household_ids())));

create policy occurrences_all on occurrences for all to authenticated
  using (chore_id in (select id from chores where household_id in (select my_household_ids())))
  with check (chore_id in (select id from chores where household_id in (select my_household_ids())));

create policy activity_select on activity for select to authenticated
  using (household_id in (select my_household_ids()));

create policy activity_insert on activity for insert to authenticated
  with check (household_id in (select my_household_ids()));

create policy activity_delete on activity for delete to authenticated
  using (household_id in (select my_household_ids()));

-- ============================================================
-- Scheduled jobs
-- ============================================================

-- Runs hourly at 7 minutes past the hour.
select cron.schedule(
  'sync_all_occurrences',
  '7 * * * *',
  $$select public.sync_all_occurrences()$$
);
