import { Bar, CardSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Bar w={80} h={11} />
        <Bar w={200} h={24} />
      </div>
      <CardSkeleton rows={4} />
      <CardSkeleton rows={3} />
    </div>
  );
}
