import type { MetadataRoute } from "next";

/**
 * 보호자 앱을 홈 화면에 설치할 수 있게 한다.
 * 알림이 붙기 전까지는 홈 화면 아이콘이 유일한 재방문 통로다 —
 * 아이콘이 없으면 두 번째 방문이 일어나지 않는다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SD동물의료센터",
    short_name: "SD동물병원",
    description: "우리 아이의 진료 기록과 입원 경과를 확인하세요.",
    lang: "ko",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eef2f7",
    theme_color: "#0f9b8e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
