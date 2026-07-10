"use client";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export type VitalPoint = {
  measured_at: string;
  temperature: number | null;
  heart_rate: number | null;
  resp_rate: number | null;
  systolic: number | null;
  diastolic: number | null;
  glucose?: number | null;
  weight?: number | null;
};

const METRICS = [
  { key: "temperature", name: "체온", color: "#e11d48", axis: "right" },
  { key: "heart_rate", name: "심박", color: "#2563eb", axis: "left" },
  { key: "resp_rate", name: "호흡", color: "#16a34a", axis: "left" },
  { key: "systolic", name: "수축기", color: "#a855f7", axis: "left" },
  { key: "diastolic", name: "이완기", color: "#f59e0b", axis: "left" },
  { key: "glucose", name: "혈당", color: "#0891b2", axis: "left" },
  { key: "weight", name: "체중", color: "#64748b", axis: "right" },
] as const;

export function VitalChart({ data }: { data: VitalPoint[] }) {
  const [sel, setSel] = useState<string | null>(null); // null = 전체
  if (data.length === 0) return null;
  const rows = data.map((d) => ({
    t: new Date(d.measured_at).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    temperature: d.temperature,
    heart_rate: d.heart_rate,
    resp_rate: d.resp_rate,
    systolic: d.systolic,
    diastolic: d.diastolic,
    glucose: d.glucose ?? null,
    weight: d.weight ?? null,
  }));
  const shown = METRICS.filter((m) => sel === null || m.key === sel);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setSel(null)} className="metric-btn" aria-pressed={sel === null}
          style={btnStyle(sel === null, "var(--primary)")}>
          전체
        </button>
        {METRICS.map((m) => (
          <button key={m.key} type="button" onClick={() => setSel(m.key)} className="metric-btn" aria-pressed={sel === m.key}
            style={btnStyle(sel === m.key, m.color)}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color, display: "inline-block" }} />
            {m.name}
          </button>
        ))}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" domain={[35, 42]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {shown.map((m) => (
              <Line
                key={m.key}
                yAxisId={m.axis}
                type="monotone"
                dataKey={m.key}
                name={m.name}
                stroke={m.color}
                strokeDasharray={m.key === "weight" ? "4 2" : undefined}
                connectNulls
                dot={{ r: 3, stroke: m.color, strokeWidth: 1, fill: "#fff" }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function btnStyle(active: boolean, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: `1px solid ${active ? color : "var(--line)"}`,
    background: active ? color : "var(--surface)",
    color: active ? "#fff" : "var(--ink-2)",
    borderRadius: 999,
    padding: "6px 12px",
    fontWeight: 600,
    fontSize: ".8rem",
    cursor: "pointer",
    transition: "background .12s, color .12s, border-color .12s",
  };
}
