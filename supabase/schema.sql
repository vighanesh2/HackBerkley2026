-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
-- Project: https://supabase.com/dashboard/project/_/sql/new

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

create or replace function public.set_drawing_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists drawing_sessions_updated_at on public.drawing_sessions;
create trigger drawing_sessions_updated_at
  before update on public.drawing_sessions
  for each row execute function public.set_drawing_sessions_updated_at();

-- Reference image storage bucket (optional)
insert into storage.buckets (id, name, public)
values ('drawing-references', 'drawing-references', false)
on conflict (id) do nothing;

drop policy if exists "Users upload own drawing references" on storage.objects;
create policy "Users upload own drawing references"
  on storage.objects for insert
  with check (
    bucket_id = 'drawing-references'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users read own drawing references" on storage.objects;
create policy "Users read own drawing references"
  on storage.objects for select
  using (
    bucket_id = 'drawing-references'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
