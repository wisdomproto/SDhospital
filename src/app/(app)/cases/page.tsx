import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { createCase, toggleCase, deleteCase } from "./actions";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: cases }, { data: complaints }] = await Promise.all([
    supabase
      .from("case_story")
      .select("id, title, url, tags, species, active")
      .order("created_at", { ascending: false }),
    // 실제로 어떤 주 증상이 쓰이는지 보여준다 — 태그는 이 말들과 맞아야 붙는다
    supabase
      .from("visit")
      .select("chief_complaint")
      .not("chief_complaint", "is", null)
      .order("visit_date", { ascending: false })
      .limit(300),
  ]);

  const seen = new Map<string, number>();
  for (const c of complaints ?? []) {
    const k = c.chief_complaint!.trim();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const topComplaints = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div style={{ maxWidth: 900, display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">Case Stories</p>
        <h1 className="page-title">치료 사례</h1>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>
          병원 블로그 글을 <b>같은 문제로 온 환자의 리포트 아래에 붙입니다.</b> 새로 쓸 글은 없습니다 —
          링크와 태그만 등록하면 됩니다.
        </p>
      </div>

      {error && <p className="pill warning" style={{ padding: "10px 14px", margin: 0 }}>{error}</p>}

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">등록된 사례</h2>
          <span className="pill muted">{(cases ?? []).length}건</span>
        </div>
        <DataTable
          headers={["제목", "태그", "종", "상태", ""]}
          empty="등록된 사례가 없습니다."
          rows={(cases ?? []).map((c) => [
            <a key="t" href={c.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
              {c.title}
            </a>,
            <span key="g" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {c.tags.map((t) => (
                <span key={t} className="pill muted" style={{ fontSize: ".72rem" }}>{t}</span>
              ))}
            </span>,
            c.species ?? "전체",
            c.active ? (
              <span key="s" className="pill success">노출 중</span>
            ) : (
              <span key="s" className="pill muted">숨김</span>
            ),
            <span key="a" style={{ display: "flex", gap: 8 }}>
              <form action={toggleCase.bind(null, c.id, !c.active)}>
                <button className="link-btn">{c.active ? "숨기기" : "노출"}</button>
              </form>
              <form action={deleteCase.bind(null, c.id)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </span>,
          ])}
        />
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">사례 추가</h2></div>
        <form action={createCase} style={{ display: "grid", gap: 12 }}>
          <FormField label="제목">
            <input name="title" required placeholder="예) 슬개골 탈구 3기 교정술 사례" className={inputClass} />
          </FormField>
          <FormField label="링크 (병원 블로그 글 주소)">
            <input name="url" required placeholder="https://sdamc.co.kr/..." className={inputClass} />
          </FormField>
          <FormField label="한 줄 소개 (선택)">
            <input name="summary" placeholder="예) 수술 후 4주 만에 다시 걷게 된 말티즈 이야기" className={inputClass} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <FormField label="태그 · 쉼표로 구분">
              <input name="tags" required placeholder="슬개골, 탈구" className={inputClass} />
            </FormField>
            <FormField label="종">
              <select name="species" className={inputClass} defaultValue="">
                <option value="">전체</option>
                <option value="강아지">강아지</option>
                <option value="고양이">고양이</option>
              </select>
            </FormField>
          </div>
          <div><SubmitButton>등록</SubmitButton></div>
        </form>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
            <b>태그는 주 증상에 들어가는 말로 적어주세요.</b> 주 증상 안에 그 말이 있으면 붙습니다.
            실제로 많이 쓰인 주 증상:
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {topComplaints.map(([c, n]) => (
              <span key={c} className="pill muted" style={{ fontSize: ".74rem" }}>
                {c} · {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
