import { describe, expect, it } from "vitest";
import { scenariosFor } from "./scenario";

const KEYS = (a: Parameters<typeof scenariosFor>[0], t = "2026-08-17") =>
  scenariosFor(a, t).map((s) => s.key);
const at = (a: Parameters<typeof scenariosFor>[0], key: string, t = "2026-08-17") =>
  scenariosFor(a, t).find((s) => s.key === key)!.asOf;

describe("scenariosFor", () => {
  it("입원 이력이 없으면 「지금」 하나뿐이다 — 없는 입원을 지어내지 않는다", () => {
    expect(KEYS([])).toEqual(["now"]);
  });

  it("기준일이 실제로 그 상태에 떨어진다", () => {
    const a = [{ admitted_at: "2026-07-01", discharged_at: "2026-07-09" }];
    expect(at(a, "before")).toBe("2026-06-30"); // 입원 전날
    expect(at(a, "during")).toBe("2026-07-05"); // 입원 한가운데
    expect(at(a, "after")).toBe("2026-07-12"); // 퇴원 3일째
    expect(at(a, "now")).toBeNull(); // 진짜 오늘
  });

  it("입원 중 기준일은 퇴원일을 넘지 않는다 — 당일 입퇴원이어도", () => {
    const a = [{ admitted_at: "2026-07-01", discharged_at: "2026-07-01" }];
    expect(at(a, "during")).toBe("2026-07-01");
  });

  it("퇴원 기록이 없으면 「퇴원 3일째」를 만들지 않는다", () => {
    expect(KEYS([{ admitted_at: "2026-07-01", discharged_at: null }])).toEqual([
      "before",
      "during",
      "now",
    ]);
  });

  it("가장 최근 입원을 쓴다", () => {
    const a = [
      { admitted_at: "2019-03-02", discharged_at: "2019-03-10" },
      { admitted_at: "2026-07-01", discharged_at: "2026-07-09" },
    ];
    expect(at(a, "after")).toBe("2026-07-12");
  });
});
