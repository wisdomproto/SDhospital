"use client";
import { useState } from "react";
import { shrinkImage, setInputFiles, formatBytes } from "@/lib/image";

/**
 * 카메라를 바로 연다. capture="environment" 는 폰에서 후면 카메라를 띄우는 표준 속성이라
 * 앨범을 뒤지는 단계가 없다. 데스크탑에서는 그냥 파일 선택으로 동작한다.
 */
export function PhotoPicker() {
  const [names, setNames] = useState<string[]>([]);
  const [size, setSize] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <label className="ward-shot">
      <input
        type="file"
        name="photos"
        accept="image/*"
        capture="environment"
        multiple
        onChange={async (e) => {
          const input = e.currentTarget;
          const picked = Array.from(input.files ?? []);
          if (picked.length === 0) return setNames([]);
          setBusy(true);
          // 폰 사진은 4MB쯤 된다 — 올리기 전에 줄여야 병동 와이파이에서 안 막힌다
          const shrunk = await Promise.all(picked.map((f) => shrinkImage(f)));
          setInputFiles(input, shrunk);
          setNames(shrunk.map((f) => f.name));
          setSize(shrunk.reduce((n, f) => n + f.size, 0));
          setBusy(false);
        }}
      />
      <span style={{ fontSize: "2rem", lineHeight: 1 }}>📷</span>
      {busy ? (
        <>
          <span>사진 준비 중…</span>
          <span className="ward-prefill">잠시만요</span>
        </>
      ) : names.length === 0 ? (
        <>
          <span>사진 찍기</span>
          <span className="ward-prefill">보호자가 가장 먼저 보는 것입니다</span>
        </>
      ) : (
        <>
          <span>{names.length}장 첨부됨 · {formatBytes(size)}</span>
          <span className="ward-prefill">다시 누르면 새로 찍습니다</span>
        </>
      )}
    </label>
  );
}
