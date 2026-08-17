import { describe, expect, it } from "vitest";
import { suggestQuestions, type PatientContext } from "./context";

/**
 * 질문 버튼이 **화면에 무엇을 노출하는가**만 본다.
 * 예전엔 `chief_complaint` 를 그대로 인용했는데, 실제 값이 이런 것들이었다 —
 * 「검사자료(더케이동물병원)」(69명 중 최다) · 「안락사」 · 「폐사진단서 발송」.
 */
const ctx = (over: Partial<PatientContext> = {}) =>
  ({
    patient: { id: "1", name: "고구마", species: "개", breed: "믹스", sex: null, birth_date: null, note: null },
    text: "",
    logs: [],
    recentRx: [],
    lastVisit: { date: "2026-08-06", complaint: "검사자료(더케이동물병원)" },
    checkupCount: 0,
    admittedAt: null,
    ...over,
  }) as PatientContext;

describe("suggestQuestions", () => {
  it("⚠️ 주 증상을 인용하지 않는다 — 다른 병원 이름이 화면으로 새던 자리다", () => {
    for (const complaint of [
      "검사자료(더케이동물병원)",
      "외부검사결과(그린벳)",
      "정형외과) Lt.TPLO/수술1일",
      "TPLO 플레이트 제거*",
      "치료비 정산",
    ]) {
      const qs = suggestQuestions(ctx({ lastVisit: { date: "2026-08-06", complaint } }));
      expect(qs.join(" "), complaint).not.toContain(complaint);
      expect(qs.join(" ")).not.toMatch(/병원|그린벳|TPLO|정산/);
    }
  });

  it("날짜는 남긴다 — 그 아이 얘기인 건 전해져야 한다", () => {
    expect(suggestQuestions(ctx())[0]).toBe("2026-08-06에 다녀왔는데 지금도 괜찮을까요?");
  });

  it("⚠️⚠️ 떠난 아이에게 「지금도 괜찮을까요」를 띄우지 않는다", () => {
    const gone = suggestQuestions(
      ctx({
        patient: { ...ctx().patient, note: "2025-07-28 원내 안락사" } as PatientContext["patient"],
      })
    );
    expect(gone.join(" ")).not.toMatch(/괜찮을까요|지켜봐도|먹이|토했|건강 상태/);
    expect(gone.join(" ")).not.toContain("안락사");
    expect(gone.length).toBeGreaterThan(0);
  });

  it("떠난 아이가 아니면 평소 질문이 나온다", () => {
    const qs = suggestQuestions(ctx({ recentRx: ["카프로펜"] }));
    expect(qs).toContain("약 먹이고 나서 토했는데 다시 먹여도 될까요?");
    // ⚠️ 약 이름이 버튼에 실리면 안 된다
    expect(qs.join(" ")).not.toContain("카프로펜");
  });
});
