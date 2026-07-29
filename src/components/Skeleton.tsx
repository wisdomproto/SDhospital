/**
 * 화면 전환 중 자리를 잡아주는 회색 블록.
 * 스피너 하나를 가운데 띄우는 것보다 **다음 화면의 모양**을 미리 보여주는 편이
 * 실제 대기 시간이 같아도 짧게 느껴진다.
 */
export function Bar({ w = "100%", h = 14 }: { w?: number | string; h?: number }) {
  return <div className="skel" style={{ width: w, height: h }} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skel-card">
      <Bar w={140} h={16} />
      {Array.from({ length: rows }, (_, i) => (
        <Bar key={i} w={i === rows - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}
