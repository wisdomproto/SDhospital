import { describe, it, expect } from "vitest";
import { CHECKUP_SECTIONS, findItem, toSpecies } from "@/lib/checkup/template";
import { evaluate, parseNumeric, countOutOfRange } from "@/lib/checkup/evaluate";

describe("템플릿", () => {
  it("섹션 키와 항목 키가 중복되지 않는다 — 저장 키가 겹치면 값이 덮인다", () => {
    const keys = CHECKUP_SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of CHECKUP_SECTIONS) {
      const ik = (s.items ?? []).map((i) => i.key);
      expect(new Set(ik).size, s.key).toBe(ik.length);
    }
  });

  it("종 문자열을 개/고양이로 맞춘다", () => {
    expect(toSpecies("개")).toBe("dog");
    expect(toSpecies("강아지")).toBe("dog");
    expect(toSpecies("고양이")).toBe("cat");
    expect(toSpecies("토끼")).toBeNull();
    expect(toSpecies(null)).toBeNull();
  });

  it("종별 참고범위가 실제 결과서와 같다", () => {
    // 개 6~31 / 고양이 18~33 — 결과서에서 확인한 값
    expect(findItem("chemistry", "BUN")?.ranges?.dog).toEqual({ min: 6, max: 31 });
    expect(findItem("chemistry", "BUN")?.ranges?.cat).toEqual({ min: 18, max: 33 });
    expect(findItem("cbc", "WBC")?.ranges?.dog).toEqual({ min: 5.05, max: 16.76 });
    expect(findItem("cbc", "WBC")?.ranges?.cat).toEqual({ min: 2.87, max: 17.02 });
  });
});

describe("parseNumeric", () => {
  it("숫자만 숫자로 읽는다", () => {
    expect(parseNumeric("44.2")).toBe(44.2);
    expect(parseNumeric(" -6.4 ")).toBe(-6.4);
  });

  it("결과서에 실제로 나오는 비수치 값은 숫자가 아니다", () => {
    for (const v of ["Negative", "음성", "2+", "4+", "<1/HPF", "검출되지 않음", "Panting(헐떡거림)", "Normal", ""]) {
      expect(parseNumeric(v), v).toBeNull();
    }
  });
});

describe("evaluate — 실제 결과서 값으로", () => {
  it("로지(개): BUN 44.2 는 높음, CREA 0.8 은 정상", () => {
    expect(evaluate("chemistry", "BUN", "44.2", "dog").verdict).toBe("high");
    expect(evaluate("chemistry", "CREA", "0.8", "dog").verdict).toBe("normal");
  });

  it("로지(개): RETIC-HGB 19.7 은 낮음 (22.3~29.6)", () => {
    expect(evaluate("cbc", "RETIC_HGB", "19.7", "dog").verdict).toBe("low");
  });

  it("몽글이(고양이): GLU 125.7 은 높음 — 개 기준(70~138)이면 정상이라 종을 틀리면 놓친다", () => {
    expect(evaluate("chemistry", "GLU", "125.7", "cat").verdict).toBe("high");
    expect(evaluate("chemistry", "GLU", "125.7", "dog").verdict).toBe("normal");
  });

  it("봉구(개): SDMA 20 은 높음, 토리(고양이) SDMA 14 는 상한값이라 정상", () => {
    expect(evaluate("chemistry_extra", "SDMA", "20", "dog").verdict).toBe("high");
    expect(evaluate("chemistry_extra", "SDMA", "14", "cat").verdict).toBe("normal");
  });

  it("음성이어야 하는 항목: 음성은 정상, 4+ 는 확인 필요", () => {
    expect(evaluate("heartworm", "HW_AG", "Negative", "dog").verdict).toBe("normal");
    expect(evaluate("urine_stick", "U_BLD", "음성", "cat").verdict).toBe("normal");
    expect(evaluate("urine_stick", "U_BLD", "4+", "cat").verdict).toBe("watch");
    expect(evaluate("urine_stick", "U_PRO", "1+", "cat").verdict).toBe("watch");
  });

  it("계산값(ALB/GLOB·BUN/CREA)은 판정하지 않는다", () => {
    expect(evaluate("chemistry", "ALB_GLOB", "0.9", "dog").verdict).toBe("unknown");
    expect(evaluate("chemistry", "BUN_CREA", "55.3", "dog").verdict).toBe("unknown");
  });

  it("참고범위가 없으면 정상이라고 하지 않는다", () => {
    // TG 는 고양이 참고범위가 결과서에 없다
    expect(evaluate("chemistry", "TG", "191.9", "cat").verdict).toBe("unknown");
    expect(evaluate("chemistry", "TG", "191.9", "dog").verdict).toBe("high");
  });

  it("종을 모르면 판정하지 않는다", () => {
    expect(evaluate("chemistry", "BUN", "44.2", null).verdict).toBe("unknown");
  });

  it("서술형: 이상 없음은 정상, 사람이 쓴 소견은 단정하지 않는다", () => {
    expect(evaluate("physical", "musculoskeletal", "촉진상 이상 없음", "dog").verdict).toBe("normal");
    expect(evaluate("physical", "cardiovascular", "청진 상 심잡음 확인 (murmur grade 3/6)", "dog").verdict).toBe(
      "unknown"
    );
  });

  it("호흡수 Panting 처럼 숫자가 아닌 활력징후도 깨지지 않는다", () => {
    const e = evaluate("vitals", "rr", "Panting(헐떡거림)", "dog");
    expect(e.numeric).toBeNull();
    expect(e.verdict).toBe("unknown");
  });

  it("범위를 벗어난 개수만 센다", () => {
    const values = [
      evaluate("chemistry", "BUN", "44.2", "dog"),   // high
      evaluate("chemistry", "TG", "191.9", "dog"),   // high
      evaluate("chemistry", "CREA", "0.8", "dog"),   // normal
      evaluate("chemistry", "ALB_GLOB", "0.9", "dog"), // unknown
    ];
    expect(countOutOfRange(values)).toBe(2);
  });
});
