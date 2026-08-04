"use client";
import { useState, useTransition } from "react";
import type { Intake } from "@/lib/life-log";
import { addIntake, stopIntake, resumeIntake } from "./actions";

type Row = Intake & { url: string | null };

/**
 * 먹이는 것 — **바뀔 때만** 손대는 목록.
 *
 * 사료·간식·과일·영양제·다른 병원 약을 **구분하지 않는다.** 칸을 나누면
 * "과일은 어디 넣나"가 생기고, 그때부터 아무도 안 적는다.
 * 채팅이 보는 건 "최근에 뭔가 바뀌었나" 하나라서 종류를 알 필요가 없다.
 *
 * 이름은 선택이다 — **보호자는 약 이름을 모른다**(조제해서 봉투에 담아 준다).
 * 봉투·포대를 찍으면 병원명·제품명·성분표가 다 들어온다.
 */
export function IntakeList({
  patientId,
  today,
  active,
  stopped,
}: {
  patientId: string;
  today: string;
  active: Row[];
  stopped: Row[];
}) {
  const [open, setOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "실패했습니다");
    });
  };

  return (
    <div className="portal-card">
      <div className="life-sec-head">
        <b>지금 먹이는 것</b>
        <button type="button" className="life-linkbtn" onClick={() => setOpen((o) => !o)}>
          {open ? "닫기" : "＋ 추가"}
        </button>
      </div>
      <p className="life-note">
        사료·간식·영양제·다른 병원에서 받은 약 — <b>입에 들어가는 건 전부 여기</b>.
        <br />
        <b>기록해 두는 곳이고, 계속 먹여도 되는지는 진료 때 담당의가 확인합니다.</b>
      </p>

      {open && <AddForm patientId={patientId} today={today} onDone={() => setOpen(false)} />}

      {active.length === 0 && !open && <p className="life-empty">아직 없어요.</p>}
      <ul className="life-intake">
        {active.map((i) => (
          <li key={i.id}>
            {i.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.url} alt="" />
            ) : (
              <span className="life-intake-noimg">🍚</span>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="life-intake-name">{i.label ?? "사진으로 기록"}</div>
              <div className="life-intake-since">{i.started_on}부터</div>
            </div>
            <button
              type="button"
              className="life-linkbtn"
              disabled={pending}
              onClick={() => act(() => stopIntake(patientId, i.id, today))}
            >
              끊었어요
            </button>
          </li>
        ))}
      </ul>

      {stopped.length > 0 && (
        <>
          <button type="button" className="life-linkbtn" onClick={() => setShowPast((s) => !s)}>
            {showPast ? "지난 것 접기" : `지난 것 ${stopped.length}개 보기`}
          </button>
          {showPast && (
            <ul className="life-intake past">
              {stopped.map((i) => (
                <li key={i.id}>
                  <span className="life-intake-noimg">·</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="life-intake-name">{i.label ?? "사진으로 기록"}</div>
                    <div className="life-intake-since">
                      {i.started_on} ~ {i.stopped_on}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="life-linkbtn"
                    disabled={pending}
                    onClick={() => act(() => resumeIntake(patientId, i.id))}
                  >
                    다시 줘요
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {err && <p className="life-err">{err}</p>}
    </div>
  );
}

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}

function AddForm({
  patientId,
  today,
  onDone,
}: {
  patientId: string;
  today: string;
  onDone: () => void;
}) {
  const [label, setLabel] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await addIntake(patientId, label, photo, today);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setLabel("");
    setPhoto(null);
    onDone();
  }

  return (
    <div className="life-add">
      <input
        className="ward-special"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="이름 (몰라도 괜찮아요)"
      />
      <label className="life-addphoto">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (f) setPhoto(await shrink(f));
          }}
        />
        {photo ? "사진 바꾸기" : "📷 봉투·포대 찍기"}
      </label>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="life-add-preview" />
      )}
      <p className="life-note">
        <b>이름은 안 써도 됩니다.</b> 약봉투나 사료 포대를 찍으면 병원 이름·제품명·성분이 다 들어와요.
      </p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
        {busy ? "저장 중…" : "추가"}
      </button>
      {err && <p className="life-err">{err}</p>}
    </div>
  );
}
