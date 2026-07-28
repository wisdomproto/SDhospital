import { describe, it, expect } from "vitest";
import { buildOwnerReport, formatAge } from "@/lib/owner-report";

const pet = { name: "별이", species: "개", breed: "푸들", birth_date: "2011-06-14" };
const visit = {
  visit_date: "2026-07-25",
  chief_complaint: "보행 시 균형 불균형 및 안구 진탕",
  weight_kg: 6.36,
  report_comment: "보행 시 균형을 잡지 못하는 증상이 있어요\n눈이 왔다 갔다 하는 안구 진탕 증상이 있어요",
  report_notice: null,
};

describe("formatAge", () => {
  it("세 + 개월", () => {
    expect(formatAge("2011-06-14", "2026-07-25")).toBe("15세 1개월");
    expect(formatAge("2011-07-25", "2026-07-25")).toBe("15세");
    expect(formatAge("2026-03-01", "2026-07-25")).toBe("4개월");
  });

  it("생일이 아직 안 지났으면 개월을 빼서 센다", () => {
    expect(formatAge("2011-06-30", "2026-07-25")).toBe("15세 0개월".replace(" 0개월", ""));
  });

  it("모르거나 말이 안 되는 값은 표시하지 않는다", () => {
    expect(formatAge(null, "2026-07-25")).toBeNull();
    expect(formatAge("2027-01-01", "2026-07-25")).toBeNull();
  });
});

describe("buildOwnerReport", () => {
  it("주 증상이 제목이 되고, 없으면 날짜로 떨어진다", () => {
    expect(buildOwnerReport(pet, visit).title).toBe("보행 시 균형 불균형 및 안구 진탕 진료 리포트");
    expect(buildOwnerReport(pet, { ...visit, chief_complaint: "  " }).title).toBe("2026-07-25 진료 리포트");
  });

  it("프로필은 있는 값만 이어 붙인다", () => {
    expect(buildOwnerReport(pet, visit).profile).toBe("개 · 푸들 · 15세 1개월 · 6.36kg");
    expect(buildOwnerReport({ ...pet, breed: null, birth_date: null }, { ...visit, weight_kg: null }).profile).toBe("개");
  });

  it("코멘트는 줄 단위로 항목이 되고 글머리표는 지운다", () => {
    const r = buildOwnerReport(pet, { ...visit, report_comment: "- 첫 줄\n\n• 둘째 줄\n   \n셋째 줄" });
    expect(r.states).toEqual(["첫 줄", "둘째 줄", "셋째 줄"]);
  });

  it("직전 방문이 없으면 변화 섹션 자체가 없다", () => {
    expect(buildOwnerReport(pet, visit).changes).toEqual([]);
  });

  it("직전 방문과 비교해 내원 사유와 체중 변화를 만든다", () => {
    const prev = {
      visit_date: "2025-06-02",
      chief_complaint: "우측 눈 각막궤양",
      weight_kg: 6.1,
      report_comment: "안약 치료 중이에요",
      report_notice: null,
    };
    const r = buildOwnerReport(pet, visit, prev);
    expect(r.changes).toEqual([
      "지난 2025-06-02 방문에는 우측 눈 각막궤양(으)로 내원하셨어요.",
      "이번에는 보행 시 균형 불균형 및 안구 진탕(으)로 내원하셨어요.",
      "체중은 6.1kg → 6.36kg (+0.26kg)예요.",
    ]);
  });

  it("체중이 같으면 늘었다 줄었다 말하지 않는다", () => {
    const prev = { ...visit, visit_date: "2026-05-01", chief_complaint: null };
    const r = buildOwnerReport(pet, visit, prev);
    expect(r.changes).toContain("체중은 6.36kg으로 지난 방문과 같아요.");
  });

  it("체중이 한쪽만 있으면 체중 문장을 만들지 않는다", () => {
    const prev = { ...visit, visit_date: "2026-05-01", weight_kg: null };
    expect(buildOwnerReport(pet, visit, prev).changes.some((c) => c.includes("체중"))).toBe(false);
  });

  it("추가 안내는 비면 null", () => {
    expect(buildOwnerReport(pet, { ...visit, report_notice: "  " }).notice).toBeNull();
    expect(buildOwnerReport(pet, { ...visit, report_notice: "계단을 피해주세요" }).notice).toBe("계단을 피해주세요");
  });
});
