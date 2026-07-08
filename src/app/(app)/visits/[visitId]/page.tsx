import { createClient } from "@/lib/supabase/server";
import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { updateVisitNote, deletePrescription, deleteFile } from "./actions";
import { PrescriptionForm } from "./PrescriptionForm";
import { ImageUpload, MediaUpload } from "./FileUpload";
import { signedUrl } from "@/lib/storage";
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

  const [{ data: drugs }, { data: rxs }, { data: images }, { data: mediaRows }] =
    await Promise.all([
      supabase.from("drug").select("id, name").order("name"),
      supabase
        .from("prescription")
        .select("id, dose, frequency, duration, drug:drug_id(name)")
        .eq("visit_id", visitId),
      supabase
        .from("medical_image")
        .select("id, modality, file_name, storage_path")
        .eq("visit_id", visitId),
      supabase
        .from("media")
        .select("id, kind, file_name, storage_path")
        .eq("visit_id", visitId),
    ]);

  const imageLinks = await Promise.all(
    (images ?? []).map(async (i) => ({ ...i, url: await signedUrl(i.storage_path) }))
  );
  const mediaLinks = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({ ...m, url: await signedUrl(m.storage_path) }))
  );

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

      <section className="space-y-3">
        <h2 className="text-lg font-medium">처방</h2>
        <DataTable
          headers={["약품", "용량", "용법", "기간", ""]}
          empty="처방이 없습니다."
          rows={(rxs ?? []).map((r) => [
            (r.drug as unknown as { name: string })?.name ?? "-",
            r.dose ?? "-",
            r.frequency ?? "-",
            r.duration ?? "-",
            <form key="d" action={deletePrescription.bind(null, v.id, r.id)}>
              <button className="link-btn danger">삭제</button>
            </form>,
          ])}
        />
        <PrescriptionForm visitId={v.id} drugs={drugs ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">의료영상</h2>
        <ul className="space-y-1 text-sm">
          {imageLinks.map((i) => (
            <li key={i.id} className="flex items-center gap-3">
              <span className="uppercase text-gray-500">{i.modality}</span>
              {i.url ? (
                <a href={i.url} target="_blank" className="link-btn">
                  {i.file_name}
                </a>
              ) : (
                i.file_name
              )}
              <form action={deleteFile.bind(null, v.id, "medical_image", i.id, i.storage_path)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </li>
          ))}
          {imageLinks.length === 0 && <li className="text-gray-500">없음</li>}
        </ul>
        <ImageUpload visitId={v.id} patientId={patient.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">사진 / 영상</h2>
        <ul className="space-y-1 text-sm">
          {mediaLinks.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <span className="text-gray-500">{m.kind ?? "-"}</span>
              {m.url ? (
                <a href={m.url} target="_blank" className="link-btn">
                  {m.file_name}
                </a>
              ) : (
                m.file_name
              )}
              <form action={deleteFile.bind(null, v.id, "media", m.id, m.storage_path)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </li>
          ))}
          {mediaLinks.length === 0 && <li className="text-gray-500">없음</li>}
        </ul>
        <MediaUpload visitId={v.id} patientId={patient.id} />
      </section>
    </div>
  );
}
