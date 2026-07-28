"use client";

/**
 * 칸을 여러 개로 나누지 않는다 — 빈 칸을 매번 마주하면 입력이 끊긴다.
 * 누르면 본문에 형식만 깔아주고, 줄글로 쓰고 싶으면 안 누르면 된다.
 * (기존 EMR에서 복사해 붙이는 것도 그대로 된다)
 *
 * 아래 "보호자 커뮤니케이션" 블록은 진료 기록이 아니라 다음 진료의 재료다.
 * 보호자가 뭘 걱정했고 뭘 안내했는지는 적어두지 않으면 다음 회차에 사라진다.
 */
const FULL = `C.C.:

S:
- 현병력:
- 증상 발현 시기:
- 식욕/음수/배변/배뇨:
- 과거 병력:

O:
- 신체검사:
- 검사 결과:
- 활력징후:

A:
- 진단:
- 예후:

P:
- 처방:
- 추가 검사:
- 치료 지침:
- 재진:

[ 감별 진단 목록(DDx) ]
-

====== 보호자 커뮤니케이션 ======
[ 보호자 주요 걱정/요청 ]
-
[ 수의사 주요 안내 ]
-
[ 보호자 질문 ]
-
[ 추후 확인/결정 필요 ]
- `;

const SHORT = "S> \nO> \nA> \nP> ";

function insert(target: string, text: string) {
  const el = document.querySelector<HTMLTextAreaElement>(`textarea[name="${target}"]`);
  if (!el) return;
  const cur = el.value.trim();
  el.value = cur ? `${cur}\n\n${text}` : text;
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
}

export function SoapTemplate({ target }: { target: string }) {
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        title="S(주관적) / O(객관적) / A(평가) / P(계획) 네 줄만 넣습니다"
        onClick={() => insert(target, SHORT)}
      >
        + SOAP 틀
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        title="C.C. · SOAP 세부 · 감별진단(DDx) · 보호자 커뮤니케이션까지 전체 틀"
        onClick={() => insert(target, FULL)}
      >
        + 전체 틀
      </button>
    </>
  );
}
