import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

/**
 * AI 채팅 — 자리만 잡아 둔다.
 *
 * 실제로 답하는 것은 AI 가 아니라 **병원이 미리 써 둔 답변**이 될 예정이다.
 * AI 가 잘못 답하면 그 책임은 병원이 지지만, 수의사가 검수한 문장만 나가면 그 리스크가 없다.
 * 재료(원장님의 10년치 상담 기록)를 받으면 조건 매칭 FAQ로 채운다.
 *
 * 지금 이 화면이 하는 일은 하나 — **여기에 물어볼 수 있다는 걸 알리는 것**.
 * 빈 탭으로 두면 보호자는 한 번 눌러 보고 다시 안 누른다.
 */
export default async function PortalChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("patient").select("name, species").eq("id", id).single();
  if (!p) notFound();

  const samples = [
    "수술하고 나서 언제부터 산책해도 되나요?",
    "약을 먹고 토했는데 다시 먹여야 하나요?",
    "밥을 평소보다 덜 먹는데 괜찮을까요?",
    "다음 검진은 언제 받아야 하나요?",
  ];

  return (
    <>
      <div style={{ fontWeight: 800, fontSize: "1.05rem", padding: "2px 2px 4px" }}>AI 채팅</div>

      <div className="portal-card" style={{ textAlign: "center", padding: "26px 18px" }}>
        <div style={{ fontSize: 34 }} aria-hidden>💬</div>
        <div style={{ fontWeight: 800, marginTop: 8 }}>준비 중이에요</div>
        <p className="portal-tile-sub" style={{ margin: "6px 0 0" }}>
          {p.name}에 대해 궁금한 걸 여기서 바로 물어볼 수 있게 준비하고 있어요.
          <br />
          담당 선생님이 직접 검수한 답변만 보여드릴 예정이에요.
        </p>
      </div>

      <div className="portal-card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>이런 걸 물어보실 수 있어요</div>
        <div style={{ display: "grid", gap: 8 }}>
          {samples.map((q) => (
            <div key={q} className="chat-sample">
              {q}
            </div>
          ))}
        </div>
        <p className="portal-tile-sub" style={{ margin: "12px 0 0" }}>
          지금은 급한 문의는 병원으로 전화 주세요.
        </p>
      </div>
    </>
  );
}
