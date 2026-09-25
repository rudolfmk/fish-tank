# Supabase setup

1. Create a new Supabase project.
2. Open **SQL Editor → New query**.
3. Paste and run [`schema.sql`](./schema.sql).
4. Create application users through Supabase Authentication.
5. Create your real organization record, then add each authenticated user to
   `organization_members` with the appropriate role.
6. Keep the Supabase `service_role` key in FastAPI only. Never expose it through
   `NEXT_PUBLIC_*` variables.

The migration creates no organizations, patients, appointments, diagnoses, or
other sample clinical records.

Example membership assignment after creating an Auth user:

```sql
insert into public.organization_members (organization_id, user_id, role)
values (
  '<your-organization-uuid>',
  '<auth-user-uuid>',
  'doctor'
);
```

Audio objects belong in the private `clinical-audio` bucket using this path convention:

```text
<organization_uuid>/<encounter_uuid>/<recording_uuid>.webm
```

The current frontend still contains a local preview store. The database schema
does not copy that preview content into Supabase, and anonymous users receive no
access to clinical tables.
