"use client";
import { useState } from "react";
import { saveVitalSlot, deleteVital } from "./actions";

export type FlowRow = {
  vitalId: string | null;
  time: string; // HH:MM
  iso: string; // full ISO for new inserts
  temperature: number | null;
  heart_rate: number | null;
  resp_rate: number | null;
  systolic: number | null;
  glucose: number | null;
  weight: number | null;
  urination: string | null;
  feeding: string | null;
  tests: string | null;
};
export type FlowDay = { key: string; label: string; rows: FlowRow[]; treats: string[] };

const COLS = "62px 60px 60px 60px 62px 60px 62px 84px 84px 130px 62px 44px";
const numFields = [
  ["temperature", "체온"],
  ["heart_rate", "심박"],
  ["resp_rate", "호흡"],
  ["systolic", "수축기"],
  ["glucose", "혈당"],
  ["weight", "체중"],
] as const;

export function AdmissionFlowsheet({
  patientId,
  admissionId,
  days,
}: {
  patientId: string;
  admissionId: string;
  days: FlowDay[];
}) {
  const [active, setActive] = useState(Math.max(0, days.length - 1));
  const cur = days[active];
  if (!cur) return null;
  const inp: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "6px 7px",
    font: "inherit",
    fontSize: ".82rem",
    background: "var(--bg)",
    minWidth: 0,
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* day tabs */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {days.map((d, i) => {
          const filled = d.rows.some((r) => r.vitalId);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setActive(i)}
              style={{
                flexShrink: 0,
                border: "1px solid var(--line)",
                background: i === active ? "var(--primary)" : "var(--surface)",
                color: i === active ? "#fff" : filled ? "var(--ink-2)" : "var(--muted-2)",
                borderColor: i === active ? "var(--primary)" : "var(--line)",
                borderRadius: 999,
                padding: "7px 13px",
                fontWeight: 600,
                fontSize: ".82rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {d.label}
              {filled && <span style={{ marginLeft: 5, opacity: 0.7 }}>●</span>}
            </button>
          );
        })}
      </div>

      {/* active day */}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 700 }}>{cur.label}</h3>
          <span className="pnav-meta">기록 {cur.rows.filter((r) => r.vitalId).length}건</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 840, display: "grid", gap: 4 }}>
            {/* header */}
            <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, padding: "0 2px 2px", fontSize: ".72rem", fontWeight: 600, color: "var(--muted)" }}>
              <span>시각</span><span>체온</span><span>심박</span><span>호흡</span><span>수축기</span>
              <span>혈당</span><span>체중</span><span>배뇨</span><span>식이</span><span>검사</span><span></span><span></span>
            </div>
            {cur.rows.map((r) => (
              <form
                key={(r.vitalId ?? "new") + r.time}
                action={saveVitalSlot.bind(null, patientId, admissionId, r.iso, r.vitalId ?? "")}
                style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, alignItems: "center" }}
              >
                <span style={{ fontSize: ".8rem", fontWeight: 600, color: r.vitalId ? "var(--ink-2)" : "var(--muted-2)" }}>{r.time}</span>
                {numFields.map(([f]) => (
                  <input key={f} name={f} defaultValue={(r[f] as number | null) ?? ""} inputMode="decimal" style={inp} />
                ))}
                <input name="urination" defaultValue={r.urination ?? ""} style={inp} />
                <input name="feeding" defaultValue={r.feeding ?? ""} style={inp} />
                <input name="tests" defaultValue={r.tests ?? ""} style={inp} />
                <button className="btn btn-secondary btn-sm" style={{ padding: "6px 8px" }}>저장</button>
                {r.vitalId ? (
                  <button
                    formAction={deleteVital.bind(null, patientId, admissionId, r.vitalId)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: "6px 6px", color: "var(--danger)" }}
                    title="삭제"
                  >
                    ✕
                  </button>
                ) : (
                  <span />
                )}
              </form>
            ))}
          </div>
        </div>

        {cur.treats.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", paddingTop: 4 }}>
            <span style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--muted)" }}>투약</span>
            {cur.treats.map((n, i) => (
              <span key={i} className="pill" style={{ fontWeight: 500 }}>{n}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
