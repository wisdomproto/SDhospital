"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 손가락·스타일러스·마우스로 서명을 받는다.
 * 포인터 이벤트라 세 가지가 같은 코드로 동작하고, 라이브러리가 필요 없다.
 *
 * 결과는 투명 배경 PNG data URL 로 hidden input 에 담겨 폼과 함께 제출된다.
 */
export function SignaturePad({ name = "signature" }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 레티나에서 뭉개지지 않게 실제 픽셀로 맞춘다
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault(); // 서명 중 화면이 스크롤되지 않게
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    const hidden = hiddenRef.current;
    if (canvas && hidden) hidden.value = canvas.toDataURL("image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (hiddenRef.current) hiddenRef.current.value = "";
    setHasInk(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: ".88rem" }}>보호자 서명</span>
        {hasInk && (
          <button type="button" onClick={clear} className="sign-clear">
            지우고 다시
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="sign-pad"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      {!hasInk && <div className="sign-hint">여기에 손으로 서명해 주세요</div>}
      <input ref={hiddenRef} type="hidden" name={name} />
    </div>
  );
}
