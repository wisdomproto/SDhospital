"use client";
import { useEffect, useRef, useState } from "react";
import { isVideoFile, isImageFile } from "@/lib/media";

export type SignedFile = {
  id: string;
  file_name: string | null;
  storage_path: string;
  modality?: string | null;
  kind?: string | null;
  url: string | null;
  /** 보호자는 가벼운 사본을 보고, 필요할 때만 원본을 받는다 (의료영상 전용) */
  originalUrl?: string | null;
};

const label = (f: SignedFile) => (f.modality ? f.modality.toUpperCase() : f.kind ?? "");

/**
 * 사진·영상 보기.
 *
 * 예전에는 썸네일을 새 탭(`target="_blank"`)으로 열었다. 홈 화면에 설치한 앱에는
 * **주소창도 뒤로가기도 없어서 돌아올 방법이 없었다** — 앱을 껐다 켜야 했다.
 * 그래서 앱 안에서 열고 닫는 뷰어를 둔다.
 *
 * 초음파·X-ray 는 작게 보면 아무것도 안 보인다. 화면에 꽉 채우고, 두 배로 키워
 * 끌어서 볼 수 있어야 한다 — 보호자가 "이게 뭔지" 물어볼 수 있는 최소 조건이다.
 */
export function MediaGrid({ files }: { files: SignedFile[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [at, setAt] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  // 확대해서 볼 수 있는 것만 뷰어에 넣는다 (동영상은 자체 컨트롤이 있다)
  const viewable = files.filter((f) => f.url && isImageFile(f.file_name));

  const reset = () => {
    setZoom(false);
    setPan({ x: 0, y: 0 });
  };

  const open = (id: string) => {
    const i = viewable.findIndex((f) => f.id === id);
    if (i < 0) return;
    setAt(i);
    reset();
    dialog.current?.showModal();
  };

  const step = (d: number) => {
    setAt((cur) => (cur == null ? cur : (cur + d + viewable.length) % viewable.length));
    reset();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!dialog.current?.open) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewable.length]);

  const cur = at != null ? viewable[at] : null;

  if (files.length === 0)
    return <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: 0 }}>없음</p>;

  return (
    <>
      <div className="media-grid2">
        {files.map((f) => {
          const tag = label(f);
          if (f.url && isVideoFile(f.file_name)) {
            return (
              <div key={f.id}>
                <video className="media-thumb" src={f.url} controls preload="metadata" />
                {tag && <div className="portal-tile-sub" style={{ marginTop: 4 }}>{tag}</div>}
              </div>
            );
          }
          if (f.url && isImageFile(f.file_name)) {
            return (
              <div key={f.id}>
                <button type="button" className="media-thumb media-open" onClick={() => open(f.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.file_name ?? ""} />
                  <span className="media-zoom" aria-hidden>⤢</span>
                </button>
                {tag && <div className="portal-tile-sub" style={{ marginTop: 4 }}>{tag}</div>}
              </div>
            );
          }
          return (
            <a key={f.id} href={f.url ?? "#"} target="_blank" className="portal-tile" style={{ padding: 10 }}>
              <span className="pill muted">{tag || "파일"}</span>
              <span style={{ fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.file_name}
              </span>
            </a>
          );
        })}
      </div>

      <dialog ref={dialog} className="viewer" onClose={() => setAt(null)}>
        {cur && (
          <>
            <div className="viewer-top">
              <span className="viewer-title">
                {label(cur) && <b>{label(cur)} </b>}
                {cur.file_name}
              </span>
              <button
                type="button"
                className="viewer-close"
                aria-label="닫기"
                onClick={() => dialog.current?.close()}
              >
                ✕
              </button>
            </div>

            <div
              className={`viewer-stage${zoom ? " zoomed" : ""}`}
              onDoubleClick={() => {
                setZoom((z) => !z);
                setPan({ x: 0, y: 0 });
              }}
              onPointerDown={(e) => {
                if (!zoom) return;
                drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cur.url ?? ""}
                alt={cur.file_name ?? ""}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom ? 2.5 : 1})` }}
                draggable={false}
              />
            </div>

            <div className="viewer-bottom">
              <button type="button" onClick={() => step(-1)} disabled={viewable.length < 2} aria-label="이전">
                ‹
              </button>
              <span className="viewer-count">
                {(at ?? 0) + 1} / {viewable.length}
              </span>
              <button type="button" onClick={() => step(1)} disabled={viewable.length < 2} aria-label="다음">
                ›
              </button>
              <button
                type="button"
                className="viewer-zoom"
                onClick={() => {
                  setZoom((z) => !z);
                  setPan({ x: 0, y: 0 });
                }}
              >
                {zoom ? "축소" : "크게 보기"}
              </button>
              {cur.originalUrl && (
                <a href={cur.originalUrl} target="_blank" rel="noreferrer" download className="viewer-orig">
                  원본 받기
                </a>
              )}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
