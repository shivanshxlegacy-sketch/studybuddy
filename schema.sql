-- Run this in the Supabase SQL editor.
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free','pro')),
  stripe_customer text,
  parent_email text,
  created_at timestamptz default now()
);

create table if not exists usage (
  user_id uuid references auth.users on delete cascade,
  day date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table profiles enable row level security;
alter table usage enable row level security;

-- Users can read their own profile. Only the server (service key) changes plans.
create policy "read own profile" on profiles for select using (auth.uid() = id);

create or replace function increment_usage(uid uuid, d date) returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into usage (user_id, day, count) values (uid, d, 1)
  on conflict (user_id, day) do update set count = usage.count + 1
  returning count into c;
  return c;
end $$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();
