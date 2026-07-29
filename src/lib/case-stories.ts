/**
 * 치료 사례 붙이기.
 *
 * 병원 블로그에 이미 수백 건의 치료 사례가 쌓여 있다. 보호자가 그걸 못 볼 뿐이다.
 * 우리 아이와 **같은 문제**로 치료받은 사례가 리포트 아래에 붙으면
 * "이 병원이 이걸 많이 한다"가 설명 없이 전달된다 — 병원이 새로 쓸 글도 없다.
 *
 * 매칭은 기계적이다. 사례에 붙인 태그가 그 회차의 주 증상에 들어 있으면 붙인다.
 * AI 로 "비슷한 사례"를 고르지 않는 이유는 리포트와 같다 — 틀렸을 때 그 책임을 병원이 진다.
 * 태그는 수의사가 직접 단다.
 */

export type CaseStory = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  tags: string[];
  /** null = 종 무관 */
  species: string | null;
};

export type MatchTarget = {
  chiefComplaint: string | null;
  species: string | null;
};

/** 태그가 주 증상 안에 통째로 들어 있으면 같은 문제로 본다 ("슬개골" ⊂ "슬개골 탈구 3기") */
function hits(story: CaseStory, cc: string): number {
  return story.tags.filter((t) => t.trim() && cc.includes(t.trim())).length;
}

/**
 * 이 회차에 붙일 사례. 없으면 빈 배열 — **억지로 채우지 않는다.**
 * 상관없는 사례가 붙으면 보호자는 그걸 광고로 읽고, 그 순간 리포트 전체의 신뢰가 깎인다.
 */
export function matchCaseStories(
  stories: CaseStory[],
  target: MatchTarget,
  limit = 3
): CaseStory[] {
  const cc = target.chiefComplaint?.trim();
  if (!cc) return [];

  return stories
    .filter((s) => !s.species || !target.species || s.species === target.species)
    .map((s) => ({ s, n: hits(s, cc) }))
    .filter((x) => x.n > 0)
    // 더 구체적으로 맞은 것(태그가 여러 개 걸린 것)이 위로
    .sort((a, b) => b.n - a.n || a.s.title.localeCompare(b.s.title))
    .slice(0, limit)
    .map((x) => x.s);
}
