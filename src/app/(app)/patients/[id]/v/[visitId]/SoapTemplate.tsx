"use client";

const SOAP = "S> \nO> \nA> \nP> ";

/**
 * 칸을 네 개로 나누지 않는다 — 빈 칸 세 개를 매번 마주하면 입력이 끊긴다.
 * 누르면 본문에 형식만 깔아주고, 줄글로 쓰고 싶으면 안 누르면 된다.
 * (기존 EMR에서 복사해 붙이는 것도 그대로 된다)
 */
export function SoapTemplate({ target }: { target: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      title="S(주관적) / O(객관적) / A(평가) / P(계획) 틀을 넣습니다"
      onClick={() => {
        const el = document.querySelector<HTMLTextAreaElement>(`textarea[name="${target}"]`);
        if (!el) return;
        const cur = el.value.trim();
        el.value = cur ? `${cur}\n\n${SOAP}` : SOAP;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }}
    >
      + SOAP 틀
    </button>
  );
}
