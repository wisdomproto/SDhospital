import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { discharge, reopenAdmission, updateAdmission } from "./actions";
import { AdmImageUpload, AdmMediaUpload } from "./FileUpload";
import { AdmissionFlowsheet } from "./AdmissionFlowsheet";
import { MediaGallery } from "./MediaGallery";
import { VitalChart } from "@/components/VitalChart";
import { signedUrl, isVideoFile } from "@/lib/storage";
import { notFound } from "next/navigation";

export default async function AdmissionDetail({
  params,
}: {
  params: Promise<{ id: string; admissionId: string }>;
}) {
  const { id: patientId, admissionId } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status, note")
    .eq("id", admissionId)
    .single();
  if (!a) notFound();

  const [{ data: vitals }, { data: treatments }, { data: images }, { data: mediaRows }] = await Promise.all([
    supabase
      .from("vital")
      .select(
        "id, measured_at, temperature, heart_rate, resp_rate, systolic, diastolic, glucose, weight, respiratory, vomit, defecation, urination, feeding, fluid, tests"
      )
      .eq("admission_id", admissionId)
      .order("measured_at", { ascending: true }),
    supabase
      .from("treatment")
      .select("id, given_at, name")
      .eq("admission_id", admissionId)
      .order("given_at", { ascending: true }),
    supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("admission_id", admissionId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("admission_id", admissionId),
  ]);

  // ---- build day-by-day flowsheet: admission → discharge/today (KST) ----
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const timeLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
  const dayLabel = (day: string) =>
    new Date(day + "T00:00:00+09:00").toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });

  type VRow = NonNullable<typeof vitals>[number];
  const vitalsByDay = new Map<string, VRow[]>();
  for (const v of vitals ?? []) {
    const day = dayKey(v.measured_at);
    (vitalsByDay.get(day) ?? vitalsByDay.set(day, []).get(day)!).push(v);
  }
  const treatByDay = new Map<string, string[]>();
  for (const t of treatments ?? []) {
    const day = dayKey(t.given_at);
    (treatByDay.get(day) ?? treatByDay.set(day, []).get(day)!).push(t.name);
  }

  // every date from admission to discharge (or today if still admitted)
  const startDay = dayKey(a.admitted_at);
  const endDay = a.discharged_at ? dayKey(a.discharged_at) : dayKey(new Date().toISOString());
  const allDays: string[] = [];
  {
    let d = new Date(startDay + "T00:00:00+09:00");
    const end = new Date(endDay + "T00:00:00+09:00");
    let guard = 0;
    while (d <= end && guard++ < 400) {
      allDays.push(dayKey(d.toISOString()));
      d = new Date(d.getTime() + 86_400_000);
    }
  }

  // every day shows all 24 hourly slots; existing records fill their hour, the rest are empty & editable
  const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
  const emptyRow = (day: string, t: string) => ({
    vitalId: null, time: t, iso: `${day}T${t}:00+09:00`,
    temperature: null, heart_rate: null, resp_rate: null, systolic: null,
    glucose: null, weight: null, urination: null, feeding: null, tests: null,
  });
  const flowDays = allDays.map((day) => {
    const byHour = new Map<string, VRow[]>();
    for (const v of vitalsByDay.get(day) ?? []) {
      const hh = timeLabel(v.measured_at).slice(0, 2) + ":00";
      (byHour.get(hh) ?? byHour.set(hh, []).get(hh)!).push(v);
    }
    const rows = HOURS.flatMap((hh) => {
      const at = byHour.get(hh) ?? [];
      if (at.length === 0) return [emptyRow(day, hh)];
      return at.map((v) => ({
        vitalId: v.id, time: timeLabel(v.measured_at), iso: v.measured_at,
        temperature: v.temperature, heart_rate: v.heart_rate, resp_rate: v.resp_rate, systolic: v.systolic,
        glucose: v.glucose, weight: v.weight, urination: v.urination, feeding: v.feeding, tests: v.tests,
      }));
    });
    return { key: day, label: dayLabel(day), rows, treats: treatByDay.get(day) ?? [] };
  });

  const imageLinks = await Promise.all(
    (images ?? []).map(async (i) => ({ ...i, url: await signedUrl(i.storage_path) }))
  );
  const mediaLinks = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({ ...m, url: await signedUrl(m.storage_path) }))
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">입원</p>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {a.admitted_at}
            {a.status === "admitted" ? (
              <span className="pill warning">입원중</span>
            ) : (
              <span className="pill success">퇴원 {a.discharged_at ?? ""}</span>
            )}
          </h1>
        </div>
        {a.status === "admitted" ? (
          <form action={discharge.bind(null, patientId, a.id)} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <label className="field-label" style={{ marginBottom: 0 }}>
              퇴원일
              <input type="date" name="discharged_at" className={inputClass} style={{ marginTop: 6, width: 160 }} />
            </label>
            <SubmitButton>퇴원 처리</SubmitButton>
          </form>
        ) : (
          <form action={reopenAdmission.bind(null, patientId, a.id)}>
            <button className="btn btn-ghost btn-sm">입원중으로 되돌리기</button>
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">입원 정보 · 메모</h2></div>
        <form action={updateAdmission.bind(null, patientId, a.id)} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <FormField label="입원일">
            <input type="date" name="admitted_at" defaultValue={a.admitted_at} className={inputClass} style={{ maxWidth: 200 }} />
          </FormField>
          <FormField label="메모 (경과·간호 기록)">
            <textarea name="note" rows={6} defaultValue={a.note ?? ""} className={inputClass} />
          </FormField>
          <div><SubmitButton>저장</SubmitButton></div>
        </form>
      </div>

      {(vitals ?? []).length > 0 && (
        <div className="card">
          <div className="card-head"><h2 className="section-title">바이털 추이</h2></div>
          <VitalChart
            data={(vitals ?? []).map((v) => ({
              measured_at: v.measured_at,
              temperature: v.temperature,
              heart_rate: v.heart_rate,
              resp_rate: v.resp_rate,
              systolic: v.systolic,
              diastolic: v.diastolic,
              glucose: v.glucose,
              weight: v.weight,
            }))}
          />
        </div>
      )}

      {/* 일자별 입원 기록 (처치표 · 투약) — 입원~퇴원 날짜별 편집 */}
      {flowDays.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2 className="section-title">일자별 입원 기록 · 처치표</h2>
            <span className="pill muted">{flowDays.length}일 · 입원~{a.discharged_at ? "퇴원" : "현재"}</span>
          </div>
          <AdmissionFlowsheet patientId={patientId} admissionId={a.id} days={flowDays} />
        </div>
      )}

      <div className="quickadd-grid">
        <div className="card">
          <div className="card-head">
            <h2 className="section-title">의료영상</h2>
            <span className="pill muted">이 입원 {imageLinks.length}건</span>
          </div>
          {imageLinks.length === 0 ? (
            <div className="empty-state">등록된 의료영상이 없습니다.</div>
          ) : (
            <MediaGallery
              patientId={patientId}
              admissionId={a.id}
              table="medical_image"
              items={imageLinks.map((i) => ({
                id: i.id, url: i.url, storagePath: i.storage_path,
                label: i.modality ?? "기타", isVideo: false, fileName: i.file_name ?? "",
              }))}
            />
          )}
          <AdmImageUpload patientId={patientId} admissionId={a.id} />
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="section-title">사진 / 영상</h2>
            <span className="pill muted">이 입원 {mediaLinks.length}건</span>
          </div>
          {mediaLinks.length === 0 ? (
            <div className="empty-state">등록된 사진·영상이 없습니다.</div>
          ) : (
            <MediaGallery
              patientId={patientId}
              admissionId={a.id}
              table="media"
              items={mediaLinks.map((m) => ({
                id: m.id, url: m.url, storagePath: m.storage_path,
                label: isVideoFile(m.file_name) ? "동영상" : m.kind ?? "사진",
                isVideo: isVideoFile(m.file_name), fileName: m.file_name ?? "",
              }))}
            />
          )}
          <AdmMediaUpload patientId={patientId} admissionId={a.id} />
        </div>
      </div>
    </div>
  );
}
