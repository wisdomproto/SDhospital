import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { VitalChart } from "@/components/VitalChart";
import { notFound } from "next/navigation";

type FileRow = { id: string; file_name: string | null; storage_path: string };
type Rx = { dose: string | null; frequency: string | null; duration: string | null; drug: { name: string } | null };

async function signAll<T extends { storage_path: string }>(rows: T[]) {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
}

export default async function PortalPatient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: p } = await supabase
    .from("patient")
    .select("id, name, species, breed, sex, birth_date")
    .eq("id", id)
    .single();
  if (!p) notFound();

  const { data: visits } = await supabase
    .from("visit")
    .select(
      "id, visit_date, visit_no, note, prescription(dose, frequency, duration, drug:drug_id(name)), medical_image(id, file_name, storage_path), media(id, file_name, storage_path)"
    )
    .eq("patient_id", id)
    .order("visit_date", { ascending: false });

  const { data: admissions } = await supabase
    .from("admission")
    .select(
      "id, admitted_at, discharged_at, status, vital(measured_at, temperature, heart_rate, resp_rate, systolic, diastolic)"
    )
    .eq("patient_id", id)
    .order("admitted_at", { ascending: false });

  const visitBlocks = await Promise.all(
    (visits ?? []).map(async (v) => {
      const imgs = await signAll((v.medical_image as FileRow[]) ?? []);
      const med = await signAll((v.media as FileRow[]) ?? []);
      const rx = (v.prescription as unknown as Rx[]) ?? [];
      const files = [...imgs, ...med];
      return (
        <div key={v.id} className="rounded border p-3 text-sm">
          <div className="font-medium">
            {v.visit_date}
            {v.visit_no != null ? ` · ${v.visit_no}회차` : ""}
          </div>
          {v.note && <p className="mt-1 whitespace-pre-wrap text-gray-700">{v.note}</p>}
          {rx.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-gray-700">
              {rx.map((r, i) => (
                <li key={i}>
                  {r.drug?.name} {r.dose ?? ""} {r.frequency ?? ""} {r.duration ?? ""}
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {files.map((f) =>
                f.url ? (
                  <a key={f.id} href={f.url} target="_blank" className="link-btn">
                    {f.file_name}
                  </a>
                ) : (
                  <span key={f.id}>{f.file_name}</span>
                )
              )}
            </div>
          )}
        </div>
      );
    })
  );

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <p className="text-sm text-gray-600">
          {[p.species, p.breed].filter(Boolean).join(" / ")}
          {p.sex ? ` · ${p.sex}` : ""}
          {p.birth_date ? ` · ${p.birth_date}` : ""}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">진료 기록</h2>
        {visitBlocks.length > 0 ? (
          visitBlocks
        ) : (
          <p className="text-sm text-gray-500">진료 기록이 없습니다.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">입원 / 바이털</h2>
        {(admissions ?? []).length > 0 ? (
          (admissions ?? []).map((a) => {
            const vitals = (
              (a.vital as {
                measured_at: string;
                temperature: number | null;
                heart_rate: number | null;
                resp_rate: number | null;
                systolic: number | null;
                diastolic: number | null;
              }[]) ?? []
            )
              .slice()
              .sort((x, y) => x.measured_at.localeCompare(y.measured_at));
            return (
              <div key={a.id} className="rounded border p-3">
                <div className="text-sm font-medium">
                  입원 {a.admitted_at}{" "}
                  {a.status === "admitted" ? "· 입원중" : `· 퇴원 ${a.discharged_at ?? ""}`}
                </div>
                {vitals.length > 0 && (
                  <div className="mt-2">
                    <VitalChart data={vitals} />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500">입원 기록이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
