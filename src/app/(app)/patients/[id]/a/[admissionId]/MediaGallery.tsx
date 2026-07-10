"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { deleteAdmFile } from "./actions";

export type GalleryItem = {
  id: string;
  url: string | null;
  storagePath: string;
  label: string;
  isVideo: boolean;
  fileName: string;
};

export function MediaGallery({
  items,
  patientId,
  admissionId,
  table,
}: {
  items: GalleryItem[];
  patientId: string;
  admissionId: string;
  table: "medical_image" | "media";
}) {
  const [open, setOpen] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // horizontal wheel scroll on the thumbnail strip
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const go = useCallback(
    (dir: number) => setOpen((o) => (o === null ? o : (o + dir + items.length) % items.length)),
    [items.length]
  );
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (items.length === 0) return null;

  return (
    <>
      <div ref={stripRef} className="media-scroll">
        {items.map((it, i) => (
          <div key={it.id} style={{ display: "grid", gap: 6 }}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="media-thumb"
              title={it.fileName}
              style={{ padding: 0, border: 0, cursor: "pointer", background: "var(--surface-soft)" }}
            >
              {it.url &&
                (it.isVideo ? (
                  <video src={it.url} muted preload="metadata" />
                ) : (
                  <img src={it.url} alt={it.fileName} loading="lazy" />
                ))}
              {it.isVideo && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0, display: "grid", placeItems: "center",
                    color: "#fff", fontSize: 26, textShadow: "0 1px 6px rgba(0,0,0,.6)", pointerEvents: "none",
                  }}
                >
                  ▶
                </span>
              )}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="pill muted" style={{ textTransform: "uppercase" }}>{it.label}</span>
              <form action={deleteAdmFile.bind(null, patientId, admissionId, table, it.id, it.storagePath)} style={{ marginLeft: "auto" }}>
                <button className="link-btn danger" style={{ fontSize: ".76rem" }}>삭제</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      {open !== null && items[open] && (
        <Lightbox item={items[open]} index={open} total={items.length} onClose={() => setOpen(null)} onNav={go} />
      )}
    </>
  );
}

function Lightbox({
  item, index, total, onClose, onNav,
}: {
  item: GalleryItem; index: number; total: number; onClose: () => void; onNav: (d: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scrubbing, setScrubbing] = useState(false);

  // wheel over video → scrub frame-by-frame (cine)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item.isVideo) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      v.pause();
      setScrubbing(true);
      const dur = v.duration || 0;
      const step = 1 / 30; // ~1 frame
      const next = v.currentTime + (e.deltaY > 0 ? step : -step);
      v.currentTime = Math.min(dur - 0.001, Math.max(0, next));
    };
    v.addEventListener("wheel", onWheel, { passive: false });
    return () => v.removeEventListener("wheel", onWheel);
  }, [item.isVideo, item.id]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(8,14,20,.9)",
        display: "grid", placeItems: "center", padding: 24,
      }}
    >
      {/* top bar */}
      <div style={{ position: "absolute", top: 14, left: 18, right: 18, display: "flex", alignItems: "center", gap: 10, color: "#fff" }} onClick={(e) => e.stopPropagation()}>
        <span style={{ fontWeight: 600, fontSize: ".9rem" }}>{item.label.toUpperCase()} · {item.fileName}</span>
        <span style={{ fontSize: ".8rem", opacity: 0.7 }}>{index + 1} / {total}</span>
        {item.isVideo && (
          <span style={{ marginLeft: 12, fontSize: ".78rem", opacity: 0.8 }}>
            휠로 프레임 넘기기 {scrubbing ? "· 스크럽 중" : ""}
          </span>
        )}
        <a href={item.url ?? "#"} target="_blank" style={{ marginLeft: "auto", color: "#cfe9e4", fontSize: ".8rem" }} onClick={(e) => e.stopPropagation()}>원본 열기 ↗</a>
        <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,.12)", color: "#fff", border: 0, borderRadius: 10, width: 34, height: 34, cursor: "pointer" }}>✕</button>
      </div>

      {/* prev / next */}
      {total > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); onNav(-1); }} style={navBtn("left")}>‹</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onNav(1); }} style={navBtn("right")}>›</button>
        </>
      )}

      {/* media */}
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "min(1100px, 92vw)", maxHeight: "82vh", display: "grid", placeItems: "center" }}>
        {item.url && (item.isVideo ? (
          <video
            ref={videoRef}
            src={item.url}
            controls
            autoPlay
            loop
            style={{ maxWidth: "100%", maxHeight: "82vh", borderRadius: 8, background: "#000" }}
          />
        ) : (
          <img src={item.url} alt={item.fileName} style={{ maxWidth: "100%", maxHeight: "82vh", borderRadius: 8 }} />
        ))}
      </div>
    </div>
  );
}

function navBtn(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute", top: "50%", transform: "translateY(-50%)", [side]: 12,
    width: 46, height: 46, borderRadius: "50%", border: 0, cursor: "pointer",
    background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 26, lineHeight: 1,
  } as React.CSSProperties;
}
