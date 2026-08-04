import { createClient } from "@/lib/supabase/server";
import { ownerReportFeed } from "@/lib/reports";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { NEWS_SEEN_COOKIE } from "@/lib/seen";
import { MarkNewsSeen } from "../../MarkNewsSeen";
import { kstToday } from "@/lib/worklist";
import { FIELDS, choiceOf } from "@/lib/life-log";

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
    .select("id, title, body, link_url, link_label, coupon_label, image_url, starts_on, ends_on, pinned")
    .order("pinned", { ascending: false })
    .order("starts_on", { ascending: false })
    .limit(5);

  const seen = (await cookies()).get(NEWS_SEEN_COOKIE)?.value ?? "";
  const isNew = (startsOn: string) => !seen || startsOn > seen.slice(0, 10);

  const feed = await ownerReportFeed(supabase, id, `/portal/patients/${id}`, 3);
  const unread = feed.filter((f) => f.unread).length;

  // 생활기록은 **홈에서 시작한다.** 탭을 여섯 개로 늘리지 않고,
  // "내 정보"(가끔 보는 화면)에 넣지도 않는다 — 매일 쓰는 것은 매일 여는 화면에 있어야 한다.
  const today = kstToday();
  const { data: todayLog } = await supabase
    .from("life_log")
    .select("appetite, stool, energy, meds")
    .eq("patient_id", id)
    .eq("logged_on", today)
    .maybeSingle();
  const doneCount = todayLog
    ? FIELDS.filter((f) => todayLog[f.key as keyof typeof todayLog]).length
    : 0;

  return (
    <>
      <MarkNewsSeen hasNew={(notices ?? []).some((n) => isNew(n.starts_on))} />

      <Link href={`/portal/patients/${id}/life`} className="portal-card life-today" aria-label="다이어리 쓰기">
        <div className="life-today-head">
          <b>오늘 {p.name}는 어땠나요</b>
          {/* ⚠️ 화살표는 항상 둔다. 적고 나면 사라지게 했더니 눌리는 줄을 아무도 몰랐다 */}
          <span>{doneCount > 0 ? "고치기 ›" : "기록하기 ›"}</span>
        </div>
        {doneCount > 0 ? (
          <div className="life-today-chips">
            {FIELDS.map((f) => {
              const c = choiceOf(f.key, todayLog?.[f.key as keyof typeof todayLog] ?? null);
              return c ? (
                <span key={f.key} className={`pill ${c.tone === "good" ? "success" : c.tone === "alert" ? "danger" : "warning"}`}>
                  {f.label} {c.label}
                </span>
              ) : null;
            })}
          </div>
        ) : (
          <p className="life-today-sub">밥·배변·기운만 골라 두시면 진료 때 담당의가 함께 봅니다.</p>
        )}
      </Link>
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

      {/* 치료 사례는 탭에서 내려와 여기 들어왔다 — 소식과 같이 "읽는 것"이라 한 탭에 둔다 */}
      <Link href={`/portal/patients/${id}/cases`} className="portal-card life-today" aria-label="치료 사례">
        <div className="life-today-head">
          <b>치료 사례</b>
          <span>찾아보기 ›</span>
        </div>
        <p className="life-today-sub">같은 문제로 치료받은 아이들의 이야기를 증상·병명으로 찾아볼 수 있어요.</p>
      </Link>

      {(notices ?? []).length > 0 && (
        <div className="notice-list">
          {(notices ?? []).map((n) => (
            <div key={n.id} className={`portal-card notice-card${n.coupon_label ? " coupon" : ""}`}>
              {n.image_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="notice-image" src={n.image_url} alt="" loading="lazy" />
              )}
              {n.coupon_label && (
                <div className="coupon-strip">
                  <div className="coupon-label">{n.coupon_label}</div>
                  <div className="coupon-note">
                    병원에서 이 화면을 보여주세요
                    {n.ends_on && ` · ${n.ends_on}까지`}
                  </div>
                </div>
              )}
              <div style={{ fontWeight: 800, fontSize: ".97rem", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {isNew(n.starts_on) && <span className="pill-new">NEW</span>}
                {n.pinned && <span aria-hidden>📌</span>}
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
