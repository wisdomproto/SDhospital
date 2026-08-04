import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { kstToday } from "@/lib/worklist";
import { signedUrl } from "@/lib/storage";
import { clampDay, dayLabel, isActive, summarize, worstTone, shiftDate,
  type Intake, type LifeLog } from "@/lib/life-log";
import { DayEntry } from "./DayEntry";
import { DayNav } from "./DayNav";
import { IntakeList } from "./IntakeList";

/**
 * 생활기록 — 보호자가 평소를 남기는 곳.
 *
 * 이 화면이 채팅의 나머지 절반이다. 문의 1위인 식욕 부진에 답할 수 없었던 이유는
 * 원인이 제각각이어서가 아니라 **평소를 모르기 때문**이다.
 *
 * ⚠️ **"지켜보고 있다"고 말하지 않는다.** 올렸는데 아무도 안 보면 "무시당했다"가 된다.
 * 사람이 상시로 보지는 않고, 채팅은 **물어봤을 때만** 읽는다 — 그 구분을 화면에 그대로 쓴다.
 */
export default async function LifePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { id } = await params;
  const { d } = await searchParams;
  const supabase = await createClient();
  const today = kstToday();
  // ⚠️ 앞날은 열지 않는다. 주소를 직접 고쳐 와도 여기서 오늘로 되돌린다.
  const day = clampDay(d, today);
  const since = shiftDate(day, -13);

  const { data: patient } = await supabase
    .from("patient")
    .select("id, name, species")
    .eq("id", id)
    .single();
  if (!patient) notFound();

  const [{ data: logs }, { data: intakes }, { data: rx }] = await Promise.all([
    supabase
      .from("life_log")
      .select("id, logged_on, appetite, stool, energy, weight_kg, meds, note")
      .eq("patient_id", id)
      .gte("logged_on", since)
      .lte("logged_on", day)
      .order("logged_on", { ascending: false }),
    supabase
      .from("life_intake")
      .select("id, label, photo_path, started_on, stopped_on")
      .eq("patient_id", id)
      .order("started_on", { ascending: false }),
    // 우리 처방이 살아 있을 때만 "약" 줄을 띄운다.
    // 없는 약을 매일 물으면 그 줄부터 안 채우기 시작한다.
    supabase
      .from("prescription")
      .select("id, visit:visit_id!inner(patient_id, visit_date)")
      .eq("visit.patient_id", id)
      .gte("visit.visit_date", shiftDate(today, -30))
      .limit(1),
  ]);

  const rows = (logs ?? []) as (LifeLog & { id: string })[];
  const todayRow = rows.find((l) => l.logged_on === day);

  const { data: photoRows } = todayRow
    ? await supabase.from("life_photo").select("id, storage_path").eq("log_id", todayRow.id)
    : { data: [] as { id: string; storage_path: string }[] };
  const photos = await Promise.all(
    (photoRows ?? []).map(async (p) => ({ id: p.id, url: await signedUrl(p.storage_path) }))
  );

  const list = (intakes ?? []) as Intake[];
  const withUrl = await Promise.all(
    list.map(async (i) => ({ ...i, url: i.photo_path ? await signedUrl(i.photo_path) : null }))
  );
  // 그 날 기준으로 무엇을 주고 있었나 — 지난 날을 열면 그때의 목록이 맞다
  const active = withUrl.filter((i) => isActive(i, day));
  const stopped = withUrl.filter((i) => !isActive(i, day));

  return (
    <div className="portal-body" style={{ display: "grid", gap: 14 }}>
      <div className="portal-card">
        <DayNav base={`/portal/patients/${id}/life`} day={day} today={today} />
        <div className="life-sec-head" style={{ marginTop: 14 }}>
          <b>
            {day === today ? `오늘 ${patient.name}는 어땠나요` : `${dayLabel(day, today)} ${patient.name}는 어땠나요`}
          </b>
        </div>
        <DayEntry
          /* 날짜를 옮기면 화면 상태를 새로 만든다 — 안 그러면 어제 화면에 오늘 고른 게 남는다 */
          key={day}
          patientId={id}
          loggedOn={day}
          species={patient.species}
          hasPrescription={(rx ?? []).length > 0}
          photos={photos}
          initial={{
            appetite: todayRow?.appetite ?? null,
            stool: todayRow?.stool ?? null,
            energy: todayRow?.energy ?? null,
            meds: todayRow?.meds ?? null,
            weight_kg: todayRow?.weight_kg ?? null,
            note: todayRow?.note ?? null,
          }}
        />
      </div>

      <IntakeList patientId={id} today={today} active={active} stopped={stopped} />

      <div className="portal-card">
        <div className="life-sec-head">
          <b>{day === today ? "지난 2주" : `${day}까지 2주`}</b>
        </div>
        {rows.length === 0 ? (
          <p className="life-empty">아직 기록이 없어요.</p>
        ) : (
          <ul className="life-history">
            {rows.map((l) => {
              const tone = worstTone(l);
              const text = summarize(l);
              return (
                <li key={l.logged_on} className={tone ? `tone-${tone}` : undefined}>
                  <span className="life-hist-date">
                    {Number(l.logged_on.slice(5, 7))}/{Number(l.logged_on.slice(8, 10))}
                  </span>
                  <span className="life-hist-text">
                    {text || "메모만"}
                    {l.note && <em>{l.note}</em>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="life-foot">
        여기 적어 두시면 <b>진료 때 담당의가 함께 봅니다.</b>
        <br />
        <b>상시로 지켜보지는 않습니다</b> — 급한 일은 채팅으로 물어보시거나 병원으로 전화해 주세요.
      </p>
    </div>
  );
}
