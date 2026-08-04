"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dayLabel, shiftDate } from "@/lib/life-log";

/**
 * 다이어리 날짜 이동.
 *
 * ⚠️ **앞날로는 못 간다.** 아직 안 지난 하루를 적을 수는 없다 —
 * 다음 날 버튼은 오늘에 서 있으면 비활성이고, 날짜 고르기도 `max` 로 막는다.
 * (주소를 직접 고쳐도 서버에서 `clampDay` 가 한 번 더 막는다.)
 */
export function DayNav({
  base,
  day,
  today,
}: {
  base: string;
  day: string;
  today: string;
}) {
  const router = useRouter();
  const prev = shiftDate(day, -1);
  const next = shiftDate(day, 1);
  const canNext = day < today;
  const href = (d: string) => (d === today ? base : `${base}?d=${d}`);

  return (
    <div className="daynav">
      <Link href={href(prev)} className="daynav-btn" aria-label="앞날 하루 전">‹</Link>

      <label className="daynav-now">
        <span className="daynav-label">{dayLabel(day, today)}</span>
        <span className="daynav-date">{day}</span>
        {/* 달력은 브라우저 것을 그대로 쓴다 — 직접 만들면 그만큼 버그가 는다 */}
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (v && v <= today) router.push(href(v));
          }}
          aria-label="날짜 고르기"
        />
      </label>

      {canNext ? (
        <Link href={href(next)} className="daynav-btn" aria-label="하루 뒤">›</Link>
      ) : (
        <span className="daynav-btn off" aria-hidden>›</span>
      )}

      {day !== today && (
        <Link href={base} className="daynav-today">오늘로</Link>
      )}
    </div>
  );
}
