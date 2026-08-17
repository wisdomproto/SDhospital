import { createClient } from "@/lib/supabase/server";
import { sendWardReport } from "./actions";
import { PhotoPicker } from "./PhotoPicker";
import { kstToday, admittedDay } from "@/lib/worklist";
import { OwnerPreview } from "@/app/(app)/patients/[id]/v/[visitId]/OwnerPreview";
import { FEEDING, ELIMINATION } from "@/lib/admission-report";
import { chiefComplaintWarning, type ReportVisit } from "@/lib/owner-report";
import Link from "next/link";
import { notFound } from "next/navigation";

type PrevVisit = ReportVisit | null;

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
  let daily: { feeding: string | null; elimination: string | null; special: string } | null = null;
  let awaitingReview = false;  // 간호사가 준비를 끝냈고 아직 안 나간 상태
  let previewCtx: {
    patient: { name: string; species: string | null; breed: string | null; birth_date: string | null };
    visitDate: string;
    chiefComplaint: string;
    weight: string;
    prev: PrevVisit;
  } | null = null;

  if (kind === "v") {
    const { data: v } = await supabase
      .from("visit")
      .select("id, visit_date, report_comment, chief_complaint, weight_kg, patient:patient_id(id, name, species)")
      .eq("id", id)
      .single();
    if (!v) notFound();
    pet = v.patient as unknown as Pet;
    patientId = pet?.id ?? "";
    heading = "진료 리포트";
    subtitle = v.visit_date;
    draft = v.report_comment ?? "";

    const [{ data: full }, { data: prev }] = await Promise.all([
      supabase.from("patient").select("name, species, breed, birth_date").eq("id", patientId).single(),
      supabase
        .from("visit")
        .select("visit_date, chief_complaint, weight_kg, report_comment, report_notice")
        .eq("patient_id", patientId)
        .lt("visit_date", v.visit_date)
        .order("visit_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (full) {
      previewCtx = {
        patient: full,
        visitDate: v.visit_date,
        chiefComplaint: v.chief_complaint ?? "",
        weight: v.weight_kg != null ? String(v.weight_kg) : "",
        prev: prev ?? null,
      };
    }
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
        .select("comment, feeding, elimination, special, ready_at, sent_at")
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
    awaitingReview = Boolean(todayReport?.ready_at && !todayReport?.sent_at);
    daily = {
      feeding: todayReport?.feeding ?? null,
      elimination: todayReport?.elimination ?? null,
      special: todayReport?.special ?? "",
    };
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
      {awaitingReview && (
        <div className="pill warning" style={{ padding: "10px 14px" }}>
          입력이 끝났습니다 — 확인 후 보호자에게 보내주세요
        </div>
      )}

      <form action={sendWardReport.bind(null, kind, id, patientId, "send")} className="ward-form">
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

        {kind === "v" && previewCtx && (
          <div className="ward-vitals" style={{ gridTemplateColumns: "2fr 1fr" }}>
            <label>
              주 증상 (C.C.)
              <input name="chief_complaint" defaultValue={previewCtx.chiefComplaint} placeholder="보행 시 균형 불균형" />
              {/* ⚠️ 여기가 리포트 제목이 된다. 막지 않고 알린다 — 판단은 사람이 한다 */}
              {chiefComplaintWarning(previewCtx.chiefComplaint) && (
                <span className="cc-warn">
                  ⚠️ {chiefComplaintWarning(previewCtx.chiefComplaint)} — 보호자가 읽을 말로 고쳐 주세요
                </span>
              )}
            </label>
            <label>
              체중 kg
              <input name="weight_kg" inputMode="decimal" defaultValue={previewCtx.weight} />
            </label>
          </div>
        )}

        {kind === "a" && daily && (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div className="ward-choice-label">오늘 식사</div>
              <div className="chip-group">
                {FEEDING.map((o) => (
                  <label key={o.key}>
                    <input type="radio" name="feeding" value={o.key} defaultChecked={daily!.feeding === o.key} />
                    <span>{o.staff}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="ward-choice-label">오늘 배변</div>
              <div className="chip-group">
                {ELIMINATION.map((o) => (
                  <label key={o.key}>
                    <input type="radio" name="elimination" value={o.key} defaultChecked={daily!.elimination === o.key} />
                    <span>{o.staff}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="ward-choice-label">특이사항 (있을 때만)</div>
              <input
                name="special"
                defaultValue={daily!.special}
                placeholder="예) 오후에 한 번 토했습니다"
                className="ward-special"
              />
            </div>
          </div>
        )}

        <div>
          <div style={{ fontWeight: 700, fontSize: ".88rem", marginBottom: 8 }}>
            보호자에게 한 줄{kind === "a" ? " (선택)" : ""}
          </div>
          <textarea
            name="comment"
            rows={3}
            defaultValue={draft}
            className="ward-comment"
            placeholder={
              kind === "a"
                ? "위 항목 외에 더 전할 말이 있을 때만 적으세요"
                : "예) 오늘 촬영 결과 설명드린 대로입니다. 다음 주 재검 예정입니다."
            }
          />
        </div>

        {previewCtx ? (
          <div style={{ display: "grid", gap: 8 }}>
            <OwnerPreview
              patient={previewCtx.patient}
              visitDate={previewCtx.visitDate}
              prev={previewCtx.prev}
              alreadySent={false}
              className="ward-send"
              label="보호자가 볼 화면 확인하고 보내기"
            />
            <button className="btn btn-ghost" style={{ justifySelf: "center" }}>미리보기 없이 바로 보내기</button>
          </div>
        ) : awaitingReview ? (
          // 준비된 리포트를 여는 사람은 "보낼지 판단하는" 쪽이다 — 발송이 기본 버튼
          <div style={{ display: "grid", gap: 8 }}>
            <button className="ward-send">확인했습니다 · 보호자에게 보내기</button>
            <button
              formAction={sendWardReport.bind(null, kind, id, patientId, "ready")}
              className="btn btn-ghost"
              style={{ justifySelf: "center" }}
            >
              고쳐서 다시 준비만 하기
            </button>
            <p className="ward-prefill" style={{ textAlign: "center", margin: 0 }}>
              아직 보호자에게 나가지 않았습니다
            </p>
          </div>
        ) : (
          // 병동에서 채우는 사람은 대개 간호사다. 기본은 발송이 아니라 "준비 완료".
          <div style={{ display: "grid", gap: 8 }}>
            <button
              formAction={sendWardReport.bind(null, kind, id, patientId, "ready")}
              className="ward-send"
            >
              발송 준비 완료
            </button>
            <button className="btn btn-ghost" style={{ justifySelf: "center" }}>
              내가 확인했습니다 · 바로 보내기
            </button>
            <p className="ward-prefill" style={{ textAlign: "center", margin: 0 }}>
              준비 완료를 누르면 수의사에게 확인 알림이 갑니다
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
