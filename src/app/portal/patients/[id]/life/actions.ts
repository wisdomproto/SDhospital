"use server";
import { createClient } from "@/lib/supabase/server";
import { BUCKET } from "@/lib/storage";
import { revalidatePath } from "next/cache";

/**
 * 생활기록 쓰기. **보호자가 직접 쓰는 첫 테이블**이라 DEFINER 함수를 거치지 않는다 —
 * 자기가 만든 자기 행이라 RLS 정책으로 충분하고, DEFINER 로 감싸도 검사는 똑같다.
 * (남의 행을 고치는 `mark_*_read`·`sign_consent` 와 다르다.)
 */

type DayPatch = {
  appetite?: string | null;
  stool?: string | null;
  energy?: string | null;
  meds?: string | null;
  weight_kg?: number | null;
  note?: string | null;
};

/**
 * 하루 한 행. 다시 열면 고치는 것이지 새로 쌓는 게 아니다.
 * 칩 하나 누를 때마다 불린다 — **저장 버튼을 또 누르게 하면 안 적는다.**
 */
export async function saveDay(patientId: string, loggedOn: string, patch: DayPatch) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("life_log")
    .upsert(
      { patient_id: patientId, logged_on: loggedOn, ...patch },
      { onConflict: "patient_id,logged_on" }
    );
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/portal/patients/${patientId}/life`);
  revalidatePath(`/portal/patients/${patientId}`);
  return { ok: true as const };
}

/** 사진은 Storage 로 간다 — 매일 한 장씩만 쌓여도 3년이면 1,000장이다. */
export async function addPhoto(patientId: string, loggedOn: string, dataUrl: string) {
  const supabase = await createClient();

  // 사진만 올리는 날도 있다. 그 날 행이 없으면 만든다.
  const { data: log, error: logErr } = await supabase
    .from("life_log")
    .upsert({ patient_id: patientId, logged_on: loggedOn }, { onConflict: "patient_id,logged_on" })
    .select("id")
    .single();
  if (logErr || !log) return { ok: false as const, error: logErr?.message ?? "기록을 만들지 못했습니다" };

  const blob = await (await fetch(dataUrl)).blob();
  // 경로 두 번째 칸이 환자 id 여야 한다 — `can_read_patient_file()` 이 거기서 읽는다
  const path = `life/${patientId}/${loggedOn}/${crypto.randomUUID()}.webp`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/webp",
  });
  if (upErr) return { ok: false as const, error: upErr.message };

  const { error } = await supabase
    .from("life_photo")
    .insert({ patient_id: patientId, log_id: log.id, storage_path: path });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/portal/patients/${patientId}/life`);
  return { ok: true as const };
}

/**
 * 먹이는 것 추가. **사료·간식·과일·영양제·다른 병원 약을 구분하지 않는다** —
 * 칸을 나누면 "과일은 어디 넣나"가 생기고, 그때부터 아무도 안 적는다.
 * 넣은 날이 곧 시작일이라 "최근에 사료 바꾸셨나요"를 따로 물을 필요가 없다.
 */
export async function addIntake(
  patientId: string,
  label: string | null,
  dataUrl: string | null,
  startedOn: string
) {
  const supabase = await createClient();
  let photo_path: string | null = null;
  if (dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `life/${patientId}/intake/${crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: "image/webp",
    });
    if (error) return { ok: false as const, error: error.message };
    photo_path = path;
  }
  const trimmed = label?.trim() || null;
  if (!trimmed && !photo_path) return { ok: false as const, error: "이름이나 사진 중 하나는 있어야 합니다" };

  const { error } = await supabase
    .from("life_intake")
    .insert({ patient_id: patientId, label: trimmed, photo_path, started_on: startedOn });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/portal/patients/${patientId}/life`);
  return { ok: true as const };
}

/** 끊었을 때. **지우지 않는다** — 지난 원인을 되짚어야 한다. */
export async function stopIntake(patientId: string, id: string, on: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("life_intake")
    .update({ stopped_on: on })
    .eq("id", id)
    .eq("patient_id", patientId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/portal/patients/${patientId}/life`);
  return { ok: true as const };
}

/** 잘못 눌러 끊은 것을 되돌린다 */
export async function resumeIntake(patientId: string, id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("life_intake")
    .update({ stopped_on: null })
    .eq("id", id)
    .eq("patient_id", patientId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/portal/patients/${patientId}/life`);
  return { ok: true as const };
}
