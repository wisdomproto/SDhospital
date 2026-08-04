import { describe, it, expect } from "vitest";
import {
  aggregate,
  baseline,
  bucketKey,
  hasAnything,
  isActive,
  recentChanges,
  shiftDate,
  summarize,
  weekStart,
  worstTone,
  type Intake,
  type LifeLog,
} from "@/lib/life-log";

const log = (o: Partial<LifeLog> & { logged_on: string }): LifeLog => ({
  appetite: null, stool: null, energy: null, weight_kg: null, meds: null, note: null, ...o,
});

describe("날짜", () => {
  it("월을 넘어간다", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-02-28", 1)).toBe("2026-03-01");
  });
  it("주는 월요일에서 시작한다", () => {
    // 2026-08-04 는 화요일
    expect(weekStart("2026-08-04")).toBe("2026-08-03");
    expect(weekStart("2026-08-03")).toBe("2026-08-03");
    expect(weekStart("2026-08-09")).toBe("2026-08-03"); // 일요일은 그 주에 남는다
  });
  it("묶는 키가 알갱이마다 다르다", () => {
    expect(bucketKey("2026-08-04", "day")).toBe("2026-08-04");
    expect(bucketKey("2026-08-04", "week")).toBe("2026-08-03");
    expect(bucketKey("2026-08-04", "month")).toBe("2026-08");
  });
});

describe("한 날짜", () => {
  it("하나만 골라도 저장할 값이 있다", () => {
    expect(hasAnything({ appetite: "well" })).toBe(true);
    expect(hasAnything({ weight_kg: 6.1 })).toBe(true);
    expect(hasAnything({ note: "   " })).toBe(false);
    expect(hasAnything({})).toBe(false);
  });
  it("안 고른 항목은 요약에 넣지 않는다", () => {
    expect(summarize(log({ logged_on: "2026-08-04", appetite: "well", weight_kg: 6.1 })))
      .toBe("식사 평소만큼 · 6.1kg");
    expect(summarize(log({ logged_on: "2026-08-04" }))).toBe("");
  });
  it("가장 나쁜 신호를 집는다", () => {
    expect(worstTone(log({ logged_on: "d", appetite: "well", stool: "blood" }))).toBe("alert");
    expect(worstTone(log({ logged_on: "d", appetite: "well" }))).toBe("good");
    expect(worstTone(log({ logged_on: "d" }))).toBe(null);
  });
});

describe("집계", () => {
  const logs = [
    log({ logged_on: "2026-08-03", appetite: "well", weight_kg: 6.0 }),
    log({ logged_on: "2026-08-04", appetite: "little", stool: "loose", note: "토함" }),
    log({ logged_on: "2026-08-10", appetite: "well", weight_kg: 6.2 }),
  ];

  it("일별은 그대로 셋", () => {
    expect(aggregate(logs, "day").map((b) => b.key)).toEqual(["2026-08-03", "2026-08-04", "2026-08-10"]);
  });

  it("주별은 같은 주를 묶는다", () => {
    const w = aggregate(logs, "week");
    expect(w.map((b) => b.key)).toEqual(["2026-08-03", "2026-08-10"]);
    expect(w[0].days).toBe(2);
    expect(w[0].tones.appetite).toEqual({ good: 1, watch: 1, alert: 0 });
    expect(w[0].tones.stool).toEqual({ good: 0, watch: 1, alert: 0 });
    expect(w[0].weight).toBe(6); // 체중을 적은 날만 평균
    expect(w[0].notes).toBe(1);
  });

  it("월별은 한 덩어리", () => {
    const m = aggregate(logs, "month");
    expect(m).toHaveLength(1);
    expect(m[0].days).toBe(3);
    expect(m[0].weight).toBe(6.1); // (6.0 + 6.2) / 2
  });

  it("안 고른 항목은 분포에서 세지 않는다", () => {
    const m = aggregate([log({ logged_on: "2026-08-04" })], "month");
    expect(m[0].days).toBe(1);
    expect(m[0].tones.appetite).toEqual({ good: 0, watch: 0, alert: 0 });
  });

  it("항상 시간순", () => {
    const shuffled = [logs[2], logs[0], logs[1]];
    expect(aggregate(shuffled, "day").map((b) => b.key))
      .toEqual(["2026-08-03", "2026-08-04", "2026-08-10"]);
  });
});

describe("평소 (채팅이 쓰는 것)", () => {
  it("기록이 적으면 근거가 안 된다고 말한다", () => {
    const b = baseline([log({ logged_on: "2026-08-03", appetite: "well" })], "2026-08-04");
    expect(b.enough).toBe(false);
  });
  it("7일 이상이면 비율을 낸다", () => {
    const logs = Array.from({ length: 10 }, (_, i) =>
      log({ logged_on: shiftDate("2026-08-04", -i), appetite: i < 8 ? "well" : "little" })
    );
    const b = baseline(logs, "2026-08-04");
    expect(b.enough).toBe(true);
    expect(b.appetiteGoodRate).toBe(80);
  });
  it("기간 밖은 안 센다", () => {
    const logs = [log({ logged_on: "2026-01-01", appetite: "well" })];
    expect(baseline(logs, "2026-08-04").days).toBe(0);
  });
});

describe("먹이는 것", () => {
  const mk = (o: Partial<Intake> & { id: string; started_on: string }): Intake => ({
    label: null, photo_path: null, stopped_on: null, ...o,
  });

  it("최근에 바뀐 것만 — 시작도 중단도 변화다", () => {
    const list = [
      mk({ id: "old", started_on: "2025-01-01" }),
      mk({ id: "new", started_on: "2026-08-01" }),
      mk({ id: "stopped", started_on: "2024-01-01", stopped_on: "2026-07-30" }),
    ];
    expect(recentChanges(list, "2026-08-04").map((i) => i.id).sort()).toEqual(["new", "stopped"]);
  });

  it("과일이든 사료든 구분하지 않는다 — 새로 준 건 다 잡힌다", () => {
    const list = [mk({ id: "fruit", label: "사과", started_on: "2026-08-02" })];
    expect(recentChanges(list, "2026-08-04")).toHaveLength(1);
  });

  it("끊은 것은 그날부터 빠진다", () => {
    const i = mk({ id: "x", started_on: "2026-08-01", stopped_on: "2026-08-03" });
    expect(isActive(i, "2026-08-02")).toBe(true);
    expect(isActive(i, "2026-08-03")).toBe(false);
    expect(isActive(i, "2026-07-31")).toBe(false);
  });
});
