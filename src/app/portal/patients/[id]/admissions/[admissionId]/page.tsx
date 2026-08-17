import { createClient } from "@/lib/supabase/server";
import { signedUrl, signMedicalImages } from "@/lib/storage";
import { dailyLines } from "@/lib/admission-report";
import { MediaGrid, type SignedFile } from "../../MediaGrid";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshOnRead } from "@/app/portal/RefreshOnRead";

async function signAll(rows: Omit<SignedFile, "url">[]): Promise<SignedFile[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
}

export default async function PortalAdmissionDetail({
  params,
}: {
  params: Promise<{ id: string; admissionId: string }>;
}) {
  const { id, admissionId } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("admission")
    .select("id, visit_id, admitted_at, discharged_at, status")
    .eq("id", admissionId)
    .single();
  if (!a) notFound();

  // 바이털 수치는 보호자에게 내보내지 않는다 — 38.4라는 숫자는 안심을 주지 못한다.
  // 매일 필요한 건 "잘 먹었나 · 잘 쌌나"이고, 이상이 있으면 특이사항으로 적어 보낸다.
  const [{ data: images }, { data: media }, { data: imgReq }] = await Promise.all([
    supabase.from("medical_image").select("id, modality, file_name, storage_path, preview_path").eq("admission_id", admissionId),
    supabase.from("media").select("id, kind, file_name, storage_path").eq("admission_id", admissionId),
    // ⚠️ 승인은 **회차**에 달린다 (`image_request.visit_id`). 입원은 회차에 딸린 기록이라
    // 그 회차의 승인을 그대로 따른다 — 보호자는 회차 화면에서 요청한다.
    a.visit_id
      ? supabase.from("image_request").select("approved_at").eq("visit_id", a.visit_id).maybeSingle()
      : { data: null },
  ]);
  // ⚠️⚠️ **승인 전에는 서명 URL 자체를 만들지 않는다.** 회차 화면은 이걸 지키고 있었는데
  // **이 화면만 안 지켰다** — 그리고 의료영상 37건 중 30건이 회차가 아니라 입원에 붙어 있어서,
  // 규칙이 19%에만 걸리고 81%는 그대로 새고 있었다.
  // 판독 소견 없이 X-ray 를 띄우면 보호자가 스스로 해석한다. 그게 이 규칙이 있는 이유다.
  const imageLinks = imgReq?.approved_at ? await signMedicalImages(images ?? []) : [];
  // 아이 사진·진료 중 영상(`media`)은 그대로 나간다 — 그건 안심시키려고 보내는 것이다.
  const mediaLinks = await signAll((media as Omit<SignedFile, "url">[]) ?? []);

  // 발송된 일일 리포트만 보여주고, 최신 것을 열람 처리한다 (DEFINER 함수로만 기록 가능)
  const { data: reportRows } = await supabase
    .from("admission_report")
    .select("id, report_date, comment, feeding, elimination, special, sent_at, read_at")
    .eq("admission_id", admissionId)
    .not("sent_at", "is", null)
    .order("report_date", { ascending: false });
  const reports = reportRows ?? [];
  // 안 읽은 것을 전부 읽음 처리한다. 최신 한 건만 찍으면 배지가 영영 안 사라진다.
  // 화면에는 이번에 새로 온 것을 표시해야 하므로, 처리 전에 어떤 게 안 읽음이었는지 기억해 둔다.
  const wasUnread = new Set(reports.filter((r) => r.read_at == null).map((r) => r.id));
  await Promise.all(
    [...wasUnread].map((id) => supabase.rpc("mark_admission_report_read", { p_report_id: id }))
  );

  return (
    <>
      <RefreshOnRead when={wasUnread.size > 0} />
      <Link href={`/portal/patients/${id}/visits`} className="portal-tile-sub" style={{ textDecoration: "none" }}>← 진료 기록</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: "1.25rem", fontWeight: 900 }}>입원 {a.admitted_at}</div>
          <div className="portal-tile-sub">
            {a.status === "admitted" ? "입원중" : `퇴원 ${a.discharged_at ?? ""}`}
          </div>
        </div>
        <span className={`pill ${a.status === "admitted" ? "warning" : "success"}`} style={{ marginLeft: "auto" }}>
          {a.status === "admitted" ? "입원중" : "퇴원"}
        </span>
      </div>

      {reports.length > 0 ? (
        <div className="portal-card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>하루하루 경과</div>
          <div style={{ display: "grid", gap: 14 }}>
            {reports.map((r, i) => (
              <div
                key={r.id}
                className={wasUnread.has(r.id) ? "daily-new" : undefined}
                style={{
                  paddingBottom: 12,
                  borderBottom: i < reports.length - 1 ? "1px solid var(--line)" : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: ".82rem", color: "var(--muted)" }}>
                    {r.report_date}
                  </div>
                  {wasUnread.has(r.id) && <span className="pill-new">새 경과</span>}
                </div>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  {dailyLines(r).map((l) => (
                    <div key={l.label} className={`daily-line ${l.tone}`}>
                      <span className="k">{l.label}</span>
                      <span className="v">{l.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="portal-card">
          <p className="portal-tile-sub" style={{ margin: 0 }}>
            아직 도착한 경과가 없어요. 담당 선생님이 오늘 상태를 보내면 여기에 쌓입니다.
          </p>
        </div>
      )}

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>의료영상</div>
        <MediaGrid files={imageLinks} />
      </div>

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>사진 / 영상</div>
        <MediaGrid files={mediaLinks} />
      </div>
    </>
  );
}
