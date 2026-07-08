import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { discharge, reopenAdmission, addVital, deleteVital } from "./actions";
import { VitalChart } from "@/components/VitalChart";
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

  const { data: vitals } = await supabase
    .from("vital")
    .select("id, measured_at, temperature, heart_rate, resp_rate, systolic, diastolic")
    .eq("admission_id", admissionId)
    .order("measured_at", { ascending: true });

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
            }))}
          />
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">바이털 기록</h2>
          <span className="pill muted">{(vitals ?? []).length}건</span>
        </div>
        <DataTable
          headers={["측정시각", "체온", "심박", "호흡", "수축기", "이완기", ""]}
          empty="측정 기록이 없습니다."
          rows={[...(vitals ?? [])].reverse().map((v) => [
            new Date(v.measured_at).toLocaleString("ko-KR"),
            v.temperature ?? "-",
            v.heart_rate ?? "-",
            v.resp_rate ?? "-",
            v.systolic ?? "-",
            v.diastolic ?? "-",
            <form key="d" action={deleteVital.bind(null, patientId, a.id, v.id)}>
              <button className="link-btn danger">삭제</button>
            </form>,
          ])}
        />

        <form
          action={addVital.bind(null, patientId, a.id)}
          
          className="vital-form"
        >
          <FormField label="측정시각"><input type="datetime-local" name="measured_at" className={inputClass} /></FormField>
          <FormField label="체온"><input name="temperature" inputMode="decimal" className={inputClass} /></FormField>
          <FormField label="심박"><input name="heart_rate" inputMode="numeric" className={inputClass} /></FormField>
          <FormField label="호흡"><input name="resp_rate" inputMode="numeric" className={inputClass} /></FormField>
          <FormField label="수축기"><input name="systolic" inputMode="numeric" className={inputClass} /></FormField>
          <FormField label="이완기"><input name="diastolic" inputMode="numeric" className={inputClass} /></FormField>
          <div style={{ gridColumn: "1 / -1" }}><SubmitButton>바이털 추가</SubmitButton></div>
        </form>
      </div>
    </div>
  );
}
