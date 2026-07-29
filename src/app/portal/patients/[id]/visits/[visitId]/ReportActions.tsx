"use client";

// 저장·공유는 브라우저가 이미 해주는 일이다.
// PDF 라이브러리를 넣지 않는다 — 인쇄 대화상자의 "PDF로 저장"이 그 기능이다.
export function ReportActions({ title }: { title: string }) {
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // 사용자가 취소한 경우 — 아무것도 하지 않는다
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    alert("링크를 복사했습니다.");
  };

  return (
    <div className="no-print" style={{ display: "flex", gap: 8 }}>
      <button type="button" onClick={() => window.print()} className="portal-action">
        📄 PDF로 저장
      </button>
      <button type="button" onClick={share} className="portal-action">
        🔗 공유
      </button>
    </div>
  );
}
