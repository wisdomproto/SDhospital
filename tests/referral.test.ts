import { describe, it, expect } from "vitest";
import { referralStage, hospitalStats } from "@/lib/referral";

const stage = (o: Partial<Parameters<typeof referralStage>[0]>) =>
  referralStage({ closed_at: null, referred_back_at: null, admissions: [], ...o });

describe("referralStage", () => {
  it("진료 중 → 종료 → 환송", () => {
    expect(stage({})).toBe("in_care");
    expect(stage({ closed_at: "2026-07-20T00:00:00Z" })).toBe("closed");
    expect(stage({ closed_at: "2026-07-20T00:00:00Z", referred_back_at: "2026-07-21T00:00:00Z" })).toBe("referred_back");
  });

  it("입원 중이면 종료 여부보다 입원이 우선", () => {
    expect(stage({ admissions: [{ status: "admitted" }] })).toBe("admitted");
    expect(stage({ closed_at: "2026-07-20T00:00:00Z", admissions: [{ status: "admitted" }] })).toBe("admitted");
  });

  it("입원했다 퇴원하고 진료도 끝났으면 퇴원", () => {
    expect(stage({ closed_at: "2026-07-20T00:00:00Z", admissions: [{ status: "discharged" }] })).toBe("discharged");
  });

  it("환송했으면 입원 상태와 무관하게 환송 완료", () => {
    expect(stage({ referred_back_at: "2026-07-21T00:00:00Z", admissions: [{ status: "admitted" }] })).toBe("referred_back");
  });
});

describe("hospitalStats", () => {
  const hospitals = [
    { id: "h1", name: "애니컴" },
    { id: "h2", name: "아이원" },
  ];
  const map = new Map([
    ["p1", "h1"],
    ["p2", "h2"],
    ["p9", "h9"], // 없는 병원 → 무시
  ]);
  const today = "2026-07-28";

  it("최근 90일 / 직전 90일을 나눠 센다", () => {
    const [a] = hospitalStats(
      hospitals,
      [
        { patient_id: "p1", visit_date: "2026-07-01" }, // 최근
        { patient_id: "p1", visit_date: "2026-06-01" }, // 최근
        { patient_id: "p1", visit_date: "2026-03-01" }, // 직전
        { patient_id: "p1", visit_date: "2025-01-01" }, // 그 이전 (총합에만)
      ],
      map,
      today
    );
    expect([a.last90, a.prev90, a.total]).toEqual([2, 1, 4]);
    expect(a.lastReferralAt).toBe("2026-07-01");
    expect(a.wentQuiet).toBe(false);
  });

  it("최근 90일이 0인데 그 전에는 있었으면 이탈", () => {
    const s = hospitalStats(hospitals, [{ patient_id: "p2", visit_date: "2026-03-01" }], map, today);
    expect(s.find((x) => x.hospitalId === "h2")!.wentQuiet).toBe(true);
    // 의뢰가 아예 없던 곳은 이탈이 아니다
    expect(s.find((x) => x.hospitalId === "h1")!.wentQuiet).toBe(false);
  });

  it("진료 종료됐는데 환송 안 한 회차를 센다", () => {
    const [a] = hospitalStats(
      hospitals,
      [
        { patient_id: "p1", visit_date: "2026-07-01", closed_at: "2026-07-01T09:00:00Z", referred_back_at: null },
        { patient_id: "p1", visit_date: "2026-07-02", closed_at: "2026-07-02T09:00:00Z", referred_back_at: "2026-07-03T09:00:00Z" },
        { patient_id: "p1", visit_date: "2026-07-03", closed_at: null, referred_back_at: null }, // 진료 중은 안 센다
      ],
      map,
      today
    );
    expect(a.pendingReferBack).toBe(1);
  });

  it("최근 90일 많은 순으로 정렬된다", () => {
    const s = hospitalStats(
      hospitals,
      [
        { patient_id: "p2", visit_date: "2026-07-01" },
        { patient_id: "p2", visit_date: "2026-07-02" },
        { patient_id: "p1", visit_date: "2026-07-01" },
      ],
      map,
      today
    );
    expect(s.map((x) => x.hospitalId)).toEqual(["h2", "h1"]);
  });
});
