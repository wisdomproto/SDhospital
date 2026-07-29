import { createClient } from "@/lib/supabase/server";
import { unreadFeed } from "@/lib/reports";
import Link from "next/link";

export default async function PortalVisits({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // 입원은 회차에 딸린 기록이라 탭을 따로 두지 않고 그 회차 아래에서 이어 본다
  const [{ data: visits }, { data: admissions }, { data: consents }] = await Promise.all([
    supabase
      .from("visit")
      .select("id, visit_date, visit_no, report_comment, report_sent_at, report_read_at")
      .eq("patient_id", id)
      .order("visit_date", { ascending: false }),
    supabase
      .from("admission")
      .select("id, visit_id, admitted_at, discharged_at, status")
      .eq("patient_id", id),
    // 동의서도 회차에 딸린 기록이다 — 병원에서 오면 여기서 찾는다
    supabase
      .from("consent")
      .select("id, visit_id, form_title, signed_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // 입원 경과는 매일 오는데 목록에 표시가 없으면 온 줄을 모른다
  const { data: unreadRows } = await supabase
    .from("admission_report")
    .select("id, admission_id, admission:admission_id!inner(patient_id)")
    .eq("admission.patient_id", id)
    .not("sent_at", "is", null)
    .is("read_at", null);
  const unreadByAdmission = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    unreadByAdmission.set(r.admission_id, (unreadByAdmission.get(r.admission_id) ?? 0) + 1);
  }

  // 배지가 "3건 있다"고만 말하고 어디 있는지 안 알려주면 보호자가 목록을 뒤져야 한다.
  // 안 읽은 것만 위에 모아 준다 — 아래 목록은 시간순 그대로 둔다.
  const fresh = await unreadFeed(supabase, id, `/portal/patients/${id}`);
  const pending = (consents ?? []).filter((c) => c.signed_at == null);

  return (
    <>
      {(fresh.length > 0 || pending.length > 0) && (
        <div className="portal-card fresh-card">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            확인이 필요해요 {fresh.length + pending.length}건
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {pending.map((c) => (
              <Link key={c.id} href={`/portal/patients/${id}/consents/${c.id}`} className="fresh-row">
                <span className="dot-new" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: ".9rem" }}>{c.form_title}</span>
                  <span className="portal-tile-sub">서명이 필요합니다</span>
                </span>
                <span style={{ color: "var(--muted)" }}>›</span>
              </Link>
            ))}
            {fresh.map((f) => (
              <Link key={f.key} href={f.href} className="fresh-row">
                <span className="dot-new" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: ".9rem" }}>
                    {f.title} · {f.date}
                  </span>
                  <span className="portal-tile-sub portal-tile-clamp">{f.comment}</span>
                </span>
                <span style={{ color: "var(--muted)" }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: "1.05rem", padding: "2px 2px 4px" }}>진료 회차</div>
      {(visits ?? []).length === 0 && <div className="empty-state">진료 기록이 없습니다.</div>}
      {(visits ?? []).map((v) => (
        <div key={v.id} style={{ display: "grid", gap: 6 }}>
        <Link href={`/portal/patients/${id}/visits/${v.id}`} className="portal-tile" style={{ alignItems: "flex-start" }}>
          <span className="portal-chip" style={{ background: "#e8f0ff", color: "var(--primary)", fontWeight: 900, fontSize: ".92rem" }}>
            {v.visit_no != null ? `${v.visit_no}회` : "·"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="portal-tile-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {v.visit_date}
              {v.report_sent_at && v.report_read_at == null && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: ".64rem",
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  새 리포트
                </span>
              )}
            </div>
            <div className="portal-tile-sub portal-tile-clamp">
              {/* 담당의 코멘트만 보여준다. 진료 내용 원문은 의료진 기록이라 보호자에게 내보내지 않는다 */}
              {v.report_sent_at ? v.report_comment || "내용 없음" : "리포트 준비 중입니다"}
            </div>
          </div>
          <span style={{ color: "var(--muted)", fontSize: "1.2rem" }}>›</span>
        </Link>
        {(consents ?? [])
          .filter((c) => c.visit_id === v.id)
          .map((c) => (
            <Link
              key={c.id}
              href={`/portal/patients/${id}/consents/${c.id}`}
              className={`portal-tile portal-subtile${c.signed_at == null ? " tile-new" : ""}`}
            >
              <span aria-hidden style={{ fontSize: 15 }}>📝</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: ".88rem" }}>{c.form_title}</div>
                <div className="portal-tile-sub">
                  {c.signed_at ? `서명 완료 · ${c.signed_at.slice(0, 10)}` : "서명이 필요합니다"}
                </div>
              </div>
              {c.signed_at == null && <span className="dot-new" />}
              <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>›</span>
            </Link>
          ))}
        {(admissions ?? [])
          .filter((a) => a.visit_id === v.id)
          .map((a) => (
            <Link
              key={a.id}
              href={`/portal/patients/${id}/admissions/${a.id}`}
              className={`portal-tile portal-subtile${(unreadByAdmission.get(a.id) ?? 0) > 0 ? " tile-new" : ""}`}
            >
              <span aria-hidden style={{ fontSize: 15 }}>🏥</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: ".88rem" }}>
                  입원 {a.admitted_at}
                  {a.discharged_at ? ` ~ ${a.discharged_at}` : ""}
                </div>
                <div className="portal-tile-sub">
                  {a.status === "admitted" ? "입원 중이에요" : "하루하루 경과 보기"}
                  {(unreadByAdmission.get(a.id) ?? 0) > 0 && ` · 새 경과 ${unreadByAdmission.get(a.id)}`}
                </div>
              </div>
              {(unreadByAdmission.get(a.id) ?? 0) > 0 && <span className="dot-new" aria-label="새 경과" />}
              <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>›</span>
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}
