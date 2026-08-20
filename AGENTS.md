# Auralis — AI Agent Boundary

Auralis uses a shared Supabase **Project Hub**. This repository must be treated as an isolated application even though the Supabase project hosts multiple apps.

## Assigned Supabase application

- Application: `Auralis`
- App slug: `auralis`
- Assigned PostgreSQL schema: `auralis`

## Mandatory first steps before any Supabase write

1. Read `SUPABASE_HUB_RULES.md` in this repository.
2. Read the permanent database notice in `hub.read_me_first`.
3. Verify the `auralis` registry entry in `hub.apps`.
4. Run `select hub.assert_app_scope('auralis', 'auralis');` before structural migrations.
5. Inspect only Auralis-owned schema/resources before changing anything.

If any step cannot be completed, **stop before writing**.

## Allowed application boundary

Normal Auralis database work may modify only:

- `auralis.*`
- Auralis-prefixed Storage buckets
- Auralis-prefixed Edge Functions / RPCs
- Auralis-specific migration metadata explicitly registered by Project Hub

## Protected infrastructure

Treat all of the following as protected unless the user explicitly authorizes an exact Hub-wide change:

- `hub.*`
- `public.*`
- `auth.*`
- `storage.*`
- `realtime.*`
- every other application schema
- project keys and secrets
- project-level Auth/OAuth configuration
- project region, plan, compute, billing, pause/delete settings

## Non-negotiable rules

- Never create Auralis application tables in `public`.
- Never run unscoped destructive SQL.
- Never use `DROP SCHEMA ... CASCADE`.
- Never disable RLS to fix an access problem.
- Never create cross-app foreign keys or dependencies without explicit approval.
- Never expose the project-level Supabase secret/service-role credential to frontend code, GitHub, or ordinary app code.
- Use fully-qualified SQL such as `auralis.playlists`.
- Run Supabase security checks after meaningful schema/RLS changes.

When speed and isolation conflict, choose isolation.
