import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SDhospital EMR",
  description: "2차 동물병원 EMR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/*
          Pretendard — 한국어 UI 표준. IBM Plex Sans KR 은 한글 획이 얇고 자간이 넓어
          본문이 흐릿하고 정돈이 안 돼 보인다. dynamic-subset 은 쓰인 글자만 받아 가볍다.
        */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
