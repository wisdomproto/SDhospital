# src — 코드 구조

루트 `CLAUDE.md`의 설계 결정을 먼저 읽을 것. 여기는 "무엇이 어디에 있는지"만 적는다.

## 화면
- `src/app/(app)/` — 직원 EMR (인증·staff 게이팅)
- `src/app/referral/` — **1차병원 원장 데스크탑 포털** (읽기 전용). 직원 EMR과 동일한 셸/클래스(`app-shell`·`sidebar`·`DataTable`·`card`)를 재사용하고 편집(폼·업로드·수정/삭제)만 제거. `ReferralSidebar.tsx` + 목록/개요/회차(`v/[visitId]`)/입원(`a/[admissionId]`) 페이지
- `src/app/portal/` — 보호자 모바일 앱 (원장이 오면 `/referral`로 리다이렉트)
- `src/app/login/` — 직원 로그인 (데모: 병원별 원장 버튼 → `VET_ACCOUNTS`), `src/app/login/portal/` — 보호자 모바일 로그인, `src/proxy.ts` — 세션 갱신 + 라우트 가드
- `src/app/(app)/today/` — **오늘 할 일**(미발송 목록, 밀린 것 우선) + `[kind]/[id]` **병동 입력 화면**(카메라 즉시·바이털 프리필·한 화면 발송). 로직은 `src/lib/worklist.ts`
- `src/lib/supabase/` — 브라우저/서버 클라이언트 + 생성된 타입. **세 클라이언트 모두 `createXClient<Database>` 제네릭 필수** (안 붙이면 모든 쿼리가 `any`가 되어 컬럼 오타가 안 잡힌다)
- `src/lib/validation/report.ts` — 리포트 공통 규칙, `src/lib/reports.ts` — 보호자 리포트 피드/안읽음
- `src/lib/owner-report.ts` — **보호자 리포트 조립**(제목·프로필·지난 방문 대비 변화·상태 항목). 순수 함수라
  포털(서버)과 전송 미리보기(클라이언트)가 같은 코드를 쓴다 + `OwnerPreview.tsx` (네이티브 `<dialog>`)
- `src/lib/referral.ts` — 의뢰 진행 상태(파생) + 병원별 의뢰 흐름 집계(`hospitalStats`)
- `src/lib/image.ts` + `src/components/PhotoInput.tsx` — **업로드 전 브라우저 축소**(1600px+WebP)
- `src/lib/consent/forms.ts` — **동의서 양식 5종(본문 포함)**. 양식은 DB 아닌 코드에 둔다(git = 버전관리)
- `src/components/ConsentSheet.tsx` + `SignaturePad.tsx` — 보호자앱·병원태블릿·직원이 공유하는 동의서 화면
- `src/lib/crypto.ts` — 주민등록번호 등 고유식별정보 AES-256-GCM (키: `CONSENT_ENC_KEY`)
- `src/app/manifest.ts` · `public/sw.js` · `public/offline.html` — PWA. `src/app/portal/InstallApp.tsx`가 등록+설치 안내
- `src/app/(app)/CommandPalette.tsx` + `search-actions.ts` — 상단 ⌘K 검색과 **＋진료 입력**(환자 고르면 오늘 회차 생성).
  둘이 같은 창을 쓴다 — 진료를 넣으려면 어차피 환자를 먼저 골라야 한다
- `loading.tsx` — 화면 전환 스켈레톤. 영역마다(`(app)`·`portal`·`referral`) + 환자 상세 안에도 따로 둔다
  (회차를 옮겨 다닐 때 왼쪽 환자 내비게이션이 남아야 한다). 공용 블록은 `src/components/Skeleton.tsx`
- `src/app/login/PendingButton.tsx` — 로그인·초대 제출 버튼의 대기 표시(`useFormStatus`)
- `src/lib/push.ts` — **웹 푸시 발송**(보호자/1차병원 원장/우리 직원). 대상 조회는 전부 직원 전용 DEFINER.
  구독 저장은 `src/app/push-actions.ts`, 켜기 UI는 `src/components/EnableNotifications.tsx`(`audience` 로 문구 분리).
  `public/sw.js` 에 `push`·`notificationclick` 핸들러
- `src/lib/admission-report.ts` — **입원 일일 리포트 선택지**(식사·배변)와 보호자용 문장. 자유 서술이 아니라 고정 선택지
- `src/app/(app)/notices/` · `src/app/(app)/cases/` — **병원 소식(+쿠폰)** 과 **치료 사례** 관리(직원 전용)
- `src/lib/case-stories.ts` — 사례 매칭(태그 ⊂ 주 증상 + 종 일치). 순수 함수.
  `portal/patients/[id]/cases/` 는 **치료 사례 탭**(검색 + 자주 찾는 태그 칩, 같은 종이 위로).
  긁어오는 건 `supabase/seed/seed_from_website.mjs` (홈페이지 Story + 네이버 블로그, logNo 로 중복 제거)
