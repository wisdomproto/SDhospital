-- 0001_core_schema.sql — core EMR tables

create extension if not exists "pgcrypto";

create table referring_hospital (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  created_at timestamptz not null default now()
);

create table owner (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  created_at timestamptz not null default now()
);

create table patient (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owner(id) on delete restrict,
  referring_hospital_id uuid references referring_hospital(id) on delete set null,
  name text not null,
  species text,
  breed text,
  sex text,
  birth_date date,
  note text,
  created_at timestamptz not null default now()
);
create index on patient (owner_id);
create index on patient (referring_hospital_id);

create table visit (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  visit_date date not null default current_date,
  visit_no int,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on visit (patient_id);

create table drug (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text,
  spec text,
  note text,
  created_at timestamptz not null default now()
);

create table prescription (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visit(id) on delete cascade,
  drug_id uuid not null references drug(id) on delete restrict,
  dose text,
  frequency text,
  duration text,
  note text
);
create index on prescription (visit_id);

create table medical_image (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visit(id) on delete cascade,
  modality text check (modality in ('xray','mri','ct','other')),
  storage_path text not null,
  file_name text,
  uploaded_at timestamptz not null default now()
);
create index on medical_image (visit_id);

create table media (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  visit_id uuid references visit(id) on delete set null,
  kind text,
  storage_path text not null,
  file_name text,
  uploaded_at timestamptz not null default now()
);
create index on media (patient_id);

create table admission (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  admitted_at date not null default current_date,
  discharged_at date,
  status text not null default 'admitted' check (status in ('admitted','discharged')),
  note text
);
create index on admission (patient_id);

create table vital (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admission(id) on delete cascade,
  measured_at timestamptz not null default now(),
  temperature numeric,
  heart_rate int,
  resp_rate int,
  systolic int,
  diastolic int,
  note text,
  recorded_by uuid references auth.users(id)
);
create index on vital (admission_id);

create table profile (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('staff','referring_vet','owner')),
  referring_hospital_id uuid references referring_hospital(id),
  owner_id uuid references owner(id),
  name text,
  created_at timestamptz not null default now()
);

create table invite (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  role text not null check (role in ('referring_vet','owner')),
  owner_id uuid references owner(id),
  referring_hospital_id uuid references referring_hospital(id),
  expires_at timestamptz,
  used boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
