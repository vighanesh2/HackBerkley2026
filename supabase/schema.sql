-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
-- Project: https://supabase.com/dashboard/project/_/sql/new

create table if not exists public.saved_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  emoji text,
  topic text,
  document jsonb,
  session_state jsonb not null default '{}'::jsonb,
  user_notes text,
  chat_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_courses_user_id_idx on public.saved_courses(user_id);
create index if not exists saved_courses_updated_at_idx on public.saved_courses(updated_at desc);

alter table public.saved_courses enable row level security;

drop policy if exists "Users read own courses" on public.saved_courses;
drop policy if exists "Users insert own courses" on public.saved_courses;
drop policy if exists "Users update own courses" on public.saved_courses;
drop policy if exists "Users delete own courses" on public.saved_courses;

create policy "Users read own courses"
  on public.saved_courses for select
  using (auth.uid() = user_id);

create policy "Users insert own courses"
  on public.saved_courses for insert
  with check (auth.uid() = user_id);

create policy "Users update own courses"
  on public.saved_courses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own courses"
  on public.saved_courses for delete
  using (auth.uid() = user_id);

create or replace function public.set_saved_courses_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists saved_courses_updated_at on public.saved_courses;
create trigger saved_courses_updated_at
  before update on public.saved_courses
  for each row execute function public.set_saved_courses_updated_at();

-- Drawing Coach sessions (optional — in-memory fallback works without this table)
create table if not exists public.drawing_sessions (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  topic text not null,
  reference_image_path text,
  coach_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drawing_sessions_user_id_idx on public.drawing_sessions(user_id);

alter table public.drawing_sessions enable row level security;

drop policy if exists "Users read own drawing sessions" on public.drawing_sessions;
create policy "Users read own drawing sessions"
  on public.drawing_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own drawing sessions" on public.drawing_sessions;
create policy "Users insert own drawing sessions"
  on public.drawing_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own drawing sessions" on public.drawing_sessions;
create policy "Users update own drawing sessions"
  on public.drawing_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for reference diagrams (Dashboard → Storage → New bucket: drawing-references, public)
-- insert into storage.buckets (id, name, public) values ('drawing-references', 'drawing-references', true);
