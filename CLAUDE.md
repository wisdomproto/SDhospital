# SDhospital — 동물병원 EMR + 보호자 앱

2차(의뢰) 동물병원용 웹 EMR. 진료·처방·의료영상·입원 바이털을 관리하고,
의뢰한 1차 병원과 보호자에게 **읽기 전용**으로 공유한다.
**차별화는 AI 채팅**이다 — 그 아이의 진료 기록·생활기록·교과서를 함께 읽고
"지금 어디로 가야 하는지"에 답한다. 나머지 기능은 이미 있고 남도 만들 수 있다.

| 문서 | |
|---|---|
| 사업 기획서 | `docs/proposal/2026-07-26-sd-platform-proposal.md` (`.html` 은 `scripts/build_proposal.py` 로 생성) |
| AI 채팅 기획서 (원장 검토용) | `docs/review/2026-08-03-ai-chat-plan.html` |
| 계획서·진행 상황·채팅 설계 | **see [docs/CLAUDE.md](docs/CLAUDE.md)** |
| 화면·UI 결정 | **see [src/CLAUDE.md](src/CLAUDE.md)** |
| 스키마·RLS·시드 | **see [supabase/CLAUDE.md](supabase/CLAUDE.md)** |
| 배포·환경변수 | **see [docs/deploy.md](docs/deploy.md)** |

## 기술 스택
- **Next.js 16** (App Router, TS, Tailwind v4) — EMR·외부 포털·보호자 앱을 한 코드베이스로
- **Supabase** (Postgres + Auth + Storage + **RLS**) — 프로젝트 ref `wzkobutctoilazdznpbb` (서울)
- **배포** Railway (앱) + Supabase 클라우드 · **차트** Recharts · **테스트** Vitest + `supabase/tests/rls.sql`

## 역할 (RLS로 DB에서 강제)
- `staff` — 우리 직원: 전체 읽기/쓰기 → `/(app)` 데스크탑 EMR
- `referring_vet` — 1차 병원 원장: 자기가 의뢰한 환자만 (`patient.referring_hospital_id`) → `/referral` 데스크탑
- `owner` — 보호자: 자기 반려동물만 (`patient.owner_id`) → `/portal` 모바일 앱

외부 사용자는 병원이 발급하는 **초대 링크**로 가입(`redeem_invite` DEFINER → `/invite/[token]`).

## 명령어
- `npm run dev` (3000) · `npm run build` (빌드 + 타입체크) · `npm test` (Vitest)
- RLS 테스트: `psql "$DB_URL" -f supabase/tests/rls.sql` (또는 Supabase MCP `execute_sql`)
- DB 타입 재생성: `npx supabase gen types typescript --local`

## 구조
`src/app/(app)/` 직원 EMR · `src/app/referral/` 1차병원 포털(읽기 전용) · `src/app/portal/` 보호자 앱
· `supabase/{migrations,tests,seed}/`

## 설계 결정 — 다른 모든 것이 여기서 따라온다

- **권한은 앱이 아니라 RLS로 강제한다.** 앱에 버그가 나도 남의 의료정보는 조회 자체가 안 돼야 한다.
  외부 역할의 쓰기는 **DEFINER 함수로만** — 단 하나의 예외가 **생활기록**이다(보호자 자기 행이라 정책으로 충분).
- ⚠️ **보호자에게 진료 원문·처방 상세·판독 소견을 보여주지 않는다** (분쟁 소지).
  담당의 코멘트 + 검사 요약 + 사진/영상까지다. 보호자 쿼리에서 `visit.note` 컬럼 자체를 뺐다.
  ⚠️ **의료영상(X-ray·CT·MRI)은 요청해야 나간다** (2026-08-04, 원장님 요구) — 판독 소견 없이 띄우면
  보호자가 스스로 해석한다. 보호자 요청 → 직원 승인. **승인 전엔 서명 URL 도 안 만든다.**
  아이 사진·진료 중 영상(`media`)은 그대로 나간다 — 그건 안심시키려고 보내는 것이다.
  **채팅도 이 규칙 안에 있다** — 채팅이 우회로가 되면 안 된다. **1차병원은 전부 본다**(의료진이다).
- **기본 단위는 진료 회차(`visit`).** 입원·검진·동의서는 전부 그 회차에 딸린 기록이다.
  화면도 그렇게 배치한다 — 데이터가 이미 아는 것을 사람이 날짜로 되짚게 하지 않는다.
- **발송은 자동이 아니라 사람이 누를 때만.** 대신 "오늘 할 일"이 미발송 건수를 계속 보여준다.
- **채팅은 진단하지 않고 분류만 한다** — 지금 오세요 / 예약 / 1차 병원 / 담당의 확인.
  **나가는 문장은 원장님이 승인한 것만**이고, AI 는 고르기만 하지 만들지 않는다.
- ⚠️ **경미한 의뢰 환자는 1차 병원으로 돌려보낸다.** 앱의 목적은 우리 예약이 아니라
  1차 병원이 안심하고 의뢰하게 만드는 것이다. 우리가 수술한 부위·처방한 약·진행 중 질환은 예외.
- **부담을 주면 그 기능은 조용히 죽는다.** 이 원리가 곳곳에 박혀 있다 —
  자유 서술 대신 선택지, 저장 버튼 없애기, 기간 지나면 자동 소멸, 쿠폰에 코드·사용처리 없음,
  "매일 채우라"는 알림 없음. **사람이 기억해야 하는 구조는 반드시 실패한다.**
- **구조화 데이터는 Postgres, 큰 파일은 Storage.** 외부 공유 UI 는 분리한다 —
  보호자는 모바일(`/portal`), 원장은 데스크탑(`/referral`, 직원 EMR과 "수정 가능 여부"만 다름).

## 지금 상태
EMR·보호자 앱 MVP·레퍼럴 브릿지·건강검진·생활기록 **완료**. **AI 채팅이 남았다.**
착수 조건은 원장님의 **"지금 오세요" 목록** 하나 — 답변 32건 전체 검토를 기다리지 않는다.
미결: 자매병원 자격 기준 · 생활기록 유입 경로(비SD 환자) · 검진 템플릿 원장 확인.
