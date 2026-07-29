import { createClient } from "@/lib/supabase/server";
import { ownerReportFeed } from "@/lib/reports";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PortalPatientOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patient")
    .select("id, name, species, breed, sex")
    .eq("id", id)
    .single();
  if (!p) notFound();

  // 회차 수·기본 정보는 "진료 기록" 탭이 맡는다. 여기는 병원 소식 화면이다.
  const { data: openAdm } = await supabase
    .from("admission")
    .select("id")
    .eq("patient_id", id)
    .eq("status", "admitted")
    .limit(1)
    .maybeSingle();

  const { data: pendingConsents } = await supabase
    .from("consent")
    .select("id, form_title")
    .eq("patient_id", id)
    .is("signed_at", null)
    .order("created_at", { ascending: true });

  // 병원 소식. 기간이 지난 것은 RLS 가 감추므로 여기서 날짜를 다시 따지지 않는다.
  const { data: notices } = await supabase
    .from("notice")
    .select("id, title, body, link_url, link_label, coupon_label, ends_on, pinned")
    .order("pinned", { ascending: false })
    .order("starts_on", { ascending: false })
    .limit(5);

  const feed = await ownerReportFeed(supabase, id, `/portal/patients/${id}`, 3);
  const unread = feed.filter((f) => f.unread).length;

  return (
    <>
      {(pendingConsents ?? []).length > 0 && (
        <div className="portal-card" style={{ borderLeft: "4px solid #b4541f" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>서명이 필요합니다</div>
          <div style={{ display: "grid", gap: 8 }}>
            {(pendingConsents ?? []).map((c) => (
              <Link
                key={c.id}
                href={`/portal/patients/${id}/consents/${c.id}`}
                style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 700, fontSize: ".92rem" }}
              >
                <span>{c.form_title}</span>
                <span>서명하기 →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(notices ?? []).length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {(notices ?? []).map((n) => (
            <div key={n.id} className={`portal-card notice-card${n.coupon_label ? " coupon" : ""}`}>
              {n.coupon_label && (
                <div className="coupon-strip">
                  <div className="coupon-label">{n.coupon_label}</div>
                  <div className="coupon-note">
                    병원에서 이 화면을 보여주세요
                    {n.ends_on && ` · ${n.ends_on}까지`}
                  </div>
                </div>
              )}
              <div style={{ fontWeight: 800, fontSize: ".97rem" }}>
                {n.pinned && <span aria-hidden>📌 </span>}
                {n.title}
              </div>
              {n.body && (
                <p style={{ margin: "6px 0 0", fontSize: ".9rem", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {n.body}
                </p>
              )}
              {n.link_url && (
                <a
                  href={n.link_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-block", marginTop: 10, fontWeight: 700, fontSize: ".88rem" }}
                >
                  {n.link_label || "자세히 보기"} →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {feed.length > 0 && (
        <div className="portal-card" style={{ borderLeft: "4px solid var(--brand, #2f7d6a)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 800 }}>병원에서 온 소식</span>
            {unread > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: ".7rem",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                새 소식 {unread}
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {feed.map((f, i) => (
              <Link
                key={f.key}
                href={f.href}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  paddingBottom: 10,
                  borderBottom: i < feed.length - 1 ? "1px solid var(--line)" : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".78rem", color: "var(--muted)" }}>
                  {f.unread && (
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: 700 }}>{f.title}</span>
                  <span>· {f.date}</span>
                </div>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: ".92rem",
                    lineHeight: 1.6,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {f.comment}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

    </>
  );
}
