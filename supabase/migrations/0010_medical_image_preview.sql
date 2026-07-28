-- 0010_medical_image_preview.sql
-- 의료영상은 판독용이라 원본을 압축하면 안 된다.
-- 대신 보호자에게 보낼 가벼운 사본(WebP) 경로를 따로 들고 있는다.
-- 직원·1차병원 화면은 storage_path(원본), 보호자 화면은 preview_path 를 쓴다.

alter table medical_image add column if not exists preview_path text;
