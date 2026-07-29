import { Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="skel-portal-card">
        <Bar w={120} h={18} />
        <Bar w="70%" />
      </div>
      <div className="skel-portal-card">
        <Bar w={90} h={14} />
        <Bar />
        <Bar w="80%" />
      </div>
      <div className="skel-portal-card">
        <Bar w={90} h={14} />
        <Bar w="60%" />
      </div>
    </div>
  );
}
