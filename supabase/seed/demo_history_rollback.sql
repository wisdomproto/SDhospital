-- supabase/seed/demo_history_rollback.sql — demo_history.sql 되돌리기
--
-- 시드가 만든 것은 전부 id 가 'd0000000-' 로 시작한다. 그것만 지우고,
-- 원래 있던 회차는 시드 이전 상태(1회차, 주 증상/체중/회신 없음)로 돌린다.

begin;

delete from case_story        where id::text like 'c0000000%';  -- 홈페이지에서 긁어온 치료 사례
delete from case_story        where id::text like 'a0000000%';  -- 네이버 블로그에서 긁어온 치료 사례
delete from notice            where id::text like 'b0000000%';  -- 홈페이지에서 긁어온 병원 소식
delete from medical_image     where id::text like 'f0000000%';  -- Storage 파일은 콘솔에서 지운다
delete from checkup_value     where checkup_id::text like 'e0000000%';
delete from checkup           where id::text like 'e0000000%';
delete from consent           where id::text like 'd0000000%';
delete from case_story        where id::text like 'd0000000%';
delete from notice            where id::text like 'd0000000%';
delete from admission_report where id::text like 'd0000000%';
delete from vital            where id::text like 'd0000000%';
delete from admission        where id::text like 'd0000000%';
delete from visit            where id::text like 'd0000000%';
delete from patient          where id::text like 'd0000000%';
delete from owner            where id::text like 'd0000000%';
delete from referring_hospital where id::text like 'd0000000%';

update visit set visit_no = 1,
  chief_complaint = null, weight_kg = null, report_notice = null,
  referral_note = null, referred_back_at = null
 where id in (
  'b217fd2c-9d1b-5f43-89eb-6c63cf949557', 'ec553d87-5a1b-5dbd-af85-556a66269c9d',
  'e0fdc56f-3d65-5123-98ef-4f6497c73234', 'ce5fbb3b-c264-551e-a25a-914bd7ffc9d3',
  'ded78bf0-d6d0-5f5e-b3df-f3acd4389788', 'c98630e6-f4bc-5fb9-bc0e-6f8d96ad8ce1',
  'e6949ff8-6bf4-5736-ab83-48b7568d51d5', '16556891-1d9d-5523-8f52-3ee8b4bd4f76',
  '817b0cf4-f25c-5037-ac17-b94b60b9060b', '82093d97-d5bc-52b3-bc5e-246a7c469dcb'
);

-- 슈슈·토리는 시드 이전에도 발송 상태였으므로 건드리지 않는다
update visit set report_comment = null, report_sent_at = null, report_read_at = null
 where id in (
  'b217fd2c-9d1b-5f43-89eb-6c63cf949557', 'ec553d87-5a1b-5dbd-af85-556a66269c9d',
  'e0fdc56f-3d65-5123-98ef-4f6497c73234', 'ce5fbb3b-c264-551e-a25a-914bd7ffc9d3',
  'ded78bf0-d6d0-5f5e-b3df-f3acd4389788', 'e6949ff8-6bf4-5736-ab83-48b7568d51d5',
  '16556891-1d9d-5523-8f52-3ee8b4bd4f76', '817b0cf4-f25c-5037-ac17-b94b60b9060b'
);

commit;
