import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

/**
 * 치료 사례 둘러보기.
 *
 * 리포트 아래에 붙는 사례는 **그 회차의 문제와 맞는 것만** 나온다(그게 규칙이다).
 * 그래서 "우리 아이 병 말고 이 병원이 뭘 하는지" 를 보고 싶은 보호자는 볼 방법이 없었다.
 * 여기가 그 방법이다 — 병원이 쌓아 둔 기록 전부를 검색으로 뒤진다.
 *
 * 읽는 건 병원 홈페이지에서 읽는다. 우리는 목록과 검색만 준다.
 */
/** 자주 찾는 말. 태그 분포 상위에서 고른 것이라 눌렀을 때 빈 화면이 안 나온다 */
const POPULAR = ["슬개골", "십자인대", "디스크", "심잡음", "종괴", "결석", "피부", "치아"];

export default async function PortalCases({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const supabase = await createClient();

  const { data: p } = await supabase.from("patient").select("id, name, species").eq("id", id).single();
  if (!p) notFound();

  // PostgREST 의 `or` 는 콤마로 조건을 나눈다 — 검색어에 콤마·중괄호가 있으면 조건이 쪼개진다
  const term = (q ?? "").trim().slice(0, 40).replace(/[,{}()*%\\]/g, " ").trim();

  // 442건을 한 번에 내보내면 응답이 400KB 다 — 첫 화면은 최근 것만 주고 나머지는 검색으로 찾는다
  const LIMIT = term ? 120 : 40;
  let query = supabase
    .from("case_story")
    .select("id, title, summary, url, tags, species", { count: "exact" })
    .eq("active", true);
  if (term) query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%,tags.cs.{${term}}`);
  const { data: all, count } = await query.order("created_at", { ascending: false }).limit(LIMIT);

  const rows = all ?? [];
  // 우리 아이와 같은 종이 위로. 종 무관 글은 그다음, 다른 종은 맨 아래 —
  // 지우지는 않는다. 고양이 보호자가 강아지 사례를 못 볼 이유는 없다.
  const rank = (s: string | null) => (s === p.species ? 0 : s === null ? 1 : 2);
  const sorted = [...rows].sort((a, b) => rank(a.species) - rank(b.species));
  const total = count ?? rows.length;

  return (
    <>
      <form className="case-search" action={`/portal/patients/${id}/cases`}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="증상이나 병명으로 찾아보세요 (예: 슬개골, 혈뇨)"
          aria-label="치료 사례 검색"
          enterKeyHint="search"
        />
        <button type="submit">검색</button>
      </form>

      {/* 442건을 훑게 두면 아무도 안 훑는다. 자주 찾는 말은 눌러서 바로 들어가게 한다 */}
      <div className="case-chips">
        {POPULAR.map((t) => (
          <a key={t} href={`/portal/patients/${id}/cases?q=${encodeURIComponent(t)}`} className={`case-chip${term === t ? " on" : ""}`}>
            {t}
          </a>
        ))}
        {term && (
          <a href={`/portal/patients/${id}/cases`} className="case-chip clear">
            전체
          </a>
        )}
      </div>

      <p className="portal-tile-sub" style={{ margin: "0 2px 10px" }}>
        {term ? (
          <>
            <b>{term}</b> · {total}건{total > sorted.length && ` 중 ${sorted.length}건`}
          </>
        ) : (
          <>
            병원이 기록해 둔 치료 이야기 {total}건이에요. 최근 것부터 {sorted.length}건을 보여드려요 —
            찾는 증상이 있으면 검색해 주세요. 아이마다 상태가 달라 경과는 다를 수 있어요.
          </>
        )}
      </p>

      {sorted.length === 0 && (
        <div className="portal-card" style={{ textAlign: "center", color: "var(--muted)" }}>
          찾는 사례가 없어요. 다른 말로 검색해 보시거나 병원에 물어봐 주세요.
        </div>
      )}

      <div className="notice-list">
        {sorted.map((c) => (
          <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="portal-card case-row">
            <div className="case-title">{c.title}</div>
            {c.summary && <p className="case-summary">{c.summary}</p>}
            <div className="case-tags">
              {c.species && <span className={`case-tag${c.species === p.species ? " same" : ""}`}>{c.species}</span>}
              {c.tags.map((t) => (
                <span key={t} className="case-tag">
                  {t}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
