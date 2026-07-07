-- 0003_rls_policies.sql — RLS enforcing staff/referring_vet/owner scoped access

alter table referring_hospital enable row level security;
alter table owner enable row level security;
alter table patient enable row level security;
alter table visit enable row level security;
alter table drug enable row level security;
alter table prescription enable row level security;
alter table medical_image enable row level security;
alter table media enable row level security;
alter table admission enable row level security;
alter table vital enable row level security;
alter table profile enable row level security;
alter table invite enable row level security;

-- profile: a user can read their own profile; staff can read all
create policy profile_self_read on profile for select
  using (id = auth.uid() or current_role_name() = 'staff');
create policy profile_staff_write on profile for all
  using (current_role_name() = 'staff')
  with check (current_role_name() = 'staff');

-- staff-only reference tables (+ scoped external read)
create policy hospital_staff_all on referring_hospital for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy hospital_vet_read on referring_hospital for select
  using (current_role_name() = 'referring_vet' and id = current_hospital_id());

create policy owner_staff_all on owner for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy owner_self_read on owner for select
  using (current_role_name() = 'owner' and id = current_owner_id());

create policy drug_staff_all on drug for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy drug_external_read on drug for select
  using (exists (
    select 1 from prescription pr join visit v on v.id = pr.visit_id
      join patient p on p.id = v.patient_id
    where pr.drug_id = drug.id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- patient: staff all; external scoped read
create policy patient_staff_all on patient for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy patient_vet_read on patient for select
  using (current_role_name() = 'referring_vet' and referring_hospital_id = current_hospital_id());
create policy patient_owner_read on patient for select
  using (current_role_name() = 'owner' and owner_id = current_owner_id());

-- visit (child of patient)
create policy visit_staff_all on visit for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy visit_external_read on visit for select
  using (exists (
    select 1 from patient p where p.id = visit.patient_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- prescription (child of visit)
create policy rx_staff_all on prescription for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy rx_external_read on prescription for select
  using (exists (
    select 1 from visit v join patient p on p.id = v.patient_id
    where v.id = prescription.visit_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- medical_image (child of visit)
create policy img_staff_all on medical_image for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy img_external_read on medical_image for select
  using (exists (
    select 1 from visit v join patient p on p.id = v.patient_id
    where v.id = medical_image.visit_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- media (child of patient)
create policy media_staff_all on media for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy media_external_read on media for select
  using (exists (
    select 1 from patient p where p.id = media.patient_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- admission (child of patient)
create policy adm_staff_all on admission for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy adm_external_read on admission for select
  using (exists (
    select 1 from patient p where p.id = admission.patient_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- vital (child of admission -> patient)
create policy vital_staff_all on vital for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy vital_external_read on vital for select
  using (exists (
    select 1 from admission a join patient p on p.id = a.patient_id
    where a.id = vital.admission_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- invite: staff only
create policy invite_staff_all on invite for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
