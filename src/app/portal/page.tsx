import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PortalHome() {
  const supabase = await createClient();
  const { data: patients } = await supabase
    .from("patient")
    .select("id, name, species, breed")
    .order("name");

  if (!patients || patients.length === 0) {
    return <div className="empty-state">열람 가능한 환자가 없습니다.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 className="section-title">내 반려동물</h2>
      {patients.map((p) => (
        <Link
          key={p.id}
          href={`/portal/patients/${p.id}`}
          className="record-card"
          style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit" }}
        >
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "var(--surface-soft)",
              fontSize: 22,
            }}
          >
            {p.species === "고양이" ? "🐱" : "🐶"}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800 }}>{p.name}</div>
            <div className="muted" style={{ fontSize: ".85rem" }}>
              {[p.species, p.breed].filter(Boolean).join(" / ") || "-"}
            </div>
          </div>
          <span className="muted" style={{ fontSize: "1.2rem" }}>
            ›
          </span>
        </Link>
      ))}
    </div>
  );
}
