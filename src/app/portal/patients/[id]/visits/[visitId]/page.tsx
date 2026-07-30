import { createClient } from "@/lib/supabase/server";
import { signedUrl, signMedicalImages } from "@/lib/storage";
import { MediaGrid, type SignedFile } from "../../MediaGrid";
import { buildOwnerReport } from "@/lib/owner-report";
import { matchCaseStories, type CaseStory } from "@/lib/case-stories";
import { ReportActions } from "./ReportActions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshOnRead } from "@/app/portal/RefreshOnRead";

async function signAll(rows: Omit<SignedFile, "url">[]): Promise<SignedFile[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
}

export default async function PortalVisitDetail({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>;
}) {
  const { id, visitId } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visit")
    .select("id, patient_id, visit_date, visit_no, report_comment, report_sent_at, report_read_at, chief_complaint, weight_kg, report_notice")
    .eq("id", visitId)
    .single();
  if (!v) notFound();

  const [{ data: patient }, { data: prev }] = await Promise.all([
    supabase.from("patient").select("name, species, breed, birth_date").eq("id", v.patient_id).single(),
    supabase
      .from("visit")
      .select("visit_date, chief_complaint, weight_kg, report_comment, report_notice")
      .eq("patient_id", v.patient_id)
      .lt("visit_date", v.visit_date)
      .not("report_sent_at", "is", null)
      .order("visit_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const report = patient ? buildOwnerReport(patient, v, prev) : null;

  // 같은 문제로 치료받은 사례. 태그가 주 증상에 걸릴 때만 붙고, 없으면 아예 안 붙는다.
  const { data: stories } = await supabase
    .from("case_story")
    .select("id, title, summary, url, tags, species");
  const cases = matchCaseStories((stories ?? []) as CaseStory[], {
    chiefComplaint: v.chief_complaint,
    species: patient?.species ?? null,
  });

  // 열람 표시 — 보호자는 visit 에 쓰기 권한이 없으므로 DEFINER 함수로만 기록한다.
  // 최초 1회만 기록되고, 실패해도 화면은 그대로 보여준다.
  // 이번에 처음 읽은 것인지 기억해 둔다 — 그때만 레이아웃(탭 배지)을 다시 그린다
  const justRead = Boolean(v.report_sent_at && v.report_read_at == null);
  if (justRead) await supabase.rpc("mark_visit_report_read", { p_visit_id: visitId });

  const { data: admissions } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status")
    .eq("visit_id", visitId);
  const admIds = (admissions ?? []).map((a) => a.id);
  const { count: unreadDailyCount } = admIds.length
    ? await supabase
        .from("admission_report")
        .select("id", { count: "exact", head: true })
        .in("admission_id", admIds)
        .not("sent_at", "is", null)
        .is("read_at", null)
    : { count: 0 };
  const unreadDaily = unreadDailyCount ?? 0;

  const [{ data: images }, { data: media }] = await Promise.all([
    supabase.from("medical_image").select("id, modality, file_name, storage_path, preview_path").eq("visit_id", visitId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
  ]);
  const imageLinks = await signMedicalImages(images ?? []);
  // 보호자에게는 "무슨 검사를 했는지"만 보여준다.
  // 약품·용량 같은 처방 상세는 분쟁 소지가 있어 내보내지 않는다.
  const MODALITY_KO: Record<string, string> = { xray: "X-ray", ct: "CT", mri: "MRI", other: "영상 검사" };
  const examSummary = Object.entries(
    (images ?? []).reduce<Record<string, number>>((acc, i) => {
      const k = MODALITY_KO[i.modality ?? "other"] ?? "영상 검사";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([k, n]) => `${k} ${n}건`);
  const mediaLinks = await signAll((media as Omit<SignedFile, "url">[]) ?? []);

  return (
    <>
      <RefreshOnRead when={justRead} />
      <Link href={`/portal/patients/${id}/visits`} className="portal-tile-sub" style={{ textDecoration: "none" }}>← 진료 기록</Link>
      <div>
        <div style={{ fontSize: "1.25rem", fontWeight: 900, lineHeight: 1.35 }}>
          {report?.title ?? v.visit_date}
        </div>
        <div className="portal-tile-sub">
          {[v.visit_date, v.visit_no != null ? `${v.visit_no}회차` : null, report?.profile]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      {report && report.changes.length > 0 && (
        <div className="portal-card" style={{ background: "var(--surface-soft, #f7f5f0)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>지난 방문 대비 {patient!.name}의 변화</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {report.changes.map((c) => (
              <li key={c} style={{ fontSize: ".92rem", lineHeight: 1.65 }}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {v.report_sent_at && report && report.states.length > 0 && (
        <div className="portal-card" style={{ borderLeft: "4px solid var(--brand, #2f7d6a)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{patient!.name}의 상태예요</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {report.states.map((s) => (
              <li key={s} style={{ fontSize: ".95rem", lineHeight: 1.7 }}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {cases.length > 0 && (
        <div className="portal-card">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>같은 문제로 치료받은 아이들</div>
          <p className="portal-tile-sub" style={{ margin: "0 0 10px" }}>
            병원이 기록해 둔 치료 이야기예요. 아이마다 상태가 달라 경과는 다를 수 있어요.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {cases.map((c) => (
              <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="portal-tile case-tile">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: ".92rem" }}>{c.title}</div>
                  {c.summary && <div className="portal-tile-sub portal-tile-clamp">{c.summary}</div>}
                </div>
                <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>↗</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {v.report_sent_at && report?.notice && (
        <div className="portal-card">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>추가 안내 사항이에요</div>
          <p style={{ margin: 0, fontSize: ".95rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {report.notice}
          </p>
        </div>
      )}

      {examSummary.length > 0 && (
        <div className="portal-card">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>진행한 검사</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {examSummary.map((e) => (
              <span key={e} className="pill muted">{e}</span>
            ))}
          </div>
        </div>
      )}

      {(admissions ?? []).map((a) => (
        // 입원 경과는 입원 화면에서만 본다. 같은 내용을 두 곳에 두면
        // 어느 쪽이 최신인지 보호자가 판단해야 한다.
        <Link key={a.id} href={`/portal/patients/${id}/admissions/${a.id}`} className="portal-tile">
          <span aria-hidden style={{ fontSize: 18 }}>🏥</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: ".95rem" }}>
              입원 {a.admitted_at}
              {a.discharged_at ? ` ~ ${a.discharged_at}` : ""}
            </div>
            <div className="portal-tile-sub">
              {a.status === "admitted" ? "입원 중이에요" : "하루하루 경과 보기"}
              {unreadDaily > 0 && ` · 새 경과 ${unreadDaily}`}
            </div>
          </div>
          {unreadDaily > 0 && <span className="dot-new" aria-label="새 경과" />}
          <span style={{ color: "var(--muted)", fontSize: "1.2rem" }}>›</span>
        </Link>
      ))}

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>의료영상</div>
        <MediaGrid files={imageLinks} />
      </div>

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>사진 / 영상</div>
        <MediaGrid files={mediaLinks} />
      </div>

      {v.report_sent_at && (
        <>
          <ReportActions title={`${patient?.name ?? ""} 진료 리포트`} />
          <p className="portal-tile-sub no-print" style={{ margin: 0, textAlign: "center" }}>
            SD동물의료센터가 발행한 진료 안내 자료입니다. 궁금하신 점은 병원으로 문의해 주세요.
          </p>
        </>
      )}
    </>
  );
}
