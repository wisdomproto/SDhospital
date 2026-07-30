// 시연용 의료영상 넣기 — `node supabase/seed/seed_xray.mjs`
//
// SQL 시드로는 못 한다. 영상은 Storage 에 실제 파일이 올라가야 하고 SQL 은 파일을 못 올린다.
// 그래서 이 스크립트만 따로 있다. 넣는 대상은 슈슈의 2026-04-11 회차 — 그 회차에 건강검진이
// 붙어 있어서 방사선 소견과 실제 사진이 같은 자리에서 보인다.
//
// 사진은 `xray/` 의 7장 (실제 결과서 PDF 에서 뽑은 것). ⚠️ **운영 DB 에 돌리지 말 것.**
// 되돌리기: `demo_history_rollback.sql` 이 f0000000- 행을 지운다 (Storage 파일은 남으니 콘솔에서 지운다).
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PATIENT = "438e9b38-5eec-5664-a31b-72a5244bcf3d"; // 슈슈
const VISIT = "d0000000-0000-4000-8000-000001000060";   // 2026-04-11 (건강검진 회차)
const BUCKET = "patient-files";

const FILES = [
  ["thorax-2.webp", "흉부 우측와위 (R LAT)"],
  ["thorax-1.webp", "흉부 복배상 (VD)"],
  ["abdomen-2.webp", "복부 우측와위 (R LAT)"],
  ["abdomen-1.webp", "복부 복배상 (VD)"],
  ["limb-1.webp", "우측 후지 측면"],
  ["limb-2.webp", "좌측 후지 측면"],
  ["limb-3.webp", "골반 및 후지 복배상"],
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, anon);

const { error: authErr } = await supabase.auth.signInWithPassword({
  email: "staff@sdhospital.test",
  password: "sdhospital123!",
});
if (authErr) throw authErr;

for (const [i, [file, label]] of FILES.entries()) {
  const body = await readFile(join(HERE, "xray", file));
  const path = `images/${PATIENT}/${VISIT}/f0000000-${String(i + 1).padStart(4, "0")}-${file}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: "image/webp", upsert: true });
  if (upErr) throw upErr;

  // 보호자용 사본을 따로 만들지 않는다 — 이미 1600px WebP 라 원본이 곧 사본이다
  const { error } = await supabase.from("medical_image").upsert({
    id: `f0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    visit_id: VISIT,
    modality: "xray",
    storage_path: path,
    preview_path: path,
    file_name: `${label}.webp`,
  });
  if (error) throw error;
  console.log("ok", label);
}
