import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { CHECKUP_SECTIONS, rangeText, toSpecies } from "@/lib/checkup/template";
import { evaluate, VERDICT_LABEL } from "@/lib/checkup/evaluate";
import { saveCheckup, deleteCheckup } from "./actions";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CheckupEntry({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; checkupId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: patientId, checkupId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("checkup")
    .select("id, visit_id, checked_on, vet_name, conclusion, recheck_on, recheck_note, sent_at, read_at, patient:patient_id(name, species)")
    .eq("id", checkupId)
    .single();
  if (!c) notFound();

  const { data: rows } = await supabase
    .from("checkup_value")
    .select("section_key, item_key, value, side, note")
    .eq("checkup_id", checkupId);

  const pat = c.patient as unknown as { name: string; species: string | null } | null;
  const species = toSpecies(pat?.species);
  // `섹션|항목|좌우` 로 찾는다 — 폼 이름과 같은 규칙이라 헷갈릴 일이 없다
  const saved = new Map<string, string>();
  const notes = new Map<string, string>();
  for (const r of rows ?? []) {
    if (r.item_key === "_note") notes.set(r.section_key, r.note ?? "");
    else saved.set(`${r.section_key}|${r.item_key}${r.side ? `|${r.side}` : ""}`, r.value ?? "");
  }
  const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">건강검진</p>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.checked_on}
            {c.sent_at ? (
              c.read_at ? <span className="pill success">읽음 · {fmt(c.read_at)}</span>
                        : <span className="pill">발송됨 · {fmt(c.sent_at)}</span>
            ) : (
              <span className="pill warning">미발송</span>
            )}
          </h1>
        </div>
        <Link href={`/patients/${patientId}/v/${c.visit_id}`} className="link-btn">← 진료 회차</Link>
      </div>

      {error && <p className="pill warning" style={{ padding: "10px 14px", margin: 0 }}>{error}</p>}
      {!species && (
        <p className="pill warning" style={{ padding: "10px 14px", margin: 0 }}>
          종이 개·고양이가 아니라 참고범위 판정을 하지 않습니다. 값은 그대로 저장됩니다.
        </p>
      )}

      <form action={saveCheckup.bind(null, patientId, checkupId)} style={{ display: "grid", gap: 20 }}>
        <div className="card">
          <div className="card-head"><h2 className="section-title">기본 정보</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
            <FormField label="검진일">
              <input type="date" name="checked_on" defaultValue={c.checked_on} className={inputClass} />
            </FormField>
            <FormField label="담당의">
              <input name="vet_name" defaultValue={c.vet_name ?? ""} placeholder="예) 김수의" className={inputClass} />
            </FormField>
            <FormField label="다음 확인 (재검일)">
              <input type="date" name="recheck_on" defaultValue={c.recheck_on ?? ""} className={inputClass} />
            </FormField>
            <FormField label="재검 안내">
              <input name="recheck_note" defaultValue={c.recheck_note ?? ""} placeholder="예) 3개월 뒤 신장 수치 재검" className={inputClass} />
            </FormField>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2 className="section-title">담당의 종합 소견</h2></div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            <b>여기 쓴 글은 보호자에게 그대로 나갑니다.</b> 수치는 우리가 판정해서 보여주니,
            무엇을 지켜봐야 하는지를 적어주세요.
          </p>
          <textarea
            name="conclusion"
            rows={6}
            data-grow
            defaultValue={c.conclusion ?? ""}
            placeholder={"예) 지난 검진 대비 신장 관련 수치(BUN·CREA·SDMA)가 상한 쪽으로 올라와 있습니다.\n지금 당장 치료가 필요한 단계는 아니지만 3개월 뒤 재검으로 흐름을 보겠습니다."}
            className={inputClass}
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="section-title">검사 결과</h2>
            <span className="pill muted">{saved.size}개 입력됨</span>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            한 검진에서 전부 하지 않습니다. <b>빈칸은 저장하지 않고 결과서에도 나오지 않습니다</b> —
            안 한 검사를 빈칸으로 남기면 보호자는 “안 해준 것”으로 읽습니다.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {CHECKUP_SECTIONS.map((s) => {
              const filled = (s.items ?? []).some((i) =>
                s.bilateral
                  ? saved.has(`${s.key}|${i.key}|L`) || saved.has(`${s.key}|${i.key}|R`)
                  : saved.has(`${s.key}|${i.key}`)
              ) || notes.has(s.key);
              return (
                <details key={s.key} className="checkup-section entry" open={filled}>
                  <summary>
                    {s.title}
                    {filled && <span className="pill muted" style={{ marginLeft: 8 }}>입력됨</span>}
                  </summary>
                  {!s.narrative && (
                    <table className="checkup-table checkup-entry">
                      <thead>
                        <tr>
                          <th>항목</th>
                          {s.bilateral ? <><th>좌 (OS)</th><th>우 (OD)</th></> : <th>결과</th>}
                          <th>참고범위</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(s.items ?? []).map((i) => {
                          const r = species ? i.ranges?.[species] : undefined;
                          const cell = (side: string | null) => {
                            const name = `v|${s.key}|${i.key}${side ? `|${side}` : ""}`;
                            const val = saved.get(`${s.key}|${i.key}${side ? `|${side}` : ""}`) ?? "";
                            const e = val ? evaluate(s.key, i.key, val, species) : null;
                            const bad = e && e.verdict !== "normal" && e.verdict !== "unknown";
                            return (
                              <td key={name}>
                                <input name={name} defaultValue={val} className={inputClass} />
                                {bad && <span className={`vd ${e.verdict}`}>{VERDICT_LABEL[e.verdict]}</span>}
                              </td>
                            );
                          };
                          return (
                            <tr key={i.key}>
                              <td>
                                {i.label}
                                {i.unit && <span className="unit"> {i.unit}</span>}
                              </td>
                              {s.bilateral ? <>{cell("L")}{cell("R")}</> : cell(null)}
                              <td className="ref">{rangeText(r)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <textarea
                    name={`n|${s.key}`}
                    rows={s.narrative ? 3 : 2}
                    data-grow
                    defaultValue={notes.get(s.key) ?? ""}
                    placeholder={s.narrative ? "소견을 적어주세요" : "이 검사에 대한 소견 (선택)"}
                    className={inputClass}
                    style={{ marginTop: 8 }}
                  />
                </details>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SubmitButton>저장</SubmitButton>
          <button name="send" value="1" className="btn btn-primary">
            {c.sent_at ? "저장하고 다시 발송" : "저장하고 보호자에게 발송"}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            발송하면 보호자 앱에 결과가 보이고 알림이 갑니다.
          </span>
        </div>
      </form>

      <form action={deleteCheckup.bind(null, patientId, c.visit_id, checkupId)}>
        <button className="link-btn danger">이 검진 삭제</button>
      </form>
    </div>
  );
}
