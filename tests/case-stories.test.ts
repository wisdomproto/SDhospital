import { describe, it, expect } from "vitest";
import { matchCaseStories, type CaseStory } from "@/lib/case-stories";

const story = (o: Partial<CaseStory> & { id: string }): CaseStory => ({
  title: o.id,
  summary: null,
  url: `https://sdamc.co.kr/${o.id}`,
  tags: [],
  species: null,
  ...o,
});

const stories = [
  story({ id: "patella", tags: ["슬개골"], species: "강아지" }),
  story({ id: "patella-3", tags: ["슬개골", "탈구"], species: "강아지" }),
  story({ id: "ccl", tags: ["십자인대"], species: "강아지" }),
  story({ id: "cat-gi", tags: ["구토"], species: "고양이" }),
  story({ id: "any-skin", tags: ["피부"], species: null }),
];

describe("matchCaseStories", () => {
  it("주 증상에 태그가 들어 있으면 붙인다", () => {
    const m = matchCaseStories(stories, { chiefComplaint: "슬개골 탈구 3기", species: "강아지" });
    expect(m.map((s) => s.id)).toEqual(["patella-3", "patella"]);
  });

  it("태그가 더 많이 맞은 사례가 위로 온다", () => {
    const m = matchCaseStories(stories, { chiefComplaint: "슬개골 탈구", species: "강아지" });
    expect(m[0].id).toBe("patella-3");
  });

  it("종이 다르면 붙이지 않는다 — 고양이 보호자에게 강아지 사례는 남 얘기다", () => {
    const m = matchCaseStories(stories, { chiefComplaint: "슬개골 탈구", species: "고양이" });
    expect(m).toEqual([]);
  });

  it("종을 지정하지 않은 사례는 아무 환자에게나 붙는다", () => {
    const m = matchCaseStories(stories, { chiefComplaint: "피부 소양감 지속", species: "고양이" });
    expect(m.map((s) => s.id)).toEqual(["any-skin"]);
  });

  it("맞는 게 없으면 빈 배열 — 억지로 채우면 광고로 읽힌다", () => {
    expect(matchCaseStories(stories, { chiefComplaint: "건강검진", species: "강아지" })).toEqual([]);
  });

  it("주 증상이 비어 있으면 아무것도 붙이지 않는다", () => {
    expect(matchCaseStories(stories, { chiefComplaint: null, species: "강아지" })).toEqual([]);
    expect(matchCaseStories(stories, { chiefComplaint: "  ", species: "강아지" })).toEqual([]);
  });

  it("기본 3건까지만", () => {
    const many = Array.from({ length: 6 }, (_, i) => story({ id: `s${i}`, tags: ["구토"] }));
    expect(matchCaseStories(many, { chiefComplaint: "구토 반복", species: "강아지" })).toHaveLength(3);
  });

  it("빈 태그는 무시한다 (전부 매칭되면 안 된다)", () => {
    const bad = [story({ id: "empty", tags: ["", "  "] })];
    expect(matchCaseStories(bad, { chiefComplaint: "슬개골 탈구", species: "강아지" })).toEqual([]);
  });
});
