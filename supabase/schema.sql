create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, role text not null default 'student' check(role in ('student','admin')),
  premium_until timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text default '', due_date date not null,
  completed boolean not null default false,
  source text not null default 'manual' check(source in ('manual','moodle')),
  external_id text, created_at timestamptz not null default now(),
  unique(user_id, source, external_id)
);
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text, notify_new boolean not null default true, notify_due boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.moodle_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  moodle_url text not null, token_ciphertext text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(), license_key text unique not null,
  duration_days integer not null check(duration_days in (7,30,360)),
  redeemed_by uuid references auth.users(id) on delete set null, redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.moodle_connections enable row level security;
alter table public.licenses enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email) values(new.id,new.email)
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using(auth.uid()=id);
drop policy if exists "activities self" on public.activities;
create policy "activities self" on public.activities for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "notification self" on public.notification_preferences;
create policy "notification self" on public.notification_preferences for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "moodle self" on public.moodle_connections;
create policy "moodle self" on public.moodle_connections for select using(auth.uid()=user_id);
drop policy if exists "licenses self redeemed" on public.licenses;
create policy "licenses self redeemed" on public.licenses for select using(auth.uid()=redeemed_by);

-- Depois de criar sua conta, torne seu usuário admin:
-- update public.profiles set role='admin' where email='SEU_EMAIL_AQUI';

-- ============================================================
-- ADMINISTRADOR
-- ============================================================
-- Função SECURITY DEFINER para evitar recursão nas políticas RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Admin pode consultar os perfis necessários para o painel.
drop policy if exists "profiles admin read" on public.profiles;
create policy "profiles admin read"
on public.profiles
for select
using (public.is_admin());

-- Admin pode visualizar atividades para as estatísticas do painel.
drop policy if exists "activities admin read" on public.activities;
create policy "activities admin read"
on public.activities
for select
using (public.is_admin());

-- Admin pode consultar telefones/preferências para o painel administrativo.
drop policy if exists "notification admin read" on public.notification_preferences;
create policy "notification admin read"
on public.notification_preferences
for select
using (public.is_admin());
