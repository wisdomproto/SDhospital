# SDhospital — 동물병원 EMR

2차(의뢰) 동물병원용 웹 EMR. 진료 기록·처방·의료영상·입원 바이털을 관리하고,
의뢰한 1차 병원과 보호자에게 **읽기 전용**으로 공유한다.

## 기술 스택
- **Next.js 16** (App Router, TS, Tailwind v4) — EMR 웹 + 외부 포털 한 코드베이스
- **Supabase** (Postgres + Auth + Storage + **RLS**) — 프로젝트 ref `wzkobutctoilazdznpbb` (서울)
- **배포**: Railway (앱) + Supabase 클라우드
- **차트**: Recharts (입원 바이털 시계열)
- **테스트**: Vitest (TS 단위), `supabase/tests/rls.sql` (RLS 검증)

## 역할 (RLS로 DB에서 강제)
- `staff` — 우리 병원 직원: 전체 읽기/쓰기 → `/(app)` 데스크탑 EMR
- `referring_vet` — 1차 병원 원장: 자기가 의뢰한 환자만 읽기 (`patient.referring_hospital_id`) → **`/referral` 데스크탑 포털** (직원 EMR 셸 재사용, 읽기 전용)
- `owner` — 보호자: 자기 반려동물만 읽기 (`patient.owner_id`) → `/portal` 모바일 앱

외부 사용자는 병원이 발급하는 **초대 링크**로 가입(`redeem_invite` DEFINER 함수 → `/invite/[token]`).

## 명령어
- `npm run dev` — 개발 서버 (localhost:3000)
- `npm run build` — 프로덕션 빌드 + 타입체크
- `npm test` — Vitest
- RLS 테스트: `psql "$DB_URL" -f supabase/tests/rls.sql` (또는 Supabase MCP execute_sql)
- DB 타입 재생성: `npx supabase gen types typescript --local`

## 구조
- `src/app/(app)/` — 직원 EMR (인증·staff 게이팅)
- `src/app/referral/` — **1차병원 원장 데스크탑 포털** (읽기 전용). 직원 EMR과 동일한 셸/클래스(`app-shell`·`sidebar`·`DataTable`·`card`)를 재사용하고 편집(폼·업로드·수정/삭제)만 제거. `ReferralSidebar.tsx` + 목록/개요/회차(`v/[visitId]`)/입원(`a/[admissionId]`) 페이지
- `src/app/portal/` — 보호자 모바일 앱 (원장이 오면 `/referral`로 리다이렉트)
- `src/app/login/` — 직원 로그인 (데모: 병원별 원장 버튼 → `VET_ACCOUNTS`), `src/app/login/portal/` — 보호자 모바일 로그인, `src/proxy.ts` — 세션 갱신 + 라우트 가드
- `src/lib/supabase/` — 브라우저/서버 클라이언트 + 생성된 타입, `src/lib/auth/roles.ts` — 역할 모델
- `supabase/migrations/` — 스키마·RLS, `supabase/tests/` — RLS 테스트

## 설계 결정
- 구조화 데이터 = Postgres, 큰 파일(X-ray/MRI/CT·사진·영상) = Supabase Storage
- 권한은 앱이 아니라 **RLS**로 강제 (의료정보 유출 방지)
- 외부 공유 UI 분리: **보호자 = 모바일(`/portal`)**, **원장 = 데스크탑(`/referral`)**. 원장 화면은 직원 EMR과 "수정 가능 여부"만 다르게 (동일 레이아웃·컴포넌트, 읽기 전용)

## 계획서 (`docs/superpowers/plans/`)
- **01 기반** ✅ — 스키마·RLS·직원 로그인·앱 셸
- **02 환자 관리** ✅ — 보호자·1차병원·환자 CRUD, 검색 목록, 상세/수정
- **03 진료 기록** ✅ — 회차·약품 마스터·처방·의료영상/사진 업로드(Storage+서명URL)
- **04 입원·바이털** ✅ — 입원 생애주기·바이털 입력·Recharts 시계열 그래프
- **05 초대·외부 포털** ✅ — 초대 발급/수락(DEFINER 함수), 읽기전용 보호자 모바일 포털 + **1차병원 원장 데스크탑 포털(`/referral`)**

**MVP 완성** (Plan 01–05). 이후 후보: 의료영상 뷰어(측정·주석·세그멘테이션·시리즈 구분 — 보류), DICOM, 알림, 예약/청구, 감사 로그, 네이티브 앱.

스펙: `docs/superpowers/specs/2026-07-07-vet-emr-design.md`

## 로컬 개발 메모
- Docker 미설치 → 로컬 Supabase 스택 대신 클라우드 프로젝트 사용 중
- 테스트 계정 (⚠️ DEMO ONLY, `src/app/login/demo.ts`):
  - 직원: `staff@sdhospital.test` / `sdhospital123!`
  - 보호자: `1@example.com` / `1234`
  - 원장(애니컴): `2@example.com` / `1234`, 원장(아이원): `3@example.com` / `1234`
- `.env.local`은 gitignore (Supabase URL + publishable 키)
