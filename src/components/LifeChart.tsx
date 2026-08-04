"use client";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FIELDS, type Bucket, type FieldKey } from "@/lib/life-log";

/**
 * 생활기록 추이.
 *
 * 범주형(식사·배변·활력·약)은 **tone 분포**로 본다 — 한 달 치를 볼 때 알고 싶은 건
 * "어느 날 뭘 골랐나"가 아니라 **"안 좋은 날이 늘고 있나"** 다.
 * 날짜별 원본은 아래 표에 그대로 있으므로 여기서 다시 보여줄 이유가 없다.
 *
 * 체중만 숫자라 따로 선으로 그린다.
 */
const TONES = [
  { key: "good", name: "좋음", color: "#16a34a" },
  { key: "watch", name: "주의", color: "#f59e0b" },
  { key: "alert", name: "경고", color: "#dc2626" },
] as const;

export function LifeChart({ buckets }: { buckets: Bucket[] }) {
  const [field, setField] = useState<FieldKey>("appetite");
  if (buckets.length === 0) return null;

  const rows = buckets.map((b) => ({
    label: b.label,
    좋음: b.tones[field].good,
    주의: b.tones[field].watch,
    경고: b.tones[field].alert,
  }));
  const weights = buckets.filter((b) => b.weight != null).map((b) => ({ label: b.label, 체중: b.weight }));
  const empty = rows.every((r) => r.좋음 + r.주의 + r.경고 === 0);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="chip-group" role="tablist">
        {FIELDS.map((f) => (
          <label key={f.key}>
            <input
              type="radio"
              name="life-metric"
              checked={field === f.key}
              onChange={() => setField(f.key)}
            />
            <span>{f.label}</span>
          </label>
        ))}
      </div>

      {empty ? (
        <p className="muted" style={{ fontSize: ".88rem" }}>
          이 기간에 <b>{FIELDS.find((f) => f.key === field)?.label}</b> 을 고른 날이 없습니다.
        </p>
      ) : (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {TONES.map((t) => (
                <Bar key={t.key} dataKey={t.name} stackId="a" fill={t.color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {weights.length > 1 && (
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer>
            <LineChart data={weights} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} unit="kg" width={52} />
              <Tooltip />
              <Line type="monotone" dataKey="체중" stroke="#64748b" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {weights.length > 0 && (
        <p className="muted" style={{ fontSize: ".8rem", margin: 0 }}>
          ⚠️ 보호자가 <b>집에서 잰 값</b>입니다. 병원 저울과 다를 수 있어 회차 체중과 섞지 않습니다.
        </p>
      )}
    </div>
  );
}
