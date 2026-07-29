import { Bar, CardSkeleton } from "@/components/Skeleton";

// 환자 안에서 회차를 옮겨 다닐 때는 왼쪽 환자 내비게이션이 그대로 남아야 한다.
// 그래서 (app) 스켈레톤과 별도로 여기에도 경계를 둔다.
export default function Loading() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Bar w={70} h={11} />
        <Bar w={260} h={24} />
      </div>
      <CardSkeleton rows={4} />
      <CardSkeleton rows={2} />
    </div>
  );
}
