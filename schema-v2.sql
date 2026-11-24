-- Run after schema.sql. All reads and writes go through the server (service key),
-- so these tables have RLS on and no public policies.

alter table profiles add column if not exists role text not null default 'student'
  check (role in ('student','teacher','admin'));

create table if not exists student_state (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Summary numbers only. Chats are never copied here, so teachers cannot see them.
create table if not exists progress (
  user_id uuid references auth.users on delete cascade,
  profile_id text,
  name text,
  cls text,
  points int default 0,
  quizzes int default 0,
  streak int default 0,
  last_active date,
  primary key (user_id, profile_id)
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users on delete cascade,
  name text not null,
  code text unique not null,
  created_at timestamptz default now()
);

create table if not exists class_members (
  class_id uuid references classes on delete cascade,
  user_id uuid references auth.users on delete cascade,
  joined_at timestamptz default now(),
  primary key (class_id, user_id)
);

alter table student_state enable row level security;
alter table progress enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;

-- To make a teacher account (run in SQL editor, after they sign up once):
-- update profiles set role = 'teacher' where email = 'teacher@school.example';
