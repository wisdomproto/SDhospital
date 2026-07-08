import { createClient } from "@/lib/supabase/server";
import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { discharge, reopenAdmission } from "./actions";
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
    </div>
  );
}
