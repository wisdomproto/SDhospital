import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateVisit, updatePrescription, deletePrescription, deleteFile, saveVisitReport, toggleVisitClosed, referBack, saveReferralDraft, createCheckup, approveImages } from "./actions";
import { PrescriptionForm } from "./PrescriptionForm";
import { SoapTemplate } from "./SoapTemplate";
import { ConsentIssue } from "./ConsentIssue";
import { OwnerPreview } from "./OwnerPreview";
import { ImageUpload, MediaUpload } from "./FileUpload";
import { createAdmission } from "../../admissions/actions";
import { DataTable } from "@/components/DataTable";
import { signedUrl } from "@/lib/storage";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function VisitDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; visitId: string }>;
  searchParams: Promise<{ new?: string; error?: string }>;
}) {
  const { id: patientId, visitId } = await params;
  const { new: isNew, error } = await searchParams;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note, closed_at, report_comment, report_sent_at, report_read_at, referral_note, referred_back_at, chief_complaint, weight_kg, report_notice, patient:patient_id(name, species, breed, birth_date, hospital:referring_hospital_id(name))")
    .eq("id", visitId)
    .single();
  if (!v) notFound();

  const [{ data: drugs }, { data: rxs }, { data: images }, { data: imgReq }, { data: mediaRows }, { data: admissions }, { data: consents }, { data: checkup }] =
    await Promise.all([
      supabase.from("drug").select("id, name").order("name"),
      supabase
        .from("prescription")
        .select("id, drug_id, dose, frequency, duration")
        .eq("visit_id", visitId),
      supabase.from("medical_image").select("id, modality, file_name, storage_path").eq("visit_id", visitId),
      supabase.from("image_request").select("requested_at, approved_at").eq("visit_id", visitId).maybeSingle(),
      supabase.from("media").select("id, kind, file_name, storage_path").eq("visit_id", visitId),
      supabase
        .from("admission")
        .select("id, admitted_at, discharged_at, status")
        .eq("visit_id", visitId)
        .order("admitted_at", { ascending: false }),
      supabase
        .from("consent")
        .select("id, form_title, signed_at, signer_name")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false }),
      supabase.from("checkup").select("id, checked_on, sent_at").eq("visit_id", visitId).maybeSingle(),
    ]);

  // 직전 회차 — "지난 방문 대비 변화" 를 만들 재료
  const { data: prev } = await supabase
    .from("visit")
    .select("visit_date, chief_complaint, weight_kg, report_comment, report_notice")
    .eq("patient_id", patientId)
    .lt("visit_date", v.visit_date)
    .order("visit_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const drugList = drugs ?? [];
  const admissionList = admissions ?? [];
  const pat = v.patient as unknown as {
    name: string; species: string | null; breed: string | null; birth_date: string | null;
    hospital: { name: string } | null;
  } | null;
  const hospitalName = pat?.hospital?.name ?? null;
  const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
  const imageLinks = await Promise.all(
    (images ?? []).map(async (i) => ({ ...i, url: await signedUrl(i.storage_path) }))
  );
  const mediaLinks = await Promise.all(
    (mediaRows ?? []).map(async (m) => ({ ...m, url: await signedUrl(m.storage_path) }))
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">진료 회차</p>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {v.visit_date} {v.visit_no != null ? `· ${v.visit_no}회차` : ""}
            {v.closed_at ? (
              <span className="pill success">진료 종료</span>
            ) : (
              <span className="pill warning">진료 중</span>
            )}
          </h1>
        </div>
        <form action={toggleVisitClosed.bind(null, patientId, v.id, !v.closed_at)}>
          <button className={v.closed_at ? "btn btn-ghost btn-sm" : "btn btn-secondary btn-sm"}>
            {v.closed_at ? "진료 중으로 되돌리기" : "진료 종료"}
          </button>
        </form>
      </div>

      {error && (
        <p className="pill warning" style={{ padding: "10px 14px", margin: 0 }}>{error}</p>
      )}

      <div className="card">
        <div className="card-head"><h2 className="section-title">회차 정보</h2></div>
        <form action={updateVisit.bind(null, patientId, v.id)} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="날짜">
              <input type="date" name="visit_date" defaultValue={v.visit_date} className={inputClass} />
            </FormField>
            <FormField label="회차">
              <input name="visit_no" inputMode="numeric" defaultValue={v.visit_no ?? ""} className={inputClass} />
            </FormField>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span className="field-label" style={{ marginBottom: 0 }}>진료 내용</span>
              <span className="muted" style={{ fontSize: 12, flex: 1 }}>
                자유롭게 적으세요 · 보호자에게는 보이지 않습니다
              </span>
              <SoapTemplate target="note" />
            </div>
            <textarea
              name="note"
              rows={20}
              autoFocus={isNew === "1"}
              defaultValue={v.note ?? ""}
              placeholder={"예) 뒷다리 절음으로 내원. 보호자분 말로는 3일 전 산책 후부터.\nX-ray상 좌측 슬개골 내측탈구 3기 확인, 관절액 소량.\n오늘 소염 주사 후 2주 약 처방. 2주 뒤 재평가하고 수술 상담 예정."}
              className={`${inputClass} note-input`}
            />
          </div>
          <div><SubmitButton>저장</SubmitButton></div>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">보호자 리포트</h2>
          {v.report_sent_at ? (
            v.report_read_at ? (
              <span className="pill success">읽음 · {fmt(v.report_read_at)}</span>
            ) : (
              <span className="pill">발송됨 · {fmt(v.report_sent_at)}</span>
            )
          ) : (
            <span className="pill warning">미발송</span>
          )}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          <b>보호자에게는 이 코멘트만 나갑니다.</b> 위 진료 내용과 처방 상세는 보이지 않습니다.
          어떤 문제로 왔고 · 어떤 검사를 했고 · 어떤 치료를 받았는지를 적어주세요.
        </p>
        <form action={saveVisitReport.bind(null, patientId, v.id)} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 12 }}>
            <FormField label="주 증상 (C.C.) · 리포트 제목이 됩니다">
              <input
                name="chief_complaint"
                defaultValue={v.chief_complaint ?? ""}
                placeholder="예) 보행 시 균형 불균형 및 안구 진탕"
                className={inputClass}
              />
            </FormField>
            <FormField label="체중 (kg)">
              <input
                name="weight_kg"
                inputMode="decimal"
                defaultValue={v.weight_kg ?? ""}
                placeholder="6.36"
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="담당의 코멘트 · 한 줄에 하나씩 쓰면 항목으로 나갑니다">
            <textarea
              name="comment"
              rows={5}
              data-grow
              defaultValue={v.report_comment ?? ""}
              placeholder={"예)\n보행 시 균형을 잡지 못하는 증상이 있어요\n눈이 왔다 갔다 하는 안구 진탕 증상이 있어요\n타 병원에서 항경련제를 처방받은 과거력이 있어요"}
              className={inputClass}
            />
          </FormField>
          <FormField label="추가 안내 사항 (선택)">
            <textarea
              name="report_notice"
              rows={2}
              data-grow
              defaultValue={v.report_notice ?? ""}
              placeholder="예) 당분간 계단과 미끄러운 바닥은 피해주세요. 증상이 심해지면 바로 연락 주세요."
              className={inputClass}
            />
          </FormField>
          <div style={{ display: "flex", gap: 8 }}>
            <SubmitButton>임시 저장</SubmitButton>
            {pat && (
              <OwnerPreview
                patient={pat}
                visitDate={v.visit_date}
                prev={prev ?? null}
                alreadySent={!!v.report_sent_at}
              />
            )}
          </div>
        </form>
      </div>

      {hospitalName && (
        <div className="card">
          <div className="card-head">
            <h2 className="section-title">1차 병원 회신 · 환송</h2>
            {v.referred_back_at ? (
              <span className="pill success">환송 완료 · {fmt(v.referred_back_at)}</span>
            ) : (
              <span className="pill warning">미환송</span>
            )}
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            <b>{hospitalName}</b> 원장님께 보내는 소견입니다. 진료 원문·처방을 포함해 전부 열람하실 수 있고,
            여기 적는 내용은 그 위에 붙는 <b>회신 요약</b>입니다.
          </p>
          <form action={referBack.bind(null, patientId, v.id)} style={{ display: "grid", gap: 12 }}>
            <FormField label="회신 소견">
              <textarea
                name="referral_note"
                rows={5}
                data-grow
                defaultValue={v.referral_note ?? ""}
                placeholder="예) 슬개골 3기로 확인되어 교정술 시행했습니다. 경과 양호하며 2주 뒤 실밥 제거 부탁드립니다. 재활은 4주차부터 권장합니다."
                className={inputClass}
              />
            </FormField>
            <div style={{ display: "flex", gap: 8 }}>
              <button formAction={saveReferralDraft.bind(null, patientId, v.id)} className="btn btn-secondary">
                임시 저장
              </button>
              <SubmitButton>{v.referred_back_at ? "회신 다시 보내기" : "환송하기"}</SubmitButton>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">동의서</h2>
          <span className="pill muted">{(consents ?? []).length}건</span>
        </div>
        <DataTable
          headers={["양식", "상태", "서명자", ""]}
          empty="발행한 동의서가 없습니다."
          rows={(consents ?? []).map((c) => [
            c.form_title,
            c.signed_at ? (
              <span key="s" className="pill success">서명 완료</span>
            ) : (
              <span key="s" className="pill warning">서명 대기</span>
            ),
            c.signer_name ?? "-",
            <Link key="o" href={`/patients/${patientId}/c/${c.id}`} className="link-btn">
              {c.signed_at ? "열기 →" : "서명받기 →"}
            </Link>,
          ])}
        />
        <ConsentIssue patientId={patientId} visitId={v.id} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">건강검진</h2>
          {checkup && (
            checkup.sent_at
              ? <span className="pill success">발송됨</span>
              : <span className="pill warning">미발송</span>
          )}
        </div>
        {checkup ? (
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span>{checkup.checked_on} 검진</span>
            <Link href={`/patients/${patientId}/k/${checkup.id}`} className="link-btn">열기 →</Link>
          </p>
        ) : (
          <form action={createCheckup.bind(null, patientId, v.id)}>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              이 회차에 검진 기록이 없습니다.
            </p>
            <button className="btn btn-secondary btn-sm">+ 건강검진 결과 입력</button>
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">입원</h2>
          <span className="pill muted">{admissionList.length}건</span>
        </div>
        <DataTable
          headers={["입원일", "퇴원일", "상태", ""]}
          empty="이 회차에 입원 기록이 없습니다."
          rows={admissionList.map((a) => [
            a.admitted_at,
            a.discharged_at ?? "-",
            a.status === "admitted" ? (
              <span key="s" className="pill warning">입원중</span>
            ) : (
              <span key="s" className="pill success">퇴원</span>
            ),
            <Link key="o" href={`/patients/${patientId}/a/${a.id}`} className="link-btn">열기 →</Link>,
          ])}
        />
        <details style={{ marginTop: 12 }}>
          <summary><span className="btn btn-secondary btn-sm">+ 입원 시작</span></summary>
          <form
            action={createAdmission.bind(null, patientId, v.id)}
            style={{ display: "grid", gap: 12, maxWidth: 460, marginTop: 12 }}
          >
            <FormField label="입원일"><input type="date" name="admitted_at" className={inputClass} /></FormField>
            <FormField label="비고"><input name="note" className={inputClass} /></FormField>
            <SubmitButton>입원 시작</SubmitButton>
          </form>
        </details>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">처방</h2>
          <span className="pill muted">{(rxs ?? []).length}건</span>
        </div>
        {(rxs ?? []).length === 0 ? (
          <div className="empty-state">처방이 없습니다.</div>
        ) : (
          <div>
            <div className="row-head rx-row" style={{ borderBottom: "1px solid var(--line)" }}>
              <span>약품</span><span>용량</span><span>용법</span><span>기간</span><span></span><span></span>
            </div>
            {(rxs ?? []).map((r) => (
              <form key={r.id} action={updatePrescription.bind(null, patientId, v.id, r.id)} className="rx-row">
                <select name="drug_id" defaultValue={r.drug_id} className={inputClass}>
                  {drugList.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <input name="dose" defaultValue={r.dose ?? ""} placeholder="용량" className={inputClass} />
                <input name="frequency" defaultValue={r.frequency ?? ""} placeholder="용법" className={inputClass} />
                <input name="duration" defaultValue={r.duration ?? ""} placeholder="기간" className={inputClass} />
                <button className="btn btn-secondary btn-sm">저장</button>
                <button formAction={deletePrescription.bind(null, patientId, v.id, r.id)} className="btn btn-danger btn-sm">삭제</button>
              </form>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: ".85rem", color: "var(--muted)" }}>처방 추가</p>
          <PrescriptionForm patientId={patientId} visitId={v.id} drugs={drugList} />
        </div>
      </div>

      <div className="quickadd-grid">
        <div className="card">
          <div className="card-head">
            <h2 className="section-title">의료영상</h2>
            {/* ⚠️ 보호자에게는 **기본으로 안 나간다**(원장님 요구). 여기서 눌러야 열린다.
                요청이 없어도 누를 수 있다 — 진료 중에 "보여드릴게요"가 되는 경우가 있다. */}
            {imgReq?.approved_at ? (
              <span className="pill success">보호자에게 공개됨</span>
            ) : (
              <form action={approveImages.bind(null, patientId, v.id)}>
                <button className={imgReq ? "btn-primary" : "link-btn"}>
                  {imgReq ? "보호자 요청 있음 · 보내기" : "보호자에게 보내기"}
                </button>
              </form>
            )}
          </div>
          <ul style={{ display: "grid", gap: 6, fontSize: ".9rem", listStyle: "none", padding: 0, margin: 0 }}>
            {imageLinks.map((i) => (
              <li key={i.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="pill muted" style={{ textTransform: "uppercase" }}>{i.modality}</span>
                {i.url ? <a href={i.url} target="_blank" className="link-btn">{i.file_name}</a> : i.file_name}
                <form action={deleteFile.bind(null, patientId, v.id, "medical_image", i.id, i.storage_path)}>
                  <button className="link-btn danger">삭제</button>
                </form>
              </li>
            ))}
            {imageLinks.length === 0 && <li style={{ color: "var(--muted)" }}>없음</li>}
          </ul>
          <ImageUpload patientId={patientId} visitId={v.id} />
        </div>

        <div className="card">
          <div className="card-head"><h2 className="section-title">사진 / 영상</h2></div>
          <ul style={{ display: "grid", gap: 6, fontSize: ".9rem", listStyle: "none", padding: 0, margin: 0 }}>
            {mediaLinks.map((m) => (
              <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--muted)" }}>{m.kind ?? "-"}</span>
                {m.url ? <a href={m.url} target="_blank" className="link-btn">{m.file_name}</a> : m.file_name}
                <form action={deleteFile.bind(null, patientId, v.id, "media", m.id, m.storage_path)}>
                  <button className="link-btn danger">삭제</button>
                </form>
              </li>
            ))}
            {mediaLinks.length === 0 && <li style={{ color: "var(--muted)" }}>없음</li>}
          </ul>
          <MediaUpload patientId={patientId} visitId={v.id} />
        </div>
      </div>
    </div>
  );
}
