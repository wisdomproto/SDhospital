-- life_log_demo_rollback.sql — 시연용 생활기록 되돌리기
-- 사진(life_photo)은 log_id 에 on delete cascade 라 같이 지워진다.
delete from life_intake where id::text like 'a0000000%';
delete from life_log where id::text like 'a0000000%';