- `src/app/portal/patients/[id]/PortalTabBar.tsx` (탭 5개 + 안읽음 배지) · `PetSwitcher.tsx`(헤더에서 반려동물 전환) ·
  `profile/`(내 정보 — 사진 업로드는 `set_patient_photo` DEFINER, data URL) · `RefreshOnRead.tsx`(읽음 처리 후 배지 갱신)
- `src/lib/seen.ts` + `src/app/portal/MarkNewsSeen.tsx` — 소식 "마지막 본 시각" 쿠키.
  ⚠️ 서버가 읽는 상수는 `"use client"` 파일에 두지 말 것 (서버에서 `undefined` 가 된다 — `src/lib/last-pet.ts` 도 같은 이유)
- `src/lib/reports.ts` — `ownerReportFeed`(피드) · **`unreadFeed`(안 읽은 것만 직접 조회)** · `unreadCounts`(배지)
- `src/app/portal/patients/[id]/MediaGrid.tsx` — 사진·영상 그리드 + **앱 내 뷰어**(닫기·이동·확대).
  ⚠️ 클라이언트라 `lib/storage`(서버 클라이언트 포함)를 import 하면 안 된다 — 순수 판별 함수는 `src/lib/media.ts`
- `src/lib/checkup/` — **건강검진**: `template.ts`(항목·단위·종별 참고범위 — 결과서 5부를 옮긴 것) ·
  `evaluate.ts`(값 하나의 판정, 근거 없으면 `unknown`) · `load.ts`(값이 있는 섹션만 · 지난 검진 값).
  입력 `(app)/patients/[id]/k/[checkupId]` (한 폼에 전부, 저장은 **지우고 다시 넣는다** —
  `side` 가 null 이라 upsert 가 안 듣는다) · 보호자 `portal/.../checkups/[checkupId]` ·
  1차병원은 회차 화면 안에 카드로 붙는다.
  미발송 검진은 **오늘 할 일**에 올라오고(소견 없으면 "소견 작성 필요"),
  재검일은 `src/app/api/cron/recheck/route.ts` 가 하루 한 번 보호자·직원에게 민다
  (`recheck_notified_at` 이 두 번 보내는 걸 막는다). ⚠️ `src/lib/supabase/service.ts` 는 **이 경로 전용** — 화면에서 쓰면 그 화면엔 RLS 가 없다
- `src/lib/life-log.ts` — **생활기록**: 선택지(식사·배변·활력·약)와 tone, 일/주/월 집계(`aggregate`),
  채팅이 쓰는 `baseline`(기록이 적으면 `enough=false` — 근거 없이 "평소보다 적다"고 말하지 않는다),
  `recentChanges`(먹이는 것이 최근 2주 안에 바뀌었나). 순수 함수라 양쪽 화면이 같은 코드를 쓴다.
  보호자 `portal/patients/[id]/life/`(`DayEntry.tsx` 칩 = **저장 버튼 없이 누르면 저장** · `IntakeList.tsx`) ·
  홈(`portal/patients/[id]/page.tsx`)에 **오늘 카드** · 직원 `(app)/patients/[id]/life/` + `components/LifeChart.tsx`(일/주/월).
  ⚠️ **탭을 늘리지 않았다** — 여섯 개가 되면 모바일에서 글자가 뭉개지고, "내 정보"에 넣으면
  가끔 보는 화면 안에 매일 쓰는 기능이 숨는다. 그래서 `/life` 는 **병원 소식(홈) 탭에 속한다**(`PortalTabBar` 의 match).
  ⚠️ **보호자가 직접 쓰는 첫 테이블**이라 DEFINER 함수를 안 거친다 — 자기가 만든 자기 행이라 RLS 로 충분하다.
  Storage 는 `life/<patient_id>/...` 경로에만 보호자 쓰기를 연다(`can_read_patient_file` 이 두 번째 칸을 읽는다).
- `src/lib/auth/roles.ts` — 역할 모델
- `supabase/migrations/` — 스키마·RLS, `supabase/tests/` — RLS 테스트

## 라우팅 · 권한
- `src/proxy.ts` — 세션 갱신 + 라우트 가드. PWA 자산(`sw.js`·`offline.html`·`manifest.webmanifest`)은 **인증 가드에서 제외**되어야 한다
  (서비스워커가 로그인 HTML을 받으면 등록이 실패한다).
