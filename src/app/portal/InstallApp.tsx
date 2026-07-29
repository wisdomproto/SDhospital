"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "sd-install-dismissed";

/**
 * 서비스 워커 등록 + 홈 화면 추가.
 *
 * 안드로이드는 브라우저가 설치 프롬프트를 주지만, iOS 사파리는 주지 않는다.
 * iOS 보호자가 훨씬 많으므로 "공유 → 홈 화면에 추가" 안내를 직접 띄운다.
 *
 * 화면 아래 배너로 띄우면 하단 탭을 가린다 — 늘 떠 있어야 하는 것을 임시 안내가 덮는 꼴이다.
 * **설치는 알림 도달률과 직결되므로 숨기지도 않는다.** 그래서 헤더에 작은 버튼으로 둔다.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // 이미 홈 화면에서 실행 중이면 아무것도 띄우지 않는다
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS 사파리에는 beforeinstallprompt 가 없다 — 직접 안내한다
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) {
      setShowIosHint(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setPrompt(null);
    setShowIosHint(false);
  };

  if (!prompt && !showIosHint) return null;

  return (
    <>
      <button
        type="button"
        className="install-chip"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice;
            dismiss();
            return;
          }
          setShowIosSheet(true); // iOS 는 프롬프트가 없어 방법을 알려주는 수밖에 없다
        }}
      >
        <span aria-hidden>＋</span> 홈에 추가
      </button>

      {showIosSheet && (
        <div className="ios-hint" role="dialog" onClick={() => setShowIosSheet(false)}>
          <div className="ios-hint-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>홈 화면에 추가하는 방법</div>
            <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: ".9rem", lineHeight: 1.6 }}>
              <li>아래 <b>공유</b> 버튼을 누르세요</li>
              <li><b>홈 화면에 추가</b>를 선택하세요</li>
            </ol>
            <p className="portal-tile-sub" style={{ margin: "10px 0 0" }}>
              추가하면 알림도 받을 수 있어요.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
                다시 보지 않기
              </button>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowIosSheet(false)}>
                알겠어요
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
