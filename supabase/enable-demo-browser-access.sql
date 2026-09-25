-- Run this once if schema.sql was applied before browser-demo policies were added.
-- This grants the publishable/anon role access only to the synthetic demo tenant.

grant select on public.organizations to anon;
grant select, insert, update on public.patients, public.appointments to anon;

drop policy if exists "demo visitors read organization" on public.organizations;
create policy "demo visitors read organization" on public.organizations for select to anon
using (id = '00000000-0000-4000-8000-000000000001'::uuid and is_demo = true);

drop policy if exists "demo visitors read synthetic patients" on public.patients;
create policy "demo visitors read synthetic patients" on public.patients for select to anon
using (organization_id = '00000000-0000-4000-8000-000000000001'::uuid and is_synthetic = true);
drop policy if exists "demo visitors create synthetic patients" on public.patients;
create policy "demo visitors create synthetic patients" on public.patients for insert to anon
with check (organization_id = '00000000-0000-4000-8000-000000000001'::uuid and is_synthetic = true);
drop policy if exists "demo visitors update synthetic patients" on public.patients;
create policy "demo visitors update synthetic patients" on public.patients for update to anon
using (organization_id = '00000000-0000-4000-8000-000000000001'::uuid and is_synthetic = true)
with check (organization_id = '00000000-0000-4000-8000-000000000001'::uuid and is_synthetic = true);

drop policy if exists "demo visitors read appointments" on public.appointments;
create policy "demo visitors read appointments" on public.appointments for select to anon
using (organization_id = '00000000-0000-4000-8000-000000000001'::uuid);
drop policy if exists "demo visitors create appointments" on public.appointments;
create policy "demo visitors create appointments" on public.appointments for insert to anon
with check (organization_id = '00000000-0000-4000-8000-000000000001'::uuid);
drop policy if exists "demo visitors update appointments" on public.appointments;
create policy "demo visitors update appointments" on public.appointments for update to anon
using (organization_id = '00000000-0000-4000-8000-000000000001'::uuid)
with check (organization_id = '00000000-0000-4000-8000-000000000001'::uuid);
