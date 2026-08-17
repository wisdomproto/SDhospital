# 배포 · 환경변수

앱은 **Railway**, DB 는 이미 **Supabase 클라우드**라 앱만 배포하면 된다.

## 배포 주소

**https://sdhospital-production.up.railway.app** — `main` 에 푸시하면 자동 배포된다.

| | |
|---|---|
| 직원 EMR | `/login` |
| 보호자 앱 | `/login/portal` |
| **자료실** | `/login` 오른쪽 위 드롭다운 → `/deck/*.html` · ⚠️ **로그인 전 화면이다** |

⚠️⚠️ **자료실의 `sd-chat-eval-*.html` 만 성격이 다르다** — 나머지 넷은 사업 문서지만
이건 **실제 환자 56명의 진료 원문**이다. 파일명의 난수는 자물쇠가 아니다.
**보호자에게 앱을 줄 때 `src/app/login/page.tsx` 에서 그 줄을 떼거나 로그인 뒤로 옮긴다.**
`HAND=... node scripts/eval-report.mjs` 가 `docs/review` 와 `public/deck` 에 **같이** 쓴다(손으로 복사하지 않는다).

⚠️ **`/deck/` 는 인증 가드에서 빠져 있다**(`src/proxy.ts`). 원장님·1차 병원에 링크로 보내는
자료라 로그인 없이 열려야 하지만, **주소를 아는 사람은 누구나 본다.** 검색엔진만 `noindex` 로 막았다.
로그인 뒤로 넣으려면 `proxy.ts` 의 `/deck/` 한 줄을 빼면 된다.

`railway.json`(Nixpacks, start `npm run start`, healthcheck `/login`) + `.nvmrc`(Node 22).
GitHub 리포 연결 → 환경변수 설정 → Generate Domain → **Supabase Auth → URL Configuration 에 배포 도메인 등록.**

## 환경변수

| | 필수 | |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | 웹 푸시 |
| `VAPID_PRIVATE_KEY` | ✅ | `npx web-push generate-vapid-keys` 로 만든다 |
| `VAPID_SUBJECT` | ✅ | `mailto:...` |
| `CONSENT_ENC_KEY` | ✅ | 주민등록번호 암호화 |
| `ANTHROPIC_API_KEY` | AI 채팅용 | 없으면 채팅 화면에만 안내가 뜨고 **나머지 앱은 그대로 돈다** |
| `CRON_SECRET` | 재검 알림용 | |
| `SUPABASE_SERVICE_ROLE_KEY` | 재검 알림용 | |
| `NEXT_PUBLIC_ENABLE_DEMO` | ❌ **넣지 말 것** | |

### ⚠️ 잃어버리면 안 되는 것

- **`CONSENT_ENC_KEY`** — 잃어버리면 **저장된 주민번호를 복구할 수 없다.**
  Railway 에 로컬과 다른 값으로 넣고 **별도로 백업**해 둔다.
- **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`** — **공개키를 바꾸면 기존 구독이 전부 무효**가 된다.
  보호자가 알림을 다시 켜야 하고, 그 사람들은 대부분 다시 안 켠다.

### ⚠️ `ANTHROPIC_API_KEY` — 로컬 키를 그대로 올리지 말 것

- **로컬과 다른 키를 발급해서 넣는다.** 한쪽이 새면 그쪽만 폐기하면 된다.
- **선불 크레딧이다.** 잔액이 떨어지면 채팅만 조용히 멈춘다 —
  Console 에서 사용량 알림(Usage limits)을 걸어 둔다.
- ⚠️ **횟수 제한이 없다.** 지금은 보호자가 누르는 만큼 그대로 나간다(회당 3센트 안팎).
  실사용자에게 열기 전에 하루/사람당 상한을 붙여야 한다.

### ⚠️ 데모 로그인 게이트

원클릭 로그인 버튼·서버액션은 `NEXT_PUBLIC_ENABLE_DEMO=1` 일 때만 동작한다.
로컬 `.env.local` 엔 켜 두고 **프로덕션엔 넣지 않는다** → 자동으로 비활성화된다.

## 재검 알림 (스케줄러)

하루 한 번 **`GET /api/cron/recheck`** 를 불러야 돈다 — `Authorization: Bearer $CRON_SECRET`.

- `CRON_SECRET` 과 **`SUPABASE_SERVICE_ROLE_KEY`** 를 넣는다.
  스케줄러엔 세션이 없어 RLS 를 못 통과한다 — **서비스 키를 쓰는 유일한 경로다**
  (`src/lib/supabase/service.ts`, 화면 코드에서 쓰면 그 화면엔 RLS 가 없어진다).
- 안 넣으면 **503 을 돌려주고 아무 일도 안 한다.**
- 지난 날짜도 같이 집으므로 **하루 걸러도 재검이 사라지지 않는다.**
- `recheck_notified_at` 이 두 번 보내는 걸 막는다.

## 도입 전 체크

- [ ] `NEXT_PUBLIC_ENABLE_DEMO` 가 프로덕션에 **없는지** 확인
- [ ] `CONSENT_ENC_KEY` 백업
- [ ] `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` 등록 + 스케줄러 연결
- [ ] Supabase Auth URL Configuration 에 도메인 등록
- [ ] **도입 커트라인** — 도입일 이전 회차를 리포트 대상에서 빼야 첫날 "밀린 것 200건"이 안 뜬다
      (`report_sent_at` 일괄 채우기 또는 `closed_at >= 도입일` 조건)
- [ ] 시연용 데이터가 운영 DB 에 없는지 (`d0000000-` · `a0000000-` · `e0000000-` · `f0000000-`)
- [ ] 검진 템플릿을 원장님이 훑어봤는지 — **없는 항목은 입력칸 자체가 없다**
