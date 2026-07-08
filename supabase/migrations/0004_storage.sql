-- 0004_storage.sql — private bucket for patient files + staff access

insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

-- staff can do everything in this bucket; external roles get NO direct object
-- access here (Plan 05 serves them via server-minted signed URLs).
create policy "patient_files_staff_all"
on storage.objects for all
to authenticated
using (bucket_id = 'patient-files' and public.current_role_name() = 'staff')
with check (bucket_id = 'patient-files' and public.current_role_name() = 'staff');
