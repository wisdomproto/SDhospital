import { createClient } from "@/lib/supabase/server";
import { sendWardReport } from "./actions";
import { PhotoPicker } from "./PhotoPicker";
import { kstToday, admittedDay } from "@/lib/worklist";
import Link from "next/link";
import { notFound } from "next/navigation";

const petEmoji = (s: string | null) => (s === "고양이" ? "🐱" : "🐶");
type Pet = { id: string; name: string; species: string | null } | null;

export default async function WardEntry({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { kind, id } = await params;
  const { error } = await searchParams;
  if (kind !== "v" && kind !== "a") notFound();
  const supabase = await createClient();
  const today = kstToday();

  let pet: Pet = null;
  let heading = "";
  let subtitle = "";
  let patientId = "";
  let lastVital: { temperature: number | null; heart_rate: number | null; resp_rate: number | null } | null = null;
  let draft = "";

  if (kind === "v") {
    const { data: v } = await supabase
      .from("visit")
      .select("id, visit_date, report_comment, patient:patient_id(id, name, species)")
      .eq("id", id)
      .single();
    if (!v) notFound();
    pet = v.patient as unknown as Pet;
    patientId = pet?.id ?? "";
    heading = "진료 리포트";
    subtitle = v.visit_date;
    draft = v.report_comment ?? "";
  } else {
    const { data: a } = await supabase
      .from("admission")
      .select("id, admitted_at, patient:patient_id(id, name, species)")
      .eq("id", id)
      .single();
    if (!a) notFound();
    pet = a.patient as unknown as Pet;
    patientId = pet?.id ?? "";
    heading = "입원 경과";
    subtitle = `입원 ${admittedDay(a.admitted_at, today)}일차 · ${today}`;

    // 직전 바이털을 미리 채운다 — 대부분 안 바뀌므로 바뀐 것만 고치게.
    // 항목별로 따로 찾는다: 마지막 기록에 체온만 있고 심박이 비어 있는 경우가 흔하다.
    const [{ data: recent }, { data: todayReport }] = await Promise.all([
      supabase
        .from("vital")
        .select("temperature, heart_rate, resp_rate")
        .eq("admission_id", id)
        .order("measured_at", { ascending: false })
        .limit(50),
      supabase
        .from("admission_report")
        .select("comment")
        .eq("admission_id", id)
        .eq("report_date", today)
        .maybeSingle(),
    ]);
    const firstNonNull = <K extends "temperature" | "heart_rate" | "resp_rate">(k: K) =>
      (recent ?? []).find((r) => r[k] != null)?.[k] ?? null;
    lastVital = {
      temperature: firstNonNull("temperature"),
      heart_rate: firstNonNull("heart_rate"),
      resp_rate: firstNonNull("resp_rate"),
    };
    draft = todayReport?.comment ?? "";
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 560 }}>
      <div>
        <Link href="/today" className="link-btn" style={{ fontSize: ".85rem" }}>← 오늘 할 일</Link>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: "1.6rem" }}>{petEmoji(pet?.species ?? null)}</span>
          {pet?.name}
        </h1>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: ".88rem" }}>
          {heading} · {subtitle}
        </p>
      </div>

      {error && (
        <div className="pill warning" style={{ padding: "10px 14px" }}>{error}</div>
      )}

      <form action={sendWardReport.bind(null, kind, id, patientId)} className="ward-form">
        <PhotoPicker />

        {kind === "a" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: ".88rem" }}>바이털</span>
              {lastVital && (lastVital.temperature ?? lastVital.heart_rate ?? lastVital.resp_rate) != null && (
                <span className="ward-prefill">직전 값이 채워져 있습니다</span>
              )}
            </div>
            <div className="ward-vitals">
              <label>
                체온 ℃
                <input name="temperature" inputMode="decimal" defaultValue={lastVital?.temperature ?? ""} />
              </label>
              <label>
                심박 /분
                <input name="heart_rate" inputMode="numeric" defaultValue={lastVital?.heart_rate ?? ""} />
              </label>
              <label>
                호흡 /분
                <input name="resp_rate" inputMode="numeric" defaultValue={lastVital?.resp_rate ?? ""} />
              </label>
            </div>
          </div>
        )}

        <div>
          <div style={{ fontWeight: 700, fontSize: ".88rem", marginBottom: 8 }}>보호자에게 한 줄</div>
          <textarea
            name="comment"
            rows={3}
            defaultValue={draft}
            className="ward-comment"
            placeholder={
              kind === "a"
                ? "예) 식욕 돌아왔습니다. 내일 드레싱 후 경과 봅니다."
                : "예) 오늘 촬영 결과 설명드린 대로입니다. 다음 주 재검 예정입니다."
            }
          />
        </div>

        <button className="ward-send">보내기</button>
        <p className="ward-prefill" style={{ textAlign: "center", margin: 0 }}>
          누르는 즉시 보호자에게 발송됩니다
        </p>
      </form>
    </div>
  );
}
