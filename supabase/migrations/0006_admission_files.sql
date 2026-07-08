-- 0006_admission_files.sql — attach files to an admission (not just a visit)

alter table media add column if not exists admission_id uuid references admission(id) on delete cascade;
create index if not exists media_admission_id_idx on media (admission_id);

alter table medical_image add column if not exists admission_id uuid references admission(id) on delete cascade;
create index if not exists medical_image_admission_id_idx on medical_image (admission_id);
-- an image may now belong to an admission instead of a visit
alter table medical_image alter column visit_id drop not null;

-- external read: allow access via the image's admission (in addition to its visit)
drop policy if exists img_external_read on medical_image;
create policy img_external_read on medical_image for select
  using (
    exists (
      select 1 from visit v join patient p on p.id = v.patient_id
      where v.id = medical_image.visit_id and (
        (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
        or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
      )
    )
    or exists (
      select 1 from admission a join patient p on p.id = a.patient_id
      where a.id = medical_image.admission_id and (
        (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
        or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
      )
    )
  );
