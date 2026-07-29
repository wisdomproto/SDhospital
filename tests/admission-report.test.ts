import { describe, it, expect } from "vitest";
import { dailyLines, canSendDaily, dailySummary, FEEDING, ELIMINATION } from "@/lib/admission-report";

const base = { feeding: null, elimination: null, special: null, comment: null };

describe("선택지", () => {
  it("키가 중복되지 않는다 — 저장된 값이 두 문장을 가리키면 안 된다", () => {
    for (const list of [FEEDING, ELIMINATION]) {
      expect(new Set(list.map((o) => o.key)).size).toBe(list.length);
    }
  });
});

describe("dailyLines", () => {
  it("고른 것만 줄이 된다", () => {
    expect(dailyLines(base)).toEqual([]);
    expect(dailyLines({ ...base, feeding: "well" })).toEqual([
      { label: "식사", text: "밥을 잘 먹었어요", tone: "good" },
    ]);
  });

  it("식사·배변·특이사항·담당의 순서로 나간다", () => {
    const lines = dailyLines({
      feeding: "some",
      elimination: "loose",
      special: "오후에 한 번 토했습니다",
      comment: "내일 아침 재검합니다",
    });
    expect(lines.map((l) => l.label)).toEqual(["식사", "배변", "특이사항", "담당의"]);
    expect(lines[0].tone).toBe("watch");
    expect(lines[2].tone).toBe("alert");
  });

  it("모르는 값이 저장돼 있으면 그 줄을 만들지 않는다 (빈 문자열이 나가지 않게)", () => {
    expect(dailyLines({ ...base, feeding: "폐기된값" })).toEqual([]);
  });

  it("공백만 있는 특이사항·코멘트는 줄이 되지 않는다", () => {
    expect(dailyLines({ ...base, special: "   ", comment: "\n" })).toEqual([]);
  });
});

describe("canSendDaily", () => {
  it("식사나 배변 하나만 골라도 보낼 수 있다", () => {
    expect(canSendDaily({ ...base, feeding: "well" })).toBe(true);
    expect(canSendDaily({ ...base, elimination: "normal" })).toBe(true);
  });

  it("특이사항이나 코멘트만 있어도 보낼 수 있다", () => {
    expect(canSendDaily({ ...base, special: "토함" })).toBe(true);
    expect(canSendDaily({ ...base, comment: "경과 양호" })).toBe(true);
  });

  it("아무것도 없으면 못 보낸다", () => {
    expect(canSendDaily(base)).toBe(false);
    expect(canSendDaily({ ...base, special: "  ", feeding: "없는키" })).toBe(false);
  });
});

describe("dailySummary", () => {
  it("직원용 짧은 요약", () => {
    expect(dailySummary({ ...base, feeding: "well", elimination: "loose" })).toBe("잘 먹음 · 묽은 변");
    expect(dailySummary({ ...base, feeding: "npo", special: "구토 2회" })).toBe("금식 · 특이사항: 구토 2회");
  });

  it("고른 게 없으면 코멘트로 떨어진다", () => {
    expect(dailySummary({ ...base, comment: "경과 양호" })).toBe("경과 양호");
    expect(dailySummary(base)).toBe("");
  });
});
