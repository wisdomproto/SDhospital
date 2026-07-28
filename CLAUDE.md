# SDhospital — 동물병원 EMR

2차(의뢰) 동물병원용 웹 EMR + **보호자 리포팅 앱**. 진료 기록·처방·의료영상·입원 바이털을 관리하고,
의뢰한 1차 병원과 보호자에게 **읽기 전용**으로 공유한다.
현재 목표는 **보호자 앱 MVP** — 매 진료마다 보호자에게 리포트를 보내 재방문·바이럴·레퍼를 늘린다.
사업 기획서: `docs/proposal/2026-07-26-sd-platform-proposal.md` (+ 같은 이름 `.html`)

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
- `src/app/(app)/today/` — **오늘 할 일**(미발송 목록, 밀린 것 우선) + `[kind]/[id]` **병동 입력 화면**(카메라 즉시·바이털 프리필·한 화면 발송). 로직은 `src/lib/worklist.ts`
- `src/lib/supabase/` — 브라우저/서버 클라이언트 + 생성된 타입. **세 클라이언트 모두 `createXClient<Database>` 제네릭 필수** (안 붙이면 모든 쿼리가 `any`가 되어 컬럼 오타가 안 잡힌다)
- `src/lib/validation/report.ts` — 리포트 공통 규칙, `src/lib/reports.ts` — 보호자 리포트 피드/안읽음
- `src/lib/image.ts` + `src/components/PhotoInput.tsx` — **업로드 전 브라우저 축소**(1600px+WebP)
- `src/lib/consent/forms.ts` — **동의서 양식 5종(본문 포함)**. 양식은 DB 아닌 코드에 둔다(git = 버전관리)
- `src/components/ConsentSheet.tsx` + `SignaturePad.tsx` — 보호자앱·병원태블릿·직원이 공유하는 동의서 화면
- `src/lib/crypto.ts` — 주민등록번호 등 고유식별정보 AES-256-GCM (키: `CONSENT_ENC_KEY`)
- `src/app/manifest.ts` · `public/sw.js` · `public/offline.html` — PWA. `src/app/portal/InstallApp.tsx`가 등록+설치 안내
- `src/lib/auth/roles.ts` — 역할 모델
- `supabase/migrations/` — 스키마·RLS, `supabase/tests/` — RLS 테스트

## 설계 결정
- **기본 단위는 진료 회차(`visit`).** 입원하러 온 환자도 진료 기록이 먼저 생기고,
  **입원(`admission`)은 그 회차에 딸린 별도 기록**(`admission.visit_id` 필수).
  `patient_id`도 남아 있지만 복합 FK `(visit_id, patient_id) → visit(id, patient_id)`로
  DB가 정합성을 강제한다. 입원 생성은 **회차 화면에서만** 한다.
- **보호자 리포트는 두 종류.** 회차 리포트(`visit.report_comment/sent_at/read_at`)가 기본이고 모든 진료에 발생,
  입원 일일 리포트(`admission_report`, `unique(admission_id, report_date)`)는 입원한 회차에만 매일.
  수의사가 넣는 건 **코멘트 한 줄**뿐 — 나머지는 조립한다. 발송 시 코멘트 필수(임시저장은 빈 값 허용).
- 보호자는 읽기 전용이라 **열람 표시는 DEFINER 함수로만** (`mark_visit_report_read`, `mark_admission_report_read`).
- ⚠️ **보호자에게 진료 원문·처방 상세를 보여주지 않는다** (분쟁 소지). 담당의 코멘트 + 검사 요약 + 사진/영상만.
  보호자 쿼리에서 `visit.note` 컬럼 자체를 뺐다. **1차병원(`/referral`)은 전부 본다** — 의료진이다.
- 사진은 **업로드 전 브라우저에서** 1600px+WebP로 줄인다(서버 변환 없음). 의료영상만 원본 보존 +
  보호자용 사본(`medical_image.preview_path`)을 따로 올린다.
- 서비스워커는 **진료 기록을 캐시하지 않는다** (가족 공용 폰·로그아웃 후 잔존). 껍데기만 캐시.
  `sw.js`/`offline.html`/`manifest.webmanifest`는 `proxy.ts` 인증 가드에서 제외되어 있어야 한다.
