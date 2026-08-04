"use client";
import { useState, useTransition } from "react";
import { FIELDS, energyHint, type FieldKey } from "@/lib/life-log";
import { saveDay, addPhoto } from "./actions";

type Values = Record<FieldKey, string | null> & { weight_kg: number | null; note: string | null };

/**
 * 오늘 한 줄. **저장 버튼이 없다** —
 * 칩을 누르면 그 자리에서 저장된다. 한 번 더 누르게 하면 그 한 번을 안 누른다.
 *
 * 화면 상태는 즉시 바뀌고 서버 저장은 뒤따른다(낙관적). 실패하면 되돌리고 알린다.
 * 체중·메모만 타이핑이라 포커스를 뗄 때 저장한다.
 */
export function DayEntry({
  patientId,
  loggedOn,
  species,
  initial,
  hasPrescription,
  photos,
}: {
  patientId: string;
  loggedOn: string;
  species: string | null;
  initial: Values;
  /** 우리 처방이 살아 있을 때만 "약" 줄을 띄운다 — 없는 약을 매일 물으면 안 적는다 */
  hasPrescription: boolean;
  photos: { id: string; url: string | null }[];
}) {
  const [v, setV] = useState<Values>(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function push(patch: Partial<Values>) {
    const next = { ...v, ...patch };
    setV(next);
    setErr(null);
    start(async () => {
      const r = await saveDay(patientId, loggedOn, patch);
      if (!r.ok) {
        setV(v); // 되돌린다
        setErr(r.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      }
    });
  }

  /** 같은 칩을 다시 누르면 해제된다 — 잘못 누른 걸 못 지우면 그 날 기록이 틀린 채로 남는다 */
  const toggle = (field: FieldKey, key: string) =>
    push({ [field]: v[field] === key ? null : key } as Partial<Values>);

  const rows = FIELDS.filter((f) => f.key !== "meds" || hasPrescription);

  return (
    <div className="life-day">
      {rows.map((f) => (
        <div key={f.key} className="life-row">
          <div className="life-row-label">
            {f.key === "meds" ? "약 (병원에서 받은 것)" : f.label}
            {f.key === "energy" && <span className="life-hint">{energyHint(species)}</span>}
          </div>
          <div className="chip-group">
            {f.choices.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(f.key, c.key)}
                className={`life-chip tone-${c.tone}${v[f.key] === c.key ? " on" : ""}`}
                aria-pressed={v[f.key] === c.key}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="life-row life-row-inline">
        <div className="life-row-label">체중</div>
        <div className="life-weight">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={v.weight_kg ?? ""}
            placeholder="집에서 잰 값"
            onBlur={(e) => {
              const n = e.currentTarget.value === "" ? null : Number(e.currentTarget.value);
              if (n !== v.weight_kg) push({ weight_kg: Number.isFinite(n as number) ? n : null });
            }}
          />
          <span>kg</span>
        </div>
      </div>

      <div className="life-row">
        <div className="life-row-label">메모</div>
        <textarea
          className="ward-special"
          rows={2}
          defaultValue={v.note ?? ""}
          placeholder="위에 없는 것만 (예: 산책 중 오른쪽 뒷다리를 잠깐 들었어요)"
          onBlur={(e) => {
            const t = e.currentTarget.value;
            if (t !== (v.note ?? "")) push({ note: t.trim() || null });
          }}
        />
      </div>

      <PhotoRow patientId={patientId} loggedOn={loggedOn} photos={photos} />

      <p className="life-status" aria-live="polite">
        {err ? (
          <span className="life-err">저장하지 못했어요 — {err}</span>
        ) : pending ? (
          "저장 중…"
        ) : saved ? (
          "저장했어요"
        ) : (
          "고른 것만 저장돼요. 다 채우지 않아도 괜찮아요."
        )}
      </p>
    </div>
  );
}

const MAX = 1280;

/** 사진은 브라우저에서 줄여 보낸다 (폰 원본은 한 장에 5MB 다) */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}

function PhotoRow({
  patientId,
  loggedOn,
  photos,
}: {
  patientId: string;
  loggedOn: string;
  photos: { id: string; url: string | null }[];
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    const r = await addPhoto(patientId, loggedOn, await shrink(file));
    if (!r.ok) setErr(r.error);
    setBusy(false);
  }

  return (
    <div className="life-row">
      <div className="life-row-label">사진</div>
      <div className="life-photos">
        {photos.map((p) =>
          p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="" />
          ) : null
        )}
        <label className={`life-addphoto${busy ? " busy" : ""}`}>
          <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
          {busy ? "올리는 중…" : "＋ 사진"}
        </label>
      </div>
      {err && <span className="life-err">{err}</span>}
    </div>
  );
}
