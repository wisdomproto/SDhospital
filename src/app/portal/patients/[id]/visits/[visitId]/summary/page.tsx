import { createClient } from "@/lib/supabase/server";
import { signedUrl, signMedicalImages } from "@/lib/storage";
import { MediaGrid, type SignedFile } from "../../../MediaGrid";
import { ReportActions } from "./ReportActions";
import Link from "next/link";
import { notFound } from "next/navigation";

async function signAll(rows: Omit<SignedFile, "url">[]): Promise<SignedFile[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
}

const fmtDate = (d: string) =>
  new Date(d + (d.length === 10 ? "T00:00:00+09:00" : "")).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * 종합 리포트 — 새로 입력받는 것이 하나도 없다.
 * 회차·처방·영상·입원 경과·일일 리포트를 한 장으로 조립할 뿐이다.
 */
export default async function VisitSummary({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id, visitId } = await params;
  const supabase = await createClient();

  const { data: v } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note, report_comment, report_sent_at, patient:patient_id(name, species, breed, sex, birth_date)")
    .eq("id", visitId)
    .single();
  if (!v) notFound();
  const p = v.patient as unknown as {
    name: string; species: string | null; breed: string | null; sex: string | null; birth_date: string | null;
  } | null;

  const [{ data: images }, { data: media }, { data: admissions }] = await Promise.all([
    supabase.from("medical_image").select("id, modality, file_name, storage_path, preview_path").eq("visit_id", visitId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
    supabase.from("admission").select("id, admitted_at, discharged_at, status").eq("visit_id", visitId),
  ]);

  const admIds = (admissions ?? []).map((a) => a.id);
  const [{ data: dailyReports }, { data: vitals }] = await Promise.all([
    admIds.length
      ? supabase
          .from("admission_report")
          .select("id, report_date, comment")
          .in("admission_id", admIds)
          .not("sent_at", "is", null)
          .order("report_date", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; report_date: string; comment: string | null }[] }),
    admIds.length
      ? supabase
          .from("vital")
          .select("measured_at, temperature, heart_rate")
          .in("admission_id", admIds)
          .order("measured_at", { ascending: true })
      : Promise.resolve({ data: [] as { measured_at: string; temperature: number | null; heart_rate: number | null }[] }),
  ]);

  const imageLinks = await signMedicalImages(images ?? []);
  const MODALITY_KO: Record<string, string> = { xray: "X-ray", ct: "CT", mri: "MRI", other: "영상 검사" };
  const examSummary = Object.entries(
    (images ?? []).reduce<Record<string, number>>((acc, i) => {
      const k = MODALITY_KO[i.modality ?? "other"] ?? "영상 검사";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([k, n]) => `${k} ${n}건`);
  const mediaLinks = await signAll((media as Omit<SignedFile, "url">[]) ?? []);

  const temps = (vitals ?? []).map((x) => x.temperature).filter((n): n is number => n != null);
  const hrs = (vitals ?? []).map((x) => x.heart_rate).filter((n): n is number => n != null);
  const range = (arr: number[]) =>
    arr.length ? `${Math.min(...arr).toFixed(1)} ~ ${Math.max(...arr).toFixed(1)}` : null;

  return (
    <>
      <div className="no-print">
        <Link href={`/portal/patients/${id}/visits/${visitId}`} className="portal-tile-sub" style={{ textDecoration: "none" }}>
          ← 진료 상세
        </Link>
      </div>

      <div className="report-sheet">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--muted)", letterSpacing: ".08em" }}>
              SD동물의료센터 진료 리포트
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 900, margin: "6px 0 0" }}>
              {p?.name} · {fmtDate(v.visit_date)}
            </h1>
            <div style={{ fontSize: ".85rem", color: "var(--muted)", marginTop: 4 }}>
              {[p?.species, p?.breed].filter(Boolean).join(" / ")}
              {p?.sex ? ` · ${p.sex}` : ""}
              {p?.birth_date ? ` · ${p.birth_date}생` : ""}
            </div>
          </div>
          <ReportActions title={`${p?.name} 진료 리포트`} />
        </div>

        {v.report_comment && (
          <section className="report-block">
            <h2>담당의 코멘트</h2>
            <p style={{ whiteSpace: "pre-wrap", fontSize: "1rem", lineHeight: 1.75 }}>{v.report_comment}</p>
          </section>
        )}

        {examSummary.length > 0 && (
          <section className="report-block">
            <h2>진행한 검사</h2>
            <p>{examSummary.join(" · ")}</p>
          </section>
        )}

        {(admissions ?? []).map((a) => (
          <section className="report-block" key={a.id}>
            <h2>입원 경과</h2>
            <p style={{ color: "var(--muted)", fontSize: ".88rem" }}>
              {fmtDate(a.admitted_at)} ~ {a.discharged_at ? fmtDate(a.discharged_at) : "입원 중"}
              {temps.length > 0 && ` · 체온 ${range(temps)}℃`}
              {hrs.length > 0 && ` · 심박 ${range(hrs)}회/분`}
            </p>
            {(dailyReports ?? []).length > 0 && (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {(dailyReports ?? []).map((d) => (
                  <div key={d.id} style={{ display: "flex", gap: 10 }}>
                    <span style={{ minWidth: 88, fontWeight: 700, fontSize: ".84rem", color: "var(--muted)" }}>
                      {d.report_date}
                    </span>
                    <span style={{ whiteSpace: "pre-wrap", fontSize: ".92rem" }}>{d.comment}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        {imageLinks.length > 0 && (
          <section className="report-block">
            <h2>의료영상</h2>
            <MediaGrid files={imageLinks} />
          </section>
        )}

        {mediaLinks.length > 0 && (
          <section className="report-block">
            <h2>사진 · 영상</h2>
            <MediaGrid files={mediaLinks} />
          </section>
        )}

        <p style={{ marginTop: 28, fontSize: ".75rem", color: "var(--muted)", lineHeight: 1.7 }}>
          이 리포트는 SD동물의료센터에서 발행한 진료 안내 자료입니다.
          궁금하신 점은 병원으로 문의해 주세요.
          {v.report_sent_at && ` · 발행 ${fmtDate(v.report_sent_at.slice(0, 10))}`}
        </p>
      </div>
    </>
  );
}
