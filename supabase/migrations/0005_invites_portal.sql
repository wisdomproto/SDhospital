-- 0005_invites_portal.sql — invite preview/redeem functions + storage external read

-- Preview an invite (safe for anon): role, a display label, and validity.
create or replace function invite_target(p_token text)
returns table(role text, label text, valid boolean)
language sql stable security definer set search_path = public as $$
  select i.role,
         coalesce(o.name, h.name, '') as label,
         (not i.used and (i.expires_at is null or i.expires_at > now())) as valid
  from invite i
  left join owner o on o.id = i.owner_id
  left join referring_hospital h on h.id = i.referring_hospital_id
  where i.token = p_token
$$;
grant execute on function invite_target(text) to anon, authenticated;

-- Atomically create a scoped read-only account and consume the invite.
create or replace function redeem_invite(p_token text, p_email text, p_password text)
returns void
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
  inv public.invite;
  new_id uuid := gen_random_uuid();
begin
  select * into inv from public.invite where token = p_token;
  if inv.id is null then raise exception 'invalid_invite'; end if;
  if inv.used then raise exception 'invite_used'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'invite_expired'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'weak_password'; end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'email_taken';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', false, false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    new_id::text, new_id,
    jsonb_build_object('sub', new_id::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profile (id, role, owner_id, referring_hospital_id, name)
  values (new_id, inv.role, inv.owner_id, inv.referring_hospital_id, null);

  update public.invite set used = true where id = inv.id;
end;
$$;
grant execute on function redeem_invite(text, text, text) to anon, authenticated;

-- Storage: allow an external role to READ (and therefore sign) objects that
-- belong to a patient they are allowed to see. Path shape:
--   images/{patientId}/{visitId}/...   or   media/{patientId}/{visitId}/...
create or replace function can_read_patient_file(object_name text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare pid uuid;
begin
  if public.current_role_name() = 'staff' then
    return true;
  end if;
  begin
    pid := nullif(split_part(object_name, '/', 2), '')::uuid;
  exception when others then
    return false;
  end;
  if pid is null then return false; end if;
  return exists (
    select 1 from public.patient p
    where p.id = pid and (
      (public.current_role_name() = 'referring_vet' and p.referring_hospital_id = public.current_hospital_id())
      or (public.current_role_name() = 'owner' and p.owner_id = public.current_owner_id())
    )
  );
end;
$$;

create policy "patient_files_external_read"
on storage.objects for select
to authenticated
using (bucket_id = 'patient-files' and public.can_read_patient_file(name));
