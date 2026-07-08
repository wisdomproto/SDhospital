"use client";
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
};

export function VitalChart({ data }: { data: VitalPoint[] }) {
  if (data.length === 0) return null;
  const rows = data.map((d) => ({
    t: new Date(d.measured_at).toLocaleString("ko-KR", {
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
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" domain={[35, 42]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line yAxisId="right" type="monotone" dataKey="temperature" name="체온" stroke="#e11d48" connectNulls dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="heart_rate" name="심박" stroke="#2563eb" connectNulls dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="resp_rate" name="호흡" stroke="#16a34a" connectNulls dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="systolic" name="수축기" stroke="#a855f7" connectNulls dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="diastolic" name="이완기" stroke="#f59e0b" connectNulls dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