- `visit.closed_at` = 진료 종료. "오늘 할 일"은 **종료됐는데 미발송**인 회차를 올린다. 리포트를 보내면 종료도 같이 찍는다.
- **동의서는 서명 시점 본문을 통째로 보관**(`consent.body_snapshot`). 양식 문구가 바뀌어도 과거 서명은 그대로 —
  증빙에서 중요한 건 서명 그림이 아니라 "무엇에 동의했는지"다. 서명은 DEFINER 함수 `sign_consent`로만(두 번 서명 불가).
- 구조화 데이터 = Postgres, 큰 파일(X-ray/MRI/CT·사진·영상) = Supabase Storage
- 권한은 앱이 아니라 **RLS**로 강제 (의료정보 유출 방지)
- 외부 공유 UI 분리: **보호자 = 모바일(`/portal`)**, **원장 = 데스크탑(`/referral`)**. 원장 화면은 직원 EMR과 "수정 가능 여부"만 다르게 (동일 레이아웃·컴포넌트, 읽기 전용)

## 계획서 (`docs/superpowers/plans/`)
- **01 기반** ✅ — 스키마·RLS·직원 로그인·앱 셸
- **02 환자 관리** ✅ — 보호자·1차병원·환자 CRUD, 검색 목록, 상세/수정
- **03 진료 기록** ✅ — 회차·약품 마스터·처방·의료영상/사진 업로드(Storage+서명URL)
- **04 입원·바이털** ✅ — 입원 생애주기·바이털 입력·Recharts 시계열 그래프
- **05 초대·외부 포털** ✅ — 초대 발급/수락(DEFINER 함수), 읽기전용 보호자 모바일 포털 + **1차병원 원장 데스크탑 포털(`/referral`)**

- **06 보호자 앱 MVP** 🚧 — `2026-07-26-mvp-owner-app.md`.
  M-0 스키마·M-1/M-1b 리포트·M-2 오늘 할 일·병동 입력 화면·M-3 종합 리포트·사진 최적화·PWA 완료.
  M-5 전자 동의서 완료. 대기: 알림(발신번호), M-8 FAQ(10년치 상담 데이터), M-4 검진(샘플). 다음 M-6/M-7 또는 레퍼럴 브릿지.

EMR 자체(Plan 01–05)는 완성. 이후 후보: 알림 채널(문자/알림톡/푸시) 연결, 의료영상 뷰어·DICOM, 1차병원 EMR+PACS, AI, 예약/청구, 감사 로그, 네이티브 앱.

스펙: `docs/superpowers/specs/2026-07-07-vet-emr-design.md`

## 배포 (Railway)
- `railway.json`(Nixpacks, start `npm run start`, healthcheck `/login`) + `.nvmrc`(Node 22). GitHub 리포 연결 → env 2개(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) → Generate Domain. DB는 이미 Supabase 클라우드라 앱만 배포.
- **데모 로그인 게이트**: 원클릭 로그인 버튼·서버액션은 `NEXT_PUBLIC_ENABLE_DEMO=1`일 때만 동작. 로컬 `.env.local`엔 켜둠, 프로덕션(Railway)엔 **넣지 말 것** → 자동 비활성화.
- ⚠️ **`CONSENT_ENC_KEY` 필수** (주민등록번호 암호화). Railway 에 로컬과 다른 값으로 넣고 **별도 백업** —
  잃어버리면 저장된 주민번호를 복구할 수 없다.
- 배포 후 Supabase Auth → URL Configuration에 배포 도메인 등록.

## 로컬 개발 메모
- Docker 미설치 → 로컬 Supabase 스택 대신 클라우드 프로젝트 사용 중
- 테스트 계정 (⚠️ DEMO ONLY, `NEXT_PUBLIC_ENABLE_DEMO=1`일 때만 노출, `src/app/login/demo.ts`):
  - 직원: `staff@sdhospital.test` / `sdhospital123!`
  - 보호자: `1@example.com` / `1234`
  - 원장(애니컴): `2@example.com` / `1234`, 원장(아이원): `3@example.com` / `1234`
- **시연용 데이터**: `supabase/seed/demo_history.sql` — 환자 12명 × 3~8년치 회차(236건)·과거 입원·바이털·일일 리포트.
  환자별 "질환 스토리"(주 증상 배열·체중 시작/끝·방문 횟수)만 적고 DB가 펼친다. 시드 행은 전부 id 가 `d0000000-` 로 시작하고
  `demo_history_rollback.sql` 로 되돌린다. **운영 DB에 넣지 말 것.**
- `.env.local`은 gitignore (Supabase URL + publishable 키)
