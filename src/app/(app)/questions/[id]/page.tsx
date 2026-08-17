import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AnswerBox } from "./AnswerBox";
import { sendVetAnswer } from "./actions";

/**
 * 채팅이 넘긴 질문 하나에 답하는 화면.
 *
 * 여기 있는 것은 셋뿐이다 — **보호자가 물은 말 / 그 아이의 최근 기록 / 답 쓰는 칸.**
 * 진료 화면을 여기로 옮겨 오지 않는다. 더 봐야 하면 차트로 넘어가면 된다.
 */
const petEmoji = (s: string | null) => (s === "고양이" ? "🐱" : "🐶");

export default async function AnswerQuestion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: q } = await supabase
    .from("chat_pending")
    .select("id, patient_id, thread_id, question, holding_reply, asked_at, patient_name, patient_species")
    .eq("id", id)
    .maybeSingle();
  // 다른 사람이 이미 답했으면 목록에서 사라진다 — 그때 여기로 들어오면 알려 준다
  if (!q) {
    return (
      <div className="card">
        <div className="empty-state">
          이미 답변이 나갔거나 없는 질문입니다.
          <br />
          <Link href="/today">오늘 할 일로 돌아가기</Link>
        </div>
      </div>
    );
  }

  // 답을 쓰려면 이 아이가 어떤 아이인지는 봐야 한다. 최근 회차와 이 대화 전부.
  const [{ data: visits }, { data: thread }] = await Promise.all([
    supabase
      .from("visit")
      .select("id, visit_date, chief_complaint")
      .eq("patient_id", q.patient_id)
      .order("visit_date", { ascending: false })
      .limit(4),
    supabase
      .from("chat_message")
      .select("role, content, model, created_at")
      .eq("thread_id", q.thread_id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 760 }}>
      <div>
        <p className="eyebrow">보호자가 답을 기다리는 질문</p>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.6rem" }}>{petEmoji(q.patient_species)}</span>
          <Link href={`/patients/${q.patient_id}`} style={{ color: "inherit" }}>
            {q.patient_name}
          </Link>
          <span className="pill warning">
            {new Date(q.asked_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
          </span>
        </h1>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "#e2b4b4", color: "#a33" }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">주고받은 대화</h2>
        </div>
        <div className="chat-log" style={{ maxHeight: "none" }}>
          {(thread ?? []).map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              {m.content}
              {m.model === "staff" && (
                <span style={{ display: "block", fontSize: ".72rem", opacity: 0.7 }}>직원 답변</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="section-title">최근 진료</h2>
        </div>
        {(visits ?? []).length === 0 ? (
          <div className="empty-state">기록된 회차가 없습니다.</div>
        ) : (
          <div style={{ display: "grid" }}>
            {(visits ?? []).map((v) => (
              <Link
                key={v.id}
                href={`/patients/${q.patient_id}/v/${v.id}`}
                style={{
                  padding: "10px 4px",
                  borderBottom: "1px solid var(--line)",
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  gap: 12,
                }}
              >
                <b style={{ minWidth: 92 }}>{v.visit_date}</b>
                <span style={{ color: "var(--muted)" }}>{v.chief_complaint ?? "-"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <form action={sendVetAnswer} className="card" style={{ display: "grid", gap: 12 }}>
        <input type="hidden" name="questionId" value={q.id} />
        <input type="hidden" name="patientId" value={q.patient_id} />
        <input type="hidden" name="threadId" value={q.thread_id} />
        <div className="card-head">
          <h2 className="section-title">답변</h2>
        </div>
        <AnswerBox />
        <Link href="/today" className="btn" style={{ justifySelf: "start" }}>
          나중에
        </Link>
      </form>
    </div>
  );
}
