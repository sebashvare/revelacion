-- =====================================================================
-- Revelación de Género — esquema, RLS y Realtime
-- Ejecutar en Supabase → SQL Editor (una sola vez).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------
create table if not exists public.guest_votes (
  id            uuid        primary key default gen_random_uuid(),
  guest_name    text        not null check (char_length(btrim(guest_name)) between 2 and 60),
  prediction    text        not null check (prediction in ('niño', 'niña')),
  is_attending  boolean     not null default true,
  message       text                 check (char_length(message) <= 280),
  created_at    timestamptz not null default now()
);

-- Un voto por invitado. Es la única defensa real contra el doble voto sin
-- login: el cliente bloquea el botón, pero la BD es quien manda.
-- El error 23505 se traduce a un aviso amable en la UI.
create unique index if not exists guest_votes_name_unique
  on public.guest_votes (lower(btrim(guest_name)));

-- Orden del feed / conteos
create index if not exists guest_votes_created_at_idx
  on public.guest_votes (created_at desc);

-- ---------------------------------------------------------------------
-- 2. Row Level Security
--    Regla: el invitado anónimo SOLO puede insertar y leer.
--    UPDATE y DELETE no tienen política => RLS los niega por defecto.
--    service_role (clave secreta del servidor) ignora RLS: moderación.
-- ---------------------------------------------------------------------
alter table public.guest_votes enable row level security;

drop policy if exists "anon puede votar"          on public.guest_votes;
drop policy if exists "cualquiera puede leer"     on public.guest_votes;

create policy "anon puede votar"
  on public.guest_votes
  for insert
  to anon, authenticated
  with check (
    btrim(guest_name) <> ''
    and prediction in ('niño', 'niña')
  );

-- Necesaria para la barra de resultados Y para que Realtime entregue eventos:
-- Realtime aplica RLS antes de emitir el payload al cliente anónimo.
create policy "cualquiera puede leer"
  on public.guest_votes
  for select
  to anon, authenticated
  using (true);

-- Sin política de UPDATE  → nadie con anon key puede editar votos.
-- Sin política de DELETE  → nadie con anon key puede borrar votos.

-- ---------------------------------------------------------------------
-- 3. Realtime
--    Supabase escucha la replicación lógica de Postgres. Basta con añadir
--    la tabla a la publicación `supabase_realtime`; el cliente se suscribe
--    con .channel(...).on('postgres_changes', { event: 'INSERT', ... }).
--    replica identity full NO hace falta: solo insertamos, y el payload de
--    INSERT ya trae la fila completa.
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.guest_votes;
exception
  when duplicate_object then null;  -- ya estaba publicada
end $$;

-- ---------------------------------------------------------------------
-- 4. Conteo agregado (evita traer 300 filas solo para pintar la barra)
-- ---------------------------------------------------------------------
create or replace function public.vote_tally()
returns table (prediction text, votes bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select prediction, count(*) from public.guest_votes group by prediction;
$$;
