import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { kstToday } from "@/lib/worklist";
import { createNotice, deleteNotice, togglePinned } from "./actions";

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const today = kstToday();
  const { data: notices } = await supabase
    .from("notice")
    .select("id, title, body, link_url, coupon_label, starts_on, ends_on, pinned")
    .order("pinned", { ascending: false })
    .order("starts_on", { ascending: false });

  const live = (n: { starts_on: string; ends_on: string | null }) =>
    n.starts_on <= today && (!n.ends_on || n.ends_on >= today);

  return (
    <div style={{ maxWidth: 880, display: "grid", gap: 20 }}>
      <div>
        <p className="eyebrow">Notices</p>
        <h1 className="page-title">병원 소식</h1>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: ".88rem" }}>
          보호자 앱 첫 화면에 뜹니다. <b>진료가 없는 달에도 앱을 열 이유</b>를 만드는 자리입니다 —
          검진 시즌·예방접종 안내·이벤트.
        </p>
      </div>

      {error && <p className="pill warning" style={{ padding: "10px 14px", margin: 0 }}>{error}</p>}

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">등록된 소식</h2>
          <span className="pill muted">{(notices ?? []).length}건</span>
        </div>
        <DataTable
          headers={["제목", "기간", "상태", ""]}
          empty="등록된 소식이 없습니다."
          rows={(notices ?? []).map((n) => [
            <span key="t" style={{ display: "grid", gap: 2 }}>
              <b>
                {n.pinned && "📌 "}
                {n.coupon_label && "🎟 "}
                {n.title}
              </b>
              <span className="muted" style={{ fontSize: ".8rem" }}>
                {(n.body ?? "").slice(0, 46) || "-"}
              </span>
            </span>,
            <span key="d" style={{ whiteSpace: "nowrap" }}>
              {n.starts_on} ~ {n.ends_on ?? "계속"}
            </span>,
            live(n) ? (
              <span key="s" className="pill success">노출 중</span>
            ) : n.starts_on > today ? (
              <span key="s" className="pill">예약됨</span>
            ) : (
              <span key="s" className="pill muted">종료</span>
            ),
            <span key="a" style={{ display: "flex", gap: 8 }}>
              <form action={togglePinned.bind(null, n.id, !n.pinned)}>
                <button className="link-btn">{n.pinned ? "고정 해제" : "위로 고정"}</button>
              </form>
              <form action={deleteNotice.bind(null, n.id)}>
                <button className="link-btn danger">삭제</button>
              </form>
            </span>,
          ])}
        />
      </div>

      <div className="card">
        <div className="card-head"><h2 className="section-title">소식 추가</h2></div>
        <form action={createNotice} style={{ display: "grid", gap: 12 }}>
          <FormField label="제목">
            <input name="title" required placeholder="예) 8월 심장사상충 예방 캠페인" className={inputClass} />
          </FormField>
          <FormField label="내용">
            <textarea
              name="body"
              rows={3}
              data-grow
              placeholder="예) 8월 한 달간 심장사상충 검사비를 지원합니다. 예방약 3개월분 구매 시 1개월분을 더 드려요."
              className={inputClass}
            />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="시작일">
              <input type="date" name="starts_on" defaultValue={today} className={inputClass} />
            </FormField>
            <FormField label="종료일 · 비우면 계속 노출">
              <input type="date" name="ends_on" className={inputClass} />
            </FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <FormField label="링크 (선택)">
              <input name="link_url" placeholder="https://" className={inputClass} />
            </FormField>
            <FormField label="링크 버튼 문구">
              <input name="link_label" placeholder="자세히 보기" className={inputClass} />
            </FormField>
          </div>
          <FormField label="쿠폰 문구 (선택) · 적으면 쿠폰 카드로 나갑니다">
            <input name="coupon_label" placeholder="예) 건강검진 20% 할인" className={inputClass} />
          </FormField>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".88rem" }}>
            <input type="checkbox" name="pinned" value="1" style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
            맨 위에 고정
          </label>
          <div><SubmitButton>등록</SubmitButton></div>
        </form>
        <p className="muted" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
          종료일이 지나면 <b>보호자 화면에서 자동으로 사라집니다.</b> 내리는 걸 사람이 기억해야 하는 구조는 반드시 실패합니다.
          <br />
          쿠폰은 <b>코드도 사용 처리도 없습니다</b> — 보호자가 앱 화면을 보여주면 접수에서 눈으로 확인하시면 됩니다.
        </p>
      </div>
    </div>
  );
}
