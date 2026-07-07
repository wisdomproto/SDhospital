import { createClient } from "@/lib/supabase/server";
import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateVisitNote } from "./actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function VisitDetail({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note, patient:patient_id(id, name)")
    .eq("id", visitId)
    .single();
  if (!v) notFound();
  const patient = v.patient as unknown as { id: string; name: string };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href={`/patients/${patient.id}`} className="text-sm text-blue-600">
          ← {patient.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {v.visit_date} {v.visit_no != null ? `· ${v.visit_no}회차` : ""}
        </h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">진료 내용</h2>
        <form action={updateVisitNote.bind(null, v.id)} className="space-y-2">
          <textarea name="note" rows={6} defaultValue={v.note ?? ""} className={inputClass} />
          <SubmitButton>저장</SubmitButton>
        </form>
      </section>
    </div>
  );
}
