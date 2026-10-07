-- StudyFlow v2: professores, turmas e entregas. Rode DEPOIS do schema.sql.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student','teacher','admin'));
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists teacher_requested boolean not null default false;

-- O papel NUNCA vem do cliente: todo cadastro nasce 'student'.
-- Quem marca "sou professor" só fica com teacher_requested = true até um admin aprovar:
--   update public.profiles set role='teacher' where email='professor@escola.com';
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,teacher_requested)
  values(new.id,new.email,new.raw_user_meta_data->>'full_name',(new.raw_user_meta_data->>'teacher_requested')='true')
  on conflict(id) do update set email=excluded.email;
  -- vincula convites feitos antes do cadastro do aluno
  update public.class_members set student_id=new.id
   where lower(email)=lower(new.email) and student_id is null;
  return new;
end $$;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null, created_at timestamptz not null default now()
);
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null, created_at timestamptz not null default now()
);
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  email text not null, student_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), unique(class_id,email)
);
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null, description text default '', due_date date,
  created_at timestamptz not null default now()
);
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) <= 30000),
  submitted_at timestamptz not null default now(),
  similarity numeric, similar_to uuid references auth.users(id) on delete set null,
  ai_indicator numeric, analysis jsonb,
  unique(assignment_id, student_id)
);
create index if not exists idx_class_members_student on public.class_members(student_id);
create index if not exists idx_assignments_class on public.assignments(class_id);
create index if not exists idx_submissions_assignment on public.submissions(assignment_id);

-- Funções auxiliares (security definer evita recursão nas políticas)
create or replace function public.is_teacher() returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from profiles where id=auth.uid() and role in ('teacher','admin')) $$;
create or replace function public.owns_class(c uuid) returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from classes where id=c and teacher_id=auth.uid()) $$;
create or replace function public.in_class(c uuid) returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from class_members where class_id=c and student_id=auth.uid()) $$;
create or replace function public.owns_assignment(a uuid) returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from assignments x join classes c on c.id=x.class_id where x.id=a and c.teacher_id=auth.uid()) $$;
create or replace function public.assignment_in_my_class(a uuid) returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from assignments x where x.id=a and public.in_class(x.class_id)) $$;

-- Professor adiciona aluno por e-mail (não expõe a lista de usuários)
create or replace function public.add_student(c uuid, student_email text)
returns void language plpgsql security definer set search_path=public as $$
declare e text := lower(trim(student_email));
begin
  if not public.owns_class(c) then raise exception 'Sem permissão nesta turma'; end if;
  insert into class_members(class_id,email,student_id)
  values(c, e, (select id from profiles where lower(email)=e and role='student'))
  on conflict (class_id,email) do nothing;
end $$;

alter table public.subjects enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

create policy "subjects teacher" on public.subjects for all
  using (teacher_id=auth.uid() and public.is_teacher()) with check (teacher_id=auth.uid() and public.is_teacher());
create policy "subjects student read" on public.subjects for select
  using (exists(select 1 from public.classes c where c.subject_id=subjects.id and public.in_class(c.id)));

create policy "classes teacher" on public.classes for all
  using (teacher_id=auth.uid() and public.is_teacher()) with check (teacher_id=auth.uid() and public.is_teacher());
create policy "classes student read" on public.classes for select using (public.in_class(id));

create policy "members teacher" on public.class_members for all
  using (public.owns_class(class_id)) with check (public.owns_class(class_id));
create policy "members self read" on public.class_members for select using (student_id=auth.uid());

create policy "assignments teacher" on public.assignments for all
  using (public.owns_class(class_id)) with check (public.owns_class(class_id));
create policy "assignments student read" on public.assignments for select using (public.in_class(class_id));

create policy "submissions student read" on public.submissions for select using (student_id=auth.uid());
create policy "submissions student insert" on public.submissions for insert
  with check (student_id=auth.uid() and public.assignment_in_my_class(assignment_id));
create policy "submissions student update" on public.submissions for update
  using (student_id=auth.uid()) with check (student_id=auth.uid());
create policy "submissions teacher read" on public.submissions for select using (public.owns_assignment(assignment_id));

-- Aluno só escreve o texto: nunca as notas de análise.
revoke insert, update on public.submissions from authenticated;
grant insert (assignment_id, student_id, content), update (content) on public.submissions to authenticated;

-- Reenvio: zera a análise antiga e atualiza a data de entrega
create or replace function public.reset_analysis() returns trigger language plpgsql as $$
begin
  new.submitted_at := now(); new.similarity := null; new.similar_to := null;
  new.ai_indicator := null; new.analysis := null; return new;
end $$;
drop trigger if exists submissions_reset on public.submissions;
create trigger submissions_reset before update of content on public.submissions
  for each row execute function public.reset_analysis();

-- Professor lê o perfil dos alunos das próprias turmas
create policy "profiles teacher read members" on public.profiles for select using (
  exists(select 1 from public.class_members m join public.classes c on c.id=m.class_id
         where m.student_id=profiles.id and c.teacher_id=auth.uid()));
