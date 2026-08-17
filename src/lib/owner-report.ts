/**
 * 보호자에게 나가는 리포트 조립.
 *
 * 수의사가 넣는 건 세 가지뿐이다 — 주 증상 한 줄 · 담당의 코멘트 · (선택) 추가 안내.
 * 제목·프로필·"지난 방문 대비 변화"는 전부 이미 있는 값에서 계산한다.
 * 요약은 하지 않는다. 진료 원문을 줄여서 내보내는 건 분쟁 소지가 있고,
 * 무엇보다 우리가 임의로 줄인 문장의 책임은 병원이 진다.
 *
 * 서버(포털 렌더)와 클라이언트(전송 미리보기)가 같은 함수를 쓴다. 순수 함수로 둘 것.
 */

export type ReportPatient = {
  name: string;
  species: string | null;
  breed: string | null;
  birth_date: string | null;
};

export type ReportVisit = {
  visit_date: string;
  chief_complaint: string | null;
  weight_kg: number | null;
  report_comment: string | null;
  report_notice: string | null;
};

export type OwnerReport = {
  title: string;
  /** "개 · 푸들 · 15세 1개월 · 6.36kg" */
  profile: string;
  changes: string[];
  states: string[];
  notice: string | null;
};

/** "15세 1개월". 개월 수가 0이면 "15세". */
export function formatAge(birthDate: string | null, on: string): string | null {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T00:00:00Z");
  const t = new Date(on + "T00:00:00Z");
  if (Number.isNaN(b.getTime()) || Number.isNaN(t.getTime()) || b > t) return null;
  let months =
    (t.getUTCFullYear() - b.getUTCFullYear()) * 12 + (t.getUTCMonth() - b.getUTCMonth());
  if (t.getUTCDate() < b.getUTCDate()) months -= 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}개월`;
  return m === 0 ? `${y}세` : `${y}세 ${m}개월`;
}

const kg = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, "")}kg`;

/**
 * 주 증상이 **보호자에게 나가면 안 될 것처럼 보이면** 이유를 돌려준다. 괜찮으면 null.
 *
 * ⚠️ **막지 않고 알린다.** 이 값은 리포트 제목이 되고(`${cc} 진료 리포트`) 다음 회차의
 * 「지난 방문에는 ~로 내원하셨어요」 문장이 된다. 그런데 진료기록을 EMR 에서 옮겨 넣으면서
 * **원내 표기가 그대로 들어간 회차가 93건** 있다 — 실제 값이 이렇다:
 * 「검사자료(더케이동물병원)」(최다) · 「정형외과) Lt.TPLO/수술1일」 · 「안락사」 · 「치료비 정산」.
 *
 * 자동으로 걸러 내려다 그만뒀다 — 화이트리스트를 짜 보니 69명 중 12명이 통과했고
 * 그 안에 「안락사」가 있었다. **무엇이 걸렸는지 사람에게 보여주고 사람이 고치게 한다.**
 * 오탐이 나도 손해가 없다. 발송 버튼을 막지는 않는다.
 */
export function chiefComplaintWarning(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (/병원|의원|벳|랩/.test(s)) return "다른 병원·검사기관 이름이 들어 있습니다";
  if (/안락사|폐사|임종|사망/.test(s)) return "제목에 그대로 나갑니다 — 보호자가 먼저 보는 문장입니다";
  if (/정산|수납|진단서|자료등록|검사자료|외부검사/.test(s)) return "진료가 아니라 행정 처리 기록으로 보입니다";
  if (/[()[\]:*]|[A-Za-z]{2,}/.test(s)) return "원내 표기·영문 약어가 섞여 있습니다";
  return null;
}

export function buildOwnerReport(
  patient: ReportPatient,
  visit: ReportVisit,
  prev?: ReportVisit | null
): OwnerReport {
  const cc = visit.chief_complaint?.trim() || null;

  const profile = [
    patient.species,
    patient.breed,
    formatAge(patient.birth_date, visit.visit_date),
    visit.weight_kg != null ? kg(visit.weight_kg) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const changes: string[] = [];
  if (prev) {
    const prevCc = prev.chief_complaint?.trim();
    if (prevCc) changes.push(`지난 ${prev.visit_date} 방문에는 ${prevCc}(으)로 내원하셨어요.`);
    if (cc) changes.push(`이번에는 ${cc}(으)로 내원하셨어요.`);
    if (prev.weight_kg != null && visit.weight_kg != null) {
      const d = visit.weight_kg - prev.weight_kg;
      // 소수점 둘째 자리까지가 저울 정밀도. 그 아래 차이는 변화로 말하지 않는다.
      const same = Math.abs(d) < 0.005;
      changes.push(
        same
          ? `체중은 ${kg(visit.weight_kg)}으로 지난 방문과 같아요.`
          : `체중은 ${kg(prev.weight_kg)} → ${kg(visit.weight_kg)} (${d > 0 ? "+" : "−"}${kg(Math.abs(d))})예요.`
      );
    }
  }

  return {
    title: cc ? `${cc} 진료 리포트` : `${visit.visit_date} 진료 리포트`,
    profile,
    changes,
    states: (visit.report_comment ?? "")
      .split("\n")
      .map((l) => l.replace(/^[-•·*]\s*/, "").trim())
      .filter(Boolean),
    notice: visit.report_notice?.trim() || null,
  };
}