- 권한은 앱이 아니라 RLS로 강제한다. 외부 역할(보호자·1차병원 원장)의 쓰기는 전부 DEFINER 함수를 거친다:
  `redeem_invite` · `mark_visit_report_read` · `mark_admission_report_read` · `sign_consent` · `log_access`.

## 화면 결정 — 왜 이렇게 생겼나

### 보호자 앱

- **탭 다섯: 병원 소식 · 진료 기록 · 치료 사례 · AI 채팅 · 내 정보.** 입원은 탭이 아니다 —
  회차에 딸린 기록이라 진료 기록 안에서 그 회차 밑에 들여쓴다. 동의서·검진도 같은 자리.
- **탭 활성 판정은 목록이 아니라 규칙으로** — "소식·채팅·치료사례·내 정보·생활기록이 아니면 진료 기록".
  목록으로 두면 화면이 하나 늘 때 빠뜨리고, **그 화면에서만 탭이 안 켜져 앱 밖으로 나온 것처럼 보인다.**
  돌아가는 링크도 첫 화면이 아니라 **진료 기록**으로 보낸다.
- **생활기록은 탭을 늘리지 않았다.** 여섯 개가 되면 모바일에서 글자가 뭉개지고,
  "내 정보"(가끔 보는 화면)에 넣으면 **매일 쓰는 기능이 숨는다.** 홈 탭에 속하고 홈에 오늘 카드가 있다.
- **반려동물 목록 화면은 없다** — `/portal` 은 마지막 본 아이(쿠키)로 리다이렉트만 하고,
  바꾸는 건 헤더에서 한다. 바꿔도 **보던 탭을 유지한다.**
- **같은 내용을 두 곳에 두지 않는다** (입원 경과는 입원 화면에만, 회차 화면에는 링크만).
- **첫 화면은 병원 소식**(`notice`)이다. 리포트는 진료가 있어야 생기지만 소식은 언제든 낼 수 있다 —
  **진료가 없는 달에도 앱을 열 이유**를 만드는 건 이쪽이다.
  - **기간이 지나면 RLS 가 감춘다.** 내리는 걸 사람이 기억해야 하는 구조는 반드시 실패하고,
    지난 이벤트가 첫 화면에 걸려 있으면 그게 신뢰를 깎는다.
  - 이미지는 **파일을 받지 않고 홈페이지에 이미 있는 주소만** 저장한다(`image_url`) —
    같은 글을 앱에도 올리는 것이라 업로드 화면이 필요 없다.
  - 쿠폰은 필드 하나(`coupon_label`)일 뿐 **코드도 사용 처리도 없다.**
    보호자가 화면을 보여주면 접수에서 눈으로 확인한다 — 접수 데스크에 일을 만들면 그 기능은 안 쓰인다.
- **안 읽음은 개수만 알려주면 안 된다.** 탭 배지(개수) + "새로 온 리포트" 모아보기(위치) +
  목록 항목 강조(맥락) 셋이 한 세트다. 개수만 있으면 27개 목록을 뒤져야 한다.
  ⚠️ 안 읽은 목록은 **피드를 잘라 만들지 말 것**(`unreadFeed`) — 잘린 창 밖으로 밀린 항목 때문에
  배지와 목록이 어긋난다.
- **소식 읽음은 행마다 저장하지 않는다.** 소식은 전체 공지라 보호자×소식 표는 무한히 쌓인다.
  **"마지막으로 본 시각" 쿠키 하나**로 그 뒤 올라온 것만 센다(`lib/seen.ts`).
- 미서명 동의서는 상단 "확인이 필요해요"에 리포트와 함께 올리고 **탭 배지에도 포함**한다 —
  빼면 배지 숫자와 화면의 개수가 어긋난다.

### 입력 화면 (직원)

- **진료 내용은 자유 노트가 기본이다.** 수의사들이 SOAP 를 실제로는 잘 안 쓴다(불편하다) —
  틀은 접어 둔 메뉴(`틀 넣기`)에서 꺼내 쓰는 선택지일 뿐이다.
  **라벨 옆에 버튼이 붙어 있으면 그게 곧 강요가 된다.**
- **보호자 리포트는 조립하되 요약하지 않는다.** 수의사가 넣는 건 주 증상 한 줄 · 코멘트 · (선택) 추가 안내뿐.
  제목·프로필·"지난 방문 대비 변화"는 계산한다. **진료 원문을 우리가 줄여서 내보내면
  그 문장의 책임을 병원이 진다.**
