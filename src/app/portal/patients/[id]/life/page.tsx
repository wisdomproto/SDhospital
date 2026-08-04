import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { kstToday } from "@/lib/worklist";
import { signedUrl } from "@/lib/storage";
import { clampDay, dayLabel, isActive, shiftDate, type Intake, type LifeLog } from "@/lib/life-log";
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
  const since = shiftDate(day, -13); // 그 날 행 하나만 있으면 되지만 범위로 받아 캐시를 태운다

  const { data: patient } = await supabase
    .from("patient")
    .select("id, name, species")
    .eq("id", id)
    .single();
  if (!patient) notFound();

  const [{ data: logs }, { data: intakes }, { data: rx }] = await Promise.all([
    supabase
      .from("life_log")
      .select("id, logged_on, appetite, stool, energy, weight_kg, meds, note, intakes")
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
  // 목록 관리(아래 카드)는 "지금" 기준이다 — 뺀 것만 접어 둔다
  const active = withUrl.filter((i) => isActive(i, today));
  const stopped = withUrl.filter((i) => !isActive(i, today));
  // 고를 수 있는 것은 **지금 목록 + 그 날 이미 골라 둔 것**.
  // 목록 기준을 그 날로 잡았더니 지난 날을 채워 넣을 때 선택지가 하나도 없었다.
  // 뺀 항목도 그 날 골라 뒀다면 보여야 한다 — 안 그러면 고른 게 화면에서 사라진다.
  const picked = new Set(todayRow?.intakes ?? []);
  const options = withUrl.filter((i) => isActive(i, today) || picked.has(i.id));

  return (
    // ⚠️ `portal-body` 로 감싸지 않는다 — 레이아웃이 이미 감싸고 있어서
    // 좌우 16px 여백을 두 번 먹었다(390px 화면에서 32px 손해).
    <>
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
          intakeOptions={options.map((i) => ({ id: i.id, label: i.label, url: i.url }))}
          initial={{
            /* ⚠️ 기본은 전부 비어 있다. 어제 값을 끌어오거나 목록을 미리 체크해 두지 않는다 —
               안 적은 날과 "평소만큼이었던 날"은 다른 것이고, 그걸 우리가 지어내면 안 된다 */
            intakes: todayRow?.intakes ?? [],
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

      <p className="life-foot">
        여기 적어 두시면 <b>진료 때 담당의가 함께 봅니다.</b>
        <br />
        <b>상시로 지켜보지는 않습니다</b> — 급한 일은 채팅으로 물어보시거나 병원으로 전화해 주세요.
      </p>
    </>
  );
}
