-- 0027_image_request.sql — 의료영상은 요청해야 나간다
--
-- 원장님들 요구다. X-ray·CT·MRI 를 **판독 소견 없이** 보호자에게 그냥 띄우면
-- 보호자가 스스로 해석한다. 이미 있는 규칙("판독 소견은 보여주지 않는다")과
-- 같은 이유이고, 영상 자체가 빠져 있던 것이다.
--
-- ⚠️ **의료영상(`medical_image`)만 해당한다.** `media`(아이 사진·진료 중 영상)는
-- 그대로 나간다 — 그건 안심시키려고 보내는 것이고, 앱의 존재 이유다.
--
-- 흐름은 이미 있는 원칙을 그대로 따른다 — **발송은 사람이 누를 때만.**
--   보호자가 요청 → 직원 "오늘 할 일"에 뜸 → 직원이 승인 → 그때 보인다.
create table image_request (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references visit(id) on delete cascade,
  requested_at timestamptz not null default now(),
  approved_at  timestamptz,
  approved_by  uuid references auth.users(id),
  -- 한 회차에 요청은 하나. 여러 번 눌러도 목록이 불어나지 않는다.
  unique (visit_id)
);
create index image_request_pending_idx on image_request (requested_at) where approved_at is null;

alter table image_request enable row level security;

create policy "image_request_staff_all" on image_request for all to authenticated
using (public.current_role_name() = 'staff')
with check (public.current_role_name() = 'staff');

-- 보호자는 **자기 아이의 요청 상태만 읽는다.** 쓰기는 아래 DEFINER 함수로만 —
-- ⚠️ 생활기록과 달리 정책만으로는 안 된다. 이 행은 직원 작업 큐에 들어가고,
--    `approved_at` 을 보호자가 건드리면 승인 없이 영상이 열린다.
create policy "image_request_owner_read" on image_request for select to authenticated
using (
  public.current_role_name() = 'owner'
  and exists (
    select 1 from visit v join patient p on p.id = v.patient_id
     where v.id = image_request.visit_id and p.owner_id = public.current_owner_id()
  )
);

-- 1차 병원은 영상을 원래 전부 본다(의료진이다). 요청 대상이 아니라 정책을 두지 않는다.

/**
 * 보호자가 그 회차의 의료영상을 요청한다.
 * 두 번 눌러도 조용히 넘어간다 — 눌렀는데 아무 일도 안 일어나는 것보다 낫다.
 */
create or replace function request_medical_images(p_visit uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_role_name() <> 'owner' then
    raise exception '보호자만 요청할 수 있습니다';
  end if;
  if not exists (
    select 1 from visit v join patient p on p.id = v.patient_id
     where v.id = p_visit and p.owner_id = current_owner_id()
  ) then
    raise exception '본인의 반려동물이 아닙니다';
  end if;

  insert into image_request (visit_id) values (p_visit)
  on conflict (visit_id) do nothing;
end $$;

revoke all on function request_medical_images(uuid) from public;
grant execute on function request_medical_images(uuid) to authenticated;