- **미리보기는 저장값이 아니라 입력 중인 값으로** 조립한다 — 그래야 미리보기가 곧 실제 발송물이다.
- **생활기록엔 저장 버튼이 없다.** 칩을 누르면 그 자리에서 저장된다 —
  한 번 더 누르게 하면 그 한 번을 안 누른다. **항목은 나타났다 사라지지 않는다**
  (어느 날은 있고 어느 날은 없으면 "오늘은 왜 없지"가 된다). 단 **약 줄만** 우리 처방이 살아 있을 때 뜬다.
- **직원용 생활기록 화면은 일·주·월**이다. 같은 데이터인데 묻는 질문이 다르다.
  범주형은 **tone 분포로 압축**한다 — 한 달 치에서 알고 싶은 건 "14일에 뭘 골랐나"가 아니라
  **"안 좋은 날이 늘고 있나"** 이고, 원본은 아래 날짜별 표에 그대로 있다.

### 건강검진

**판정하되 넘겨짚지 않는다.** 항목·단위·참고범위는 코드에 고정한다(`lib/checkup/template.ts`) —
결과서를 사람이 매번 채워서 같은 검사가 `cPL`/`PancreaticLipase` 로 갈리고 단위가 틀린 채로 나간다.
**참고범위는 종마다 다르고**(BUN 개 6~31 / 고양이 18~33), **범위가 없으면 판정하지 않는다**(`unknown`) —
근거 없이 "정상"이라고 말하는 게 제일 위험하다.
보호자 화면은 확인이 필요한 항목부터 문장으로, 수치는 접어 둔다.

### 치료 사례

**만들지 않고 링크한다**(`case_story`). 병원 블로그 글에 태그만 달아 같은 문제의 리포트에 붙인다.
- **`active` 가 아니라 `tags` 가 노출을 가른다** — 태그 없는 글은 리포트에 절대 안 붙지만
  **치료 사례 탭에서는 읽힌다.** 병원이 이미 공개한 글이라 보이는 것 자체는 위험하지 않고,
  위험한 건 **엉뚱한 회차에 붙는 것**뿐이다.
- **맞는 게 없으면 아무것도 안 붙인다** — 억지로 채우면 광고로 읽혀 리포트 전체의 신뢰가 깎인다.
- 442건을 한 번에 내보내면 응답이 400KB 라 목록은 40건까지만. 나머지는 검색·태그 칩으로.
- ⚠️ **태그는 병명을 집는 말만.** 매칭이 `주 증상.includes(태그)` 라서 식욕·체중·복부 같은 흔한 말은
  주 증상 절반에 걸리고, **"간"은 "간헐적 구토"에 걸린다**(실제로 겪었다).
  자동 분류는 **제목만** 본다 — 본문 도입부가 온갖 병명을 스쳐 간종양 글이 "심장"으로 걸린다.
  못 고른 글은 태그 없이 두면 된다.

### 실제로 겪은 함정

- ⚠️ **`<dialog>`** — `display` 는 `[open]` 에만 줄 것. 안 주면 **닫힌 다이얼로그가 화면에 그대로 깔린다.**
- ⚠️ **grid 컨테이너에는 컬럼을 선언할 것**(`minmax(0,1fr)`). 암시적 컬럼은 `max-content` 라
  긴 한 줄이 화면 밖으로 내용을 밀어낸다(닫기 버튼이 사라진다).
- ⚠️ 서버가 읽는 상수를 `"use client"` 파일에 두면 서버에서 `undefined` 가 된다
  (`lib/seen.ts` · `lib/last-pet.ts` 가 그래서 따로 있다).
- ⚠️ **세 Supabase 클라이언트 모두 `createXClient<Database>` 제네릭 필수** —
  안 붙이면 모든 쿼리가 `any` 가 되어 컬럼 오타가 안 잡힌다.
- 사진은 **업로드 전 브라우저에서** 줄인다(1600px + WebP, 서버 변환 없음).
  의료영상만 원본 보존 + 보호자용 사본(`medical_image.preview_path`)을 따로 올린다.
- **서비스워커는 진료 기록을 캐시하지 않는다** (가족 공용 폰·로그아웃 후 잔존). 껍데기만 캐시.
  `sw.js`/`offline.html`/`manifest.webmanifest` 는 `proxy.ts` 인증 가드에서 **제외**되어야 한다 —
  서비스워커가 로그인 HTML 을 받으면 등록이 실패한다.

## 테스트
- `tests/` — Vitest 단위 테스트 (`npm test`). 검증 로직·리포트 조립·의뢰 집계·암호화가 대상.
- `supabase/tests/rls.sql` — 역할별 가시성과 DEFINER 함수 경계. 새 외부 역할 기능은 여기에 케이스를 추가한다.
- `supabase/seed/demo_history.sql` — 시연용 데이터 (되돌리기: `demo_history_rollback.sql`).
