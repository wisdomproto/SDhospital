"use client";

/**
 * 진료 내용은 **그냥 자유 노트**다. 형식은 없다.
 *
 * 수의사들에게 물어보니 SOAP 를 실제로는 잘 안 쓴다고 한다 — 불편하다는 것이다.
 * 그래서 틀은 기본값이 아니라 **접어 둔 선택지**로 둔다. 라벨 옆에 버튼이 붙어 있으면
 * 그게 곧 "이렇게 쓰라"는 말이 되고, 안 쓰는 사람은 매번 그 버튼을 지나쳐야 한다.
 *
 * 틀이 필요한 사람은 있다(전공의·인턴, 복잡한 케이스). 없애지 않고 숨긴다.
 */
const SOAP = "S> \nO> \nA> \nP> ";

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
- `;

/**
 * 이 블록만 따로 넣을 수 있게 뒀다. 진료 기록이 아니라 **다음 진료의 재료**라
 * SOAP 를 안 쓰는 사람에게도 쓸모가 있다 — 보호자가 뭘 걱정했는지는 적어두지 않으면 사라진다.
 */
const OWNER_TALK = `====== 보호자 커뮤니케이션 ======
[ 보호자 주요 걱정/요청 ]
-
[ 수의사 주요 안내 ]
-
[ 보호자 질문 ]
-
[ 추후 확인/결정 필요 ]
- `;

function insert(target: string, text: string) {
  const el = document.querySelector<HTMLTextAreaElement>(`textarea[name="${target}"]`);
  if (!el) return;
  const cur = el.value.trim();
  el.value = cur ? `${cur}\n\n${text}` : text;
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
  // 넣고 나면 메뉴는 닫는다 — 열어둔 채로 두면 다음에 또 눈에 걸린다
  el.closest("div")?.parentElement?.querySelector("details")?.removeAttribute("open");
}

export function SoapTemplate({ target }: { target: string }) {
  return (
    <details className="tpl-menu">
      <summary>틀 넣기</summary>
      <div className="tpl-items">
        <button type="button" onClick={() => insert(target, SOAP)}>
          SOAP 네 줄 <span>S / O / A / P</span>
        </button>
        <button type="button" onClick={() => insert(target, FULL)}>
          전체 틀 <span>C.C. · SOAP 세부 · 감별진단</span>
        </button>
        <button type="button" onClick={() => insert(target, OWNER_TALK)}>
          보호자 커뮤니케이션 <span>걱정·안내·질문·추후 확인</span>
        </button>
      </div>
    </details>
  );
}
