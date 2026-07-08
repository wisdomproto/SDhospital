import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { discharge, reopenAdmission, addVital, deleteVital } from "./actions";
import { VitalChart } from "./VitalChart";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdmissionDetail({
  params,
}: {
  params: Promise<{ admissionId: string }>;
}) {
  const { admissionId } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status, note, patient:patient_id(id, name)")
    .eq("id", admissionId)
    .single();
  if (!a) notFound();
  const patient = a.patient as unknown as { id: string; name: string };

  const { data: vitals } = await supabase
    .from("vital")
    .select("id, measured_at, temperature, heart_rate, resp_rate, systolic, diastolic")
    .eq("admission_id", admissionId)
    .order("measured_at", { ascending: true });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href={`/patients/${patient.id}`} className="text-sm text-blue-600">
          ← {patient.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          입원 {a.admitted_at}{" "}
          {a.status === "admitted" ? "· 입원중" : `· 퇴원 ${a.discharged_at ?? ""}`}
        </h1>
      </div>

      <section className="space-y-2">
        {a.status === "admitted" ? (
          <form action={discharge.bind(null, a.id)} className="flex items-end gap-2">
            <label className="text-sm">
              <span className="mr-2 text-gray-600">퇴원일</span>
              <input
                type="date"
                name="discharged_at"
                className={inputClass + " inline-block w-40"}
              />
            </label>
            <SubmitButton>퇴원 처리</SubmitButton>
          </form>
        ) : (
          <form action={reopenAdmission.bind(null, a.id)}>
            <button className="text-sm text-blue-600">입원중으로 되돌리기</button>
          </form>
        )}
      </section>

      {(vitals ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">바이털 추이</h2>
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
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">바이털</h2>
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
            <form key="d" action={deleteVital.bind(null, a.id, v.id)}>
              <button className="text-red-600">삭제</button>
            </form>,
          ])}
        />

        <form
          action={addVital.bind(null, a.id)}
          className="grid grid-cols-3 gap-2 md:grid-cols-6"
        >
          <FormField label="측정시각">
            <input type="datetime-local" name="measured_at" className={inputClass} />
          </FormField>
          <FormField label="체온">
            <input name="temperature" inputMode="decimal" className={inputClass} />
          </FormField>
          <FormField label="심박">
            <input name="heart_rate" inputMode="numeric" className={inputClass} />
          </FormField>
          <FormField label="호흡">
            <input name="resp_rate" inputMode="numeric" className={inputClass} />
          </FormField>
          <FormField label="수축기">
            <input name="systolic" inputMode="numeric" className={inputClass} />
          </FormField>
          <FormField label="이완기">
            <input name="diastolic" inputMode="numeric" className={inputClass} />
          </FormField>
          <div className="col-span-3 md:col-span-6">
            <SubmitButton>바이털 추가</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
