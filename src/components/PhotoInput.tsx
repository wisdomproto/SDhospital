"use client";
import { useRef, useState } from "react";
import { shrinkImage, setInputFiles, isShrinkable, formatBytes } from "@/lib/image";

type Note = { before: number; after: number } | null;

function Saved({ note }: { note: Note }) {
  if (!note || note.after >= note.before) return null;
  return (
    <span style={{ fontSize: ".72rem", color: "var(--muted-2)" }}>
      {formatBytes(note.before)} → {formatBytes(note.after)}
    </span>
  );
}

/**
 * 보호자에게 보여줄 사진 — 원본은 남기지 않고 줄여서 올린다.
 * 병동 리포트 사진, 회차 사진/영상이 여기에 해당한다. (동영상은 그대로 통과)
 */
export function ShrinkFileInput({
  name = "file",
  accept = "image/*,video/*",
  required,
  multiple,
  capture,
}: {
  name?: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  capture?: "environment" | "user";
}) {
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const picked = Array.from(input.files ?? []);
    if (picked.length === 0) return setNote(null);
    setBusy(true);
    const before = picked.reduce((n, f) => n + f.size, 0);
    const shrunk = await Promise.all(picked.map((f) => shrinkImage(f)));
    setInputFiles(input, shrunk);
    setNote({ before, after: shrunk.reduce((n, f) => n + f.size, 0) });
    setBusy(false);
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input
        type="file"
        name={name}
        accept={accept}
        required={required}
        multiple={multiple}
        capture={capture}
        onChange={onChange}
      />
      {busy ? <span style={{ fontSize: ".72rem", color: "var(--muted-2)" }}>줄이는 중…</span> : <Saved note={note} />}
    </span>
  );
}

/**
 * 의료영상 — 원본은 판독용이라 절대 건드리지 않는다.
 * 보호자에게 보낼 가벼운 사본만 따로 만들어 함께 올린다.
 */
export function MedicalImageInput({ accept = "image/*,.dcm" }: { accept?: string }) {
  const previewRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    const preview = previewRef.current;
    if (!preview) return;
    if (!file || !isShrinkable(file)) {
      setInputFiles(preview, []); // DICOM 등은 사본을 만들지 않는다
      return setNote(null);
    }
    setBusy(true);
    const small = await shrinkImage(file);
    setInputFiles(preview, small === file ? [] : [small]);
    setNote({ before: file.size, after: small.size });
    setBusy(false);
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input type="file" name="file" accept={accept} required onChange={onChange} />
      {/* 원본과 함께 올라가는 보호자용 사본 */}
      <input ref={previewRef} type="file" name="preview" hidden />
      {busy ? (
        <span style={{ fontSize: ".72rem", color: "var(--muted-2)" }}>사본 만드는 중…</span>
      ) : note ? (
        <span style={{ fontSize: ".72rem", color: "var(--muted-2)" }}>
          원본 보관 · 보호자용 {formatBytes(note.after)}
        </span>
      ) : null}
    </span>
  );
}
