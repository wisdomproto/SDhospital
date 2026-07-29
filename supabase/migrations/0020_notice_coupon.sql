-- 0020_notice_coupon.sql — 소식을 쿠폰으로
--
-- 쿠폰 코드도, 사용 처리도 두지 않는다. **보호자가 앱 화면을 보여주면 접수에서 눈으로 확인**한다.
-- 발급·사용·중복 방지를 만들면 그 순간 접수 데스크에 새로운 일이 생기고, 그러면 안 쓰게 된다.
-- 유효기간은 이미 notice 에 있다(starts_on/ends_on) — 지나면 RLS 가 감춘다.
--
-- 나중에 "몇 명이 썼나"를 숫자로 봐야 할 때 사용 처리를 붙이면 된다. 그때는 이유가 생긴 뒤다.

alter table notice add column if not exists coupon_label text;  -- 예) 건강검진 20% 할인
