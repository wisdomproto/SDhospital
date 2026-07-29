"use client";
import { useRef, useState } from "react";
import { savePetPhoto } from "./actions";

const MAX = 400;

/**
 * 프로필 사진 — 업로드 전에 브라우저에서 줄인다.
 * 원본 그대로 보내면 폰 사진 한 장이 5MB다. 프로필에 그만한 화질이 필요하지 않다.
 */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = MAX;
  const ctx = canvas.getContext("2d")!;
  // 정사각형으로 가운데를 잘라 넣는다 — 아바타 자리가 원형이라 어차피 잘린다
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    MAX,
    MAX
  );
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}

export function PetPhoto({
  patientId,
  name,
  species,
  photo,
}: {
  patientId: string;
  name: string;
  species: string | null;
  photo: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(photo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const data = await shrink(file);
      const r = await savePetPhoto(patientId, data);
      if (r.ok) setPreview(data);
      else setError("사진을 저장하지 못했어요. 다시 시도해 주세요.");
    } catch {
      setError("사진을 읽지 못했어요. 다른 사진으로 해보세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
      <button
        type="button"
        className="pet-photo"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="사진 바꾸기"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={name} />
        ) : (
          <span className="pet-photo-empty">{species === "고양이" ? "🐱" : "🐶"}</span>
        )}
        <span className="pet-photo-edit">{busy ? "…" : "사진 바꾸기"}</span>
      </button>

      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />

      {preview && (
        <button
          type="button"
          className="link-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await savePetPhoto(patientId, null);
            setPreview(null);
            setBusy(false);
          }}
        >
          사진 지우기
        </button>
      )}
      {error && <p style={{ color: "var(--danger)", fontSize: ".84rem", margin: 0 }}>{error}</p>}
    </div>
  );
}
