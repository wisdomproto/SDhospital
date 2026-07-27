import { createClient } from "@/lib/supabase/server";
import { kstToday, daysBetween, admittedDay, sortWorkItems, type WorkItem } from "@/lib/worklist";
import Link from "next/link";

const petEmoji = (species: string | null) => (species === "고양이" ? "🐱" : "🐶");
type Pet = { id: string; name: string; species: string | null } | null;

export default async function TodayWorklist() {
  const supabase = await createClient();
  const today = kstToday();

  const [{ data: visitRows }, { data: admRows }, { data: todayReports }] = await Promise.all([
    // 진료가 끝났는데 아직 리포트가 안 나간 회차 (오늘 것 + 밀린 것)
    supabase
      .from("visit")
      .select("id, visit_date, patient:patient_id(id, name, species)")
      .not("closed_at", "is", null)
      .is("report_sent_at", null)
      .order("visit_date", { ascending: true }),
    supabase
      .from("admission")
      .select("id, admitted_at, patient:patient_id(id, name, species)")
      .eq("status", "admitted"),
    supabase.from("admission_report").select("admission_id, sent_at").eq("report_date", today),
  ]);

  const sentToday = new Set(
    (todayReports ?? []).filter((r) => r.sent_at).map((r) => r.admission_id)
  );

  const items: WorkItem[] = [
    ...(visitRows ?? []).map((v) => {
      const p = v.patient as unknown as Pet;
      return {
        kind: "visit" as const,
        href: `/patients/${p?.id}/v/${v.id}`,
        patientName: p?.name ?? "-",
        species: p?.species ?? null,
        date: v.visit_date,
        overdueDays: Math.max(0, daysBetween(v.visit_date, today)),
        subtitle: "진료 리포트",
      };
    }),
    ...(admRows ?? [])
      .filter((a) => !sentToday.has(a.id))
      .map((a) => {
        const p = a.patient as unknown as Pet;
        return {
          kind: "admission" as const,
          href: `/patients/${p?.id}/a/${a.id}`,
          patientName: p?.name ?? "-",
          species: p?.species ?? null,
          date: today,
          overdueDays: 0, // 입원 리포트는 그날 것만 할 일이다 (지난 날짜는 되돌아가 채우지 않는다)
          subtitle: `입원 ${admittedDay(a.admitted_at, today)}일차`,
        };
      }),
  ];

  const list = sortWorkItems(items);
  const overdue = list.filter((i) => i.overdueDays > 0);
  const todayItems = list.filter((i) => i.overdueDays === 0);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">오늘 할 일</p>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          보호자 리포트
          {list.length > 0 ? (
            <span className="pill warning">{list.length}건 남음</span>
          ) : (
            <span className="pill success">전부 완료</span>
          )}
        </h1>
      </div>

      {list.length === 0 && (
        <div className="card">
          <div className="empty-state">보낼 리포트가 없습니다. 오늘 것까지 전부 나갔습니다. 👏</div>
        </div>
      )}

      {overdue.length > 0 && <WorkSection title="밀린 것" tone="warning" items={overdue} />}
      {todayItems.length > 0 && <WorkSection title="오늘" tone="muted" items={todayItems} />}
    </div>
  );
}

function WorkSection({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "warning" | "muted";
  items: WorkItem[];
}) {
  return (
    <div className="card">
      <div className="card-head">
        <h2 className="section-title">{title}</h2>
        <span className={`pill ${tone}`}>{items.length}건</span>
      </div>
      <div style={{ display: "grid" }}>
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="today-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 4px",
              borderBottom: "1px solid var(--line)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{petEmoji(i.species)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700 }}>{i.patientName}</span>
              <span style={{ display: "block", fontSize: ".82rem", color: "var(--muted)" }}>
                {i.subtitle} · {i.date}
              </span>
            </span>
            {i.overdueDays > 0 && (
              <span className="pill warning">{i.overdueDays}일 밀림</span>
            )}
            <span style={{ color: "var(--muted-2)" }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
