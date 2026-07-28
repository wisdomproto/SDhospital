/**
 * 의뢰 환자의 진행 상태.
 *
 * 상태를 컬럼으로 저장하지 않는 이유: 이미 있는 사실에서 전부 파생된다.
 * 저장하면 실제 상태와 어긋나는 순간이 반드시 오고, 그걸 맞추는 코드를 또 짜야 한다.
 */
export type ReferralStage =
  | "in_care" // 진료 중
  | "admitted" // 입원 중
  | "discharged" // 퇴원, 아직 환송 전
  | "closed" // 진료 종료, 입원 없음
  | "referred_back"; // 환송 완료

export type StageInput = {
  closed_at: string | null;
  referred_back_at: string | null;
  admissions: { status: string }[];
};

export function referralStage(v: StageInput): ReferralStage {
  if (v.referred_back_at) return "referred_back";
  const adm = v.admissions ?? [];
  if (adm.some((a) => a.status === "admitted")) return "admitted";
  if (adm.length > 0 && v.closed_at) return "discharged";
  if (v.closed_at) return "closed";
  return "in_care";
}

export const STAGE_LABEL: Record<ReferralStage, string> = {
  in_care: "진료 중",
  admitted: "입원 중",
  discharged: "퇴원",
  closed: "진료 종료",
  referred_back: "환송 완료",
};

/** 화면 pill 클래스 */
export const STAGE_TONE: Record<ReferralStage, string> = {
  in_care: "warning",
  admitted: "warning",
  discharged: "",
  closed: "",
  referred_back: "success",
};

export type HospitalStat = {
  hospitalId: string;
  name: string;
  total: number;
  last90: number;
  prev90: number;
  lastReferralAt: string | null;
  /** 최근 90일 의뢰가 0인데 그 전에는 있었던 곳 — 관리 대상 */
  wentQuiet: boolean;
  /** 진료는 끝났는데 아직 회신을 안 보낸 회차 수 — 우리가 밀린 일 */
  pendingReferBack: number;
};

/**
 * 병원별 의뢰 집계. "누구를 만나러 가야 하는지" 를 답하는 게 목적이라
 * 총건수보다 **최근 90일 vs 그 전 90일** 비교와 이탈 여부가 핵심이다.
 */
export function hospitalStats(
  hospitals: { id: string; name: string }[],
  visits: { patient_id: string; visit_date: string; closed_at?: string | null; referred_back_at?: string | null }[],
  patientHospital: Map<string, string>,
  today: string
): HospitalStat[] {
  const day = 86_400_000;
  const t = Date.parse(today + "T00:00:00+09:00");
  const cut90 = t - 90 * day;
  const cut180 = t - 180 * day;

  const acc = new Map<string, { total: number; last90: number; prev90: number; last: string | null; pending: number }>();
  for (const h of hospitals) acc.set(h.id, { total: 0, last90: 0, prev90: 0, last: null, pending: 0 });

  for (const v of visits) {
    const hid = patientHospital.get(v.patient_id);
    if (!hid) continue;
    const a = acc.get(hid);
    if (!a) continue;
    const ts = Date.parse(v.visit_date + "T00:00:00+09:00");
    a.total += 1;
    if (ts >= cut90) a.last90 += 1;
    else if (ts >= cut180) a.prev90 += 1;
    if (!a.last || v.visit_date > a.last) a.last = v.visit_date;
    if (v.closed_at && !v.referred_back_at) a.pending += 1;
  }

  return hospitals
    .map((h) => {
      const a = acc.get(h.id)!;
      return {
        hospitalId: h.id,
        name: h.name,
        total: a.total,
        last90: a.last90,
        prev90: a.prev90,
        lastReferralAt: a.last,
        wentQuiet: a.last90 === 0 && a.prev90 > 0,
        pendingReferBack: a.pending,
      };
    })
    .sort((x, y) => y.last90 - x.last90 || y.total - x.total);
}
