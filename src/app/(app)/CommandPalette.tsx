"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchPatients, startVisit, type Hit } from "./search-actions";

type Mode = "search" | "visit";

/**
 * ⌘K 검색. 상단 바에 검색창을 그려놓고 실제로는 환자 목록으로만 보내던 것을 대체한다.
 *
 * "진료 입력"도 같은 창을 쓴다 — 진료를 넣으려면 어차피 환자를 먼저 골라야 하고,
 * 고르는 방법이 화면마다 다르면 그때부터 외울 게 생긴다.
 */
export function CommandPalette() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const open = (m: Mode) => {
    setMode(m);
    setQ("");
    setCursor(0);
    dialog.current?.showModal();
    // showModal 직후에 포커스를 줘야 모바일 키보드도 같이 올라온다
    requestAnimationFrame(() => input.current?.focus());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open("search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 입력이 멈춘 뒤에 찾는다 — 글자마다 서버를 때리면 순서가 뒤엉킨다
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchPatients(q)
        .then((r) => alive && (setHits(r), setCursor(0)))
        .finally(() => alive && setLoading(false));
    }, 160);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const choose = (hit: Hit) => {
    dialog.current?.close();
    if (mode === "visit") startTransition(() => startVisit(hit.id));
    else router.push(`/patients/${hit.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && hits[cursor]) {
      e.preventDefault();
      choose(hits[cursor]);
    }
  };

  return (
    <>
      <button type="button" className="topbar-search" onClick={() => open("search")} aria-label="검색">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" />
        </svg>
        <span className="ph">환자 · 보호자 · 차트 검색</span>
        <span className="kbd">⌘K</span>
      </button>

      <button type="button" className="btn btn-primary btn-sm" onClick={() => open("visit")} disabled={pending}>
        {pending ? "여는 중…" : "＋ 진료 입력"}
      </button>

      <dialog ref={dialog} className="cmdk" onClose={() => setQ("")}>
        <div className="cmdk-input">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={mode === "visit" ? "진료를 입력할 환자를 찾으세요" : "이름 · 차트번호 · 품종 · 보호자"}
            aria-label="환자 검색"
          />
          {mode === "visit" && <span className="pill">진료 입력</span>}
        </div>

        <div className="cmdk-list">
          {hits.length === 0 && !loading && (
            <p className="muted" style={{ padding: "18px 16px", margin: 0, fontSize: ".88rem" }}>
              {q ? "일치하는 환자가 없습니다." : "환자를 검색하세요."}
            </p>
          )}
          {hits.map((h, i) => (
            <button
              key={h.id}
              type="button"
              className={`cmdk-item${i === cursor ? " active" : ""}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(h)}
            >
              <span className="avatar-chip">{h.species === "고양이" ? "🐱" : "🐶"}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 700 }}>{h.name}</span>
                <span className="muted" style={{ fontSize: ".8rem", marginLeft: 8 }}>
                  {[h.chart_no, [h.species, h.breed].filter(Boolean).join(" / "), h.owner && `보호자 ${h.owner}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {h.admitted && <span className="pill warning">입원중</span>}
            </button>
          ))}
        </div>

        <div className="cmdk-foot">
          <span>↑↓ 이동 · Enter 선택 · Esc 닫기</span>
          {mode === "visit" && <span>고르면 오늘 날짜로 회차가 생깁니다</span>}
        </div>
      </dialog>
    </>
  );
}
