"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "sd-install-dismissed";

/**
 * 서비스 워커 등록 + 홈 화면 추가 안내.
 *
 * 안드로이드는 브라우저가 설치 프롬프트를 주지만, iOS 사파리는 주지 않는다.
 * iOS 보호자가 훨씬 많으므로 "공유 → 홈 화면에 추가" 안내를 직접 띄운다.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

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
    <div className="install-banner">
      <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>🐾</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: ".9rem" }}>홈 화면에 추가하기</div>
        <div style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 2 }}>
          {prompt ? "앱처럼 바로 열 수 있습니다" : "공유 → 홈 화면에 추가"}
        </div>
      </div>
      {prompt && (
        <button
          className="install-btn"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice;
            dismiss();
          }}
        >
          추가
        </button>
      )}
      <button onClick={dismiss} className="install-close" aria-label="닫기">
        ✕
      </button>
    </div>
  );
}
