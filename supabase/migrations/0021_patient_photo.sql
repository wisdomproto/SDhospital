-- 0021_patient_photo.sql — 반려동물 프로필 사진
--
-- 보호자가 자기 아이 사진을 직접 올린다. 앱에 애착이 생기는 지점이고,
-- 리포트 목록에서 이모지 대신 우리 아이 얼굴이 보이는 것과 아닌 것은 차이가 크다.
--
-- Storage 가 아니라 컬럼에 data URL 로 넣는다:
--   · 보호자는 Storage 쓰기 권한이 없다. 정책을 새로 열면 그게 더 큰 구멍이다.
--   · 프로필 사진은 400px WebP 로 줄여 30KB 남짓이다 (동의서 서명과 같은 방식).
-- 쓰기는 DEFINER 함수로만 — 보호자는 patient 행을 직접 수정할 수 없다.

alter table patient add column if not exists photo text;

create or replace function set_patient_photo(p_patient_id uuid, p_photo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare allowed boolean;
begin
  select exists (
    select 1 from patient pt
    join profile pr on pr.id = auth.uid()
    where pt.id = p_patient_id
      and (pr.role = 'staff' or (pr.role = 'owner' and pt.owner_id = pr.owner_id))
  ) into allowed;

  if not allowed then
    raise exception 'not your pet';
  end if;

  -- 브라우저에서 이미 줄여서 보내지만, 서버도 한 번 막는다
  if p_photo is not null and length(p_photo) > 400000 then
    raise exception 'photo too large';
  end if;

  update patient set photo = p_photo where id = p_patient_id;
end
$$;

revoke all on function set_patient_photo(uuid, text) from public;
grant execute on function set_patient_photo(uuid, text) to authenticated;
