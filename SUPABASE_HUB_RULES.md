# Supabase Project Hub Rules — Auralis

This repository uses a **shared Supabase Project Hub**. Multiple independent applications live in the same Supabase project, so database isolation is mandatory.

## 1. Auralis ownership boundary

Auralis owns exactly one primary PostgreSQL schema:

```text
auralis
```

Normal application work must stay inside `auralis.*` plus Auralis-prefixed resources explicitly registered to the app.

## 2. Required precondition before database creation

**No Auralis database objects may be created until this file exists in the repository and the Hub control plane has registered the app.**

Before the first Auralis table, function, view, bucket, or policy is created:

1. this file and `AGENTS.md` must exist in the repository;
2. `hub.read_me_first` must be readable;
3. Auralis must be present in `hub.apps` with `slug = schema_name = 'auralis'`;
4. the `auralis` schema must be the only application schema targeted by the migration;
5. `hub.assert_app_scope('auralis', 'auralis')` must succeed.

If any precondition fails, stop.

## 3. Mandatory first read

Before any Supabase write, read:

```sql
select * from hub.read_me_first;
```

Then verify Auralis:

```sql
select slug, display_name, schema_name, status
from hub.apps
where slug = 'auralis';
```

For structural migrations:

```sql
select hub.assert_app_scope('auralis', 'auralis');
```

## 4. Protected schemas / systems

Auralis must not modify another app or shared infrastructure.

Protected by default:

```text
hub.*
public.*
auth.*
storage.*
realtime.*
all other app schemas
```

Shared Auth is consumed through approved Hub membership helpers; never edit `auth.users` directly.

## 5. SQL rules

Always use fully-qualified names:

```sql
alter table auralis.playlists ...;
```

Never rely on ambiguous search paths for destructive or structural SQL.

Forbidden without exact explicit approval:

- `DROP SCHEMA ... CASCADE`
- blanket `GRANT ALL`
- unscoped `DROP`, `TRUNCATE`, `DELETE`, or major `ALTER`
- disabling RLS as a shortcut
- cross-app foreign keys
- project-wide Auth/OAuth/key/region/compute/billing changes

## 6. RLS

Every user-facing Auralis table must have Row Level Security enabled.

Test at minimum:

- anonymous user
- authenticated Auralis user
- different Auralis user
- authenticated user who is not an Auralis member

Frontend checks are never a replacement for RLS.

## 7. Storage

Use only Auralis-prefixed buckets, for example:

```text
auralis-avatars
auralis-playlist-covers
```

Do not use generic shared names such as `uploads`, `images`, or `files`.

## 8. Functions / RPCs

Use Auralis ownership in naming and registration.

Examples:

```text
auralis-recommend
auralis-share-playlist
```

Database functions should live in `auralis` when they are app-specific.

## 9. Secrets

Safe for frontend only when intended:

- Supabase project URL
- current publishable key

Never expose or commit:

- database password
- Supabase secret key
- service-role credential
- third-party private API secrets

The project-level Supabase secret/service-role credential is **Hub-admin infrastructure**, not an Auralis application credential.

## 10. Migrations

Every migration must be clearly Auralis-scoped and should start with the Hub scope assertion after registration.

Recommended naming:

```text
auralis__001_initial_schema.sql
auralis__002_profiles.sql
auralis__003_playlists.sql
```

Before a destructive migration, verify the exact affected schema/object and whether data loss or cross-app impact is possible.

## 11. Validation after structural changes

After meaningful DDL/RLS work:

1. test Auralis behavior;
2. verify no other app schema changed;
3. run Supabase security advisor;
4. review performance advisor when relevant;
5. record the migration/version in the Hub ledger.

## 12. Escalation rule

If a requested Auralis feature requires changing shared Hub infrastructure or another app, stop and ask for explicit approval before proceeding.

> When convenience and isolation conflict, choose isolation.
