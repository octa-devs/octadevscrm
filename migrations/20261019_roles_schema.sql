-- ==========================================================================
-- Roles & permissions table for the OCTA DEVS CRM.
-- Run this once in the Supabase SQL editor (before or after the role code
-- ships — the CRM falls back to its built-in mapping until this exists).
-- ==========================================================================

create table if not exists public.roles (
  key         text primary key,
  name        text not null,
  description text not null default '',
  permissions text[] not null default '{}',
  is_builtin  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- What each built-in role can do. super_admin is excluded on purpose: in the
-- app it always means "everything", so it has no stored permission list.
insert into public.roles (key, name, description, permissions, is_builtin) values
  ('admin',
   'Admin',
   'Runs the CRM, chats with visitors and the team, and publishes website content.',
   array['crm.read', 'crm.write', 'chat.inbox', 'chat.team', 'website.manage'],
   true),
  ('employee',
   'Employee',
   'Works the CRM and both chats. Add more permissions from the Roles page when needed.',
   array['crm.read', 'crm.write', 'chat.inbox', 'chat.team'],
   true)
on conflict (key) do nothing;

-- Anyone signed in may read the role list (the People dropdown needs it).
-- Writes go through the CRM API only, which checks roles.manage — so no
-- authenticated write policy exists, on purpose.
alter table public.roles enable row level security;

drop policy if exists "authenticated can read roles" on public.roles;
create policy "authenticated can read roles"
  on public.roles
  for select
  to authenticated
  using (true);

-- ==========================================================================
-- DONE. Custom roles are created from the portal: People -> next to Website
-- (admin panel) there is now a "Roles" page for super users.
-- ==========================================================================
