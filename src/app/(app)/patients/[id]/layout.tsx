import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PatientNav } from "./PatientNav";

export default async function PatientLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: patient }, { data: visits }, { data: admissions }] = await Promise.all([
    supabase.from("patient").select("id, name, species").eq("id", id).single(),
    supabase
      .from("visit")
      .select("id, visit_date, visit_no")
      .eq("patient_id", id)
      .order("visit_date", { ascending: false }),
    supabase
      .from("admission")
      .select("id, admitted_at, status")
      .eq("patient_id", id)
      .order("admitted_at", { ascending: false }),
  ]);
  if (!patient) notFound();

  return (
    <div className="patient-shell">
      <PatientNav
        patientId={patient.id}
        name={patient.name}
        species={patient.species}
        visits={visits ?? []}
        admissions={admissions ?? []}
      />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
