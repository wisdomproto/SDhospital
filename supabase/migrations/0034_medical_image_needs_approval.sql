-- 0034_medical_image_needs_approval.sql — 의료영상 승인을 RLS 로 올린다
--
-- 0027 에서 「보호자가 요청 → 직원이 승인 → 그때 보인다」를 만들었는데,
-- **승인 검사가 화면에만 있었다.** 회차 화면(`portal/.../visits/[visitId]`)은 지켰지만
-- 입원 화면(`portal/.../admissions/[admissionId]`)은 무조건 서명 URL 을 만들고 있었고,
-- 하필 **의료영상 37건 중 30건(81%)이 회차가 아니라 입원에 붙어 있었다.**
-- 규칙이 19% 에만 걸려 있던 셈이다.
--
-- 화면은 고쳤지만 화면은 또 늘어난다. 이 프로젝트의 원칙대로 **DB 에서 막는다** —
-- 앱에 버그가 나도 승인 안 된 영상은 조회 자체가 안 돼야 한다.
--
-- ⚠️ **채팅은 영향받지 않는다.** `lib/chat/context.ts` 는 의료영상을 아예 안 읽는다
--    (판독 소견은 요청·승인을 거쳐야 나가는 것이라 채팅이 우회로가 되면 안 된다).
-- ⚠️ **1차 병원 원장은 그대로 전부 본다.** 의료진이라 요청 대상이 아니다.
-- ⚠️ `media`(아이 사진·진료 중 영상)는 이 표가 아니다. 그건 그대로 나간다.

/**
 * 그 회차의 의료영상이 보호자에게 열렸나. 입원에 붙은 영상은 **그 입원이 딸린 회차**를 따른다.
 * 회차를 못 찾으면 false — 못 여는 쪽으로 실패한다.
 */
create or replace function images_approved_for_owner(p_visit uuid, p_admission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from image_request r
     where r.approved_at is not null
       and r.visit_id = coalesce(
             p_visit,
             (select a.visit_id from admission a where a.id = p_admission)
           )
  );
$$;

drop policy if exists "img_external_read" on medical_image;

create policy "img_external_read" on medical_image for select to authenticated
using (
  -- 1차 병원 원장: 자기가 의뢰한 환자면 전부 (승인과 무관하다)
  exists (
    select 1 from visit v join patient p on p.id = v.patient_id
     where v.id = medical_image.visit_id
       and current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id()
  )
  or exists (
    select 1 from admission a join patient p on p.id = a.patient_id
     where a.id = medical_image.admission_id
       and current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id()
  )
  -- 보호자: 자기 아이인 데다 **그 회차가 승인된 것만**
  or (
    current_role_name() = 'owner'
    and images_approved_for_owner(medical_image.visit_id, medical_image.admission_id)
    and (
      exists (
        select 1 from visit v join patient p on p.id = v.patient_id
         where v.id = medical_image.visit_id and p.owner_id = current_owner_id()
      )
      or exists (
        select 1 from admission a join patient p on p.id = a.patient_id
         where a.id = medical_image.admission_id and p.owner_id = current_owner_id()
      )
    )
  )
);
