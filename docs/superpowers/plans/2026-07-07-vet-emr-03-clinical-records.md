# Vet EMR — Plan 03: Clinical Records Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff record clinical work per patient — visits (dated, numbered, free-text), a drug master, prescriptions on a visit, and file uploads (X-ray/MRI/CT plus general photos/videos) stored in Supabase Storage.

**Architecture:** The `visit` / `drug` / `prescription` / `medical_image` / `media` tables and their RLS already exist (Plan 01). This plan adds a **private Storage bucket** with staff RLS, Server Actions for writes (including `File` uploads via `FormData`), and Server Components that read rows and mint short-lived **signed URLs** for viewing files. Pure validators are unit-tested; screens are verified with the preview browser. Follows Plan 01/02 conventions.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + Storage + RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-vet-emr-design.md`
**Prereq:** Plan 02 merged. Reuses `@/components/*`, `@/lib/validation/*` pattern, `@/lib/supabase/server`.

---

## Conventions (unchanged from Plan 02)

- Writes = `"use server"` actions; validate with a pure helper; `revalidatePath` + `redirect`.
- Reads = Server Components via `await createClient()`.
- Verify forms in preview with `form.requestSubmit()` (preview_click does not submit Next 16 server-action forms). Staff login `staff@sdhospital.test` / `sdhospital123!`.
- Commit after each task. Feature branch: `feat/clinical-records`.

## File Structure (created by this plan)

```
supabase/migrations/
  0004_storage.sql              # private bucket + staff storage RLS
src/lib/validation/
  drug.ts                       # validateDrugInput
  visit.ts                      # validateVisitInput
  prescription.ts               # validatePrescriptionInput
src/lib/storage.ts              # bucket name, path builders, signed-url helper
src/app/(app)/drugs/
  page.tsx, actions.ts, [id]/edit/page.tsx     # drug master CRUD
src/app/(app)/patients/[id]/
  page.tsx                      # MODIFY: list visits + "회차 추가"
  visits/actions.ts             # createVisit (from patient detail)
src/app/(app)/visits/[visitId]/
  page.tsx                      # visit detail: note, prescriptions, images, media
  actions.ts                    # updateVisitNote, add/deletePrescription, upload/deleteFile
  PrescriptionForm.tsx          # drug picker + dose/freq/duration
  FileUpload.tsx                # <input type=file> forms (images + media)
tests/
  validation.test.ts            # MODIFY: add drug/visit/prescription cases
```

Note: `visit` create lives under the patient route (that's where staff start a visit); the visit **detail** is its own top-level route `/visits/[visitId]` so prescriptions and uploads have a stable home.

---

## Task 1: Validators for drug / visit / prescription (TDD)

**Files:**
- Create: `src/lib/validation/drug.ts`, `src/lib/validation/visit.ts`, `src/lib/validation/prescription.ts`
- Modify: `tests/validation.test.ts`

- [ ] **Step 1: Add failing tests** (append to `tests/validation.test.ts`)

```ts
import { validateDrugInput } from "@/lib/validation/drug";
import { validateVisitInput } from "@/lib/validation/visit";
import { validatePrescriptionInput } from "@/lib/validation/prescription";

describe("validateDrugInput", () => {
  it("requires a name", () => {
    expect(validateDrugInput({ name: " " }).ok).toBe(false);
  });
  it("trims and nulls empties", () => {
    const r = validateDrugInput({ name: " 아목시실린 ", unit: "", spec: "정" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: "아목시실린", unit: null, spec: "정", note: null });
  });
});

describe("validateVisitInput", () => {
  it("requires patient_id", () => {
    expect(validateVisitInput({ patient_id: "" }).ok).toBe(false);
  });
  it("defaults visit_date when blank and parses visit_no", () => {
    const r = validateVisitInput({ patient_id: "p1", visit_date: "", visit_no: "3", note: " 메모 " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.patient_id).toBe("p1");
      expect(r.value.visit_no).toBe(3);
      expect(r.value.note).toBe("메모");
      expect(typeof r.value.visit_date).toBe("string"); // YYYY-MM-DD
    }
  });
  it("rejects a non-numeric visit_no", () => {
    expect(validateVisitInput({ patient_id: "p1", visit_no: "abc" }).ok).toBe(false);
  });
});

describe("validatePrescriptionInput", () => {
  it("requires visit_id and drug_id", () => {
    expect(validatePrescriptionInput({ visit_id: "", drug_id: "d" }).ok).toBe(false);
    expect(validatePrescriptionInput({ visit_id: "v", drug_id: "" }).ok).toBe(false);
  });
  it("nulls empty optional fields", () => {
    const r = validatePrescriptionInput({ visit_id: "v", drug_id: "d", dose: "1T", frequency: "", duration: "5d" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ visit_id: "v", drug_id: "d", dose: "1T", frequency: null, duration: "5d", note: null });
  });
});
```

- [ ] **Step 2: Run — verify FAIL** — `npm test` → new suites fail (modules missing).

- [ ] **Step 3: Implement `src/lib/validation/drug.ts`**

```ts
import type { Validated } from "./hospital";

function clean(v?: string | null): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

export function validateDrugInput(input: {
  name: string;
  unit?: string;
  spec?: string;
  note?: string;
}): Validated<{ name: string; unit: string | null; spec: string | null; note: string | null }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "약품명을 입력하세요." };
  return { ok: true, value: { name, unit: clean(input.unit), spec: clean(input.spec), note: clean(input.note) } };
}
```

- [ ] **Step 4: Implement `src/lib/validation/visit.ts`**

```ts
import type { Validated } from "./hospital";

export type VisitValues = {
  patient_id: string;
  visit_date: string; // YYYY-MM-DD
  visit_no: number | null;
  note: string | null;
};

export function validateVisitInput(input: {
  patient_id: string;
  visit_date?: string;
  visit_no?: string;
  note?: string;
}): Validated<VisitValues> {
  const patient_id = (input.patient_id ?? "").trim();
  if (!patient_id) return { ok: false, error: "환자 정보가 없습니다." };

  const rawDate = (input.visit_date ?? "").trim();
  const visit_date = rawDate || new Date().toISOString().slice(0, 10);

  const rawNo = (input.visit_no ?? "").trim();
  let visit_no: number | null = null;
  if (rawNo) {
    const n = Number(rawNo);
    if (!Number.isInteger(n) || n < 0) return { ok: false, error: "회차는 0 이상의 정수여야 합니다." };
    visit_no = n;
  }

  const note = (input.note ?? "").trim() || null;
  return { ok: true, value: { patient_id, visit_date, visit_no, note } };
}
```

- [ ] **Step 5: Implement `src/lib/validation/prescription.ts`**

```ts
import type { Validated } from "./hospital";

function clean(v?: string | null): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

export type PrescriptionValues = {
  visit_id: string;
  drug_id: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  note: string | null;
};

export function validatePrescriptionInput(input: {
  visit_id: string;
  drug_id: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  note?: string;
}): Validated<PrescriptionValues> {
  const visit_id = (input.visit_id ?? "").trim();
  const drug_id = (input.drug_id ?? "").trim();
  if (!visit_id) return { ok: false, error: "회차 정보가 없습니다." };
  if (!drug_id) return { ok: false, error: "약품을 선택하세요." };
  return {
    ok: true,
    value: {
      visit_id,
      drug_id,
      dose: clean(input.dose),
      frequency: clean(input.frequency),
      duration: clean(input.duration),
      note: clean(input.note),
    },
  };
}
```

- [ ] **Step 6: Run — verify PASS** — `npm test`.

- [ ] **Step 7: Commit**

```bash
git commit -am "feat: validators for drug, visit, prescription (tested)"
```

---

## Task 2: Storage bucket + staff RLS

**Files:**
- Create: `supabase/migrations/0004_storage.sql`, `src/lib/storage.ts`

- [ ] **Step 1: Migration** — `supabase/migrations/0004_storage.sql`

```sql
-- 0004_storage.sql — private bucket for patient files + staff access

insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

-- staff can do everything in this bucket; external roles get NO direct object
-- access here (Plan 05 serves them via server-minted signed URLs).
create policy "patient_files_staff_all"
on storage.objects for all
to authenticated
using (bucket_id = 'patient-files' and public.current_role_name() = 'staff')
with check (bucket_id = 'patient-files' and public.current_role_name() = 'staff');
```

- [ ] **Step 2: Apply** — via Supabase MCP `apply_migration` (name `storage`) or `supabase db push`. Also save the file to `supabase/migrations/`.

- [ ] **Step 3: Storage helper** — `src/lib/storage.ts`

```ts
import { createClient } from "@/lib/supabase/server";

export const BUCKET = "patient-files";

// Deterministic, collision-resistant object paths.
export function imagePath(patientId: string, visitId: string, fileName: string) {
  return `images/${patientId}/${visitId}/${crypto.randomUUID()}-${fileName}`;
}
export function mediaPath(patientId: string, visitId: string, fileName: string) {
  return `media/${patientId}/${visitId}/${crypto.randomUUID()}-${fileName}`;
}

// Mint a short-lived signed URL for viewing/downloading a stored object.
export async function signedUrl(path: string, expiresIn = 60): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
```

- [ ] **Step 4: Verify the bucket exists**

Via MCP `execute_sql`: `select id, public from storage.buckets where id = 'patient-files';` → one row, `public = false`.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(storage): private patient-files bucket with staff RLS"
```

---

## Task 3: Drug master CRUD

**Files:**
- Create: `src/app/(app)/drugs/actions.ts`, `src/app/(app)/drugs/page.tsx`, `src/app/(app)/drugs/[id]/edit/page.tsx`

Mirror the owner/hospital CRUD from Plan 02 exactly, using the `drug` table and `validateDrugInput`. The `약품` nav link already exists in the app shell.

- [ ] **Step 1: Actions** — `createDrug` / `updateDrug` / `deleteDrug` (same shape as `owners/actions.ts`; redirect base `/drugs`; fields name/unit/spec/note).

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { validateDrugInput } from "@/lib/validation/drug";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function read(formData: FormData) {
  return validateDrugInput({
    name: String(formData.get("name") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    spec: String(formData.get("spec") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
}

export async function createDrug(formData: FormData) {
  const v = read(formData);
  if (!v.ok) redirect("/drugs?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("drug").insert(v.value);
  if (error) redirect("/drugs?error=" + encodeURIComponent(error.message));
  revalidatePath("/drugs");
  redirect("/drugs");
}

export async function updateDrug(id: string, formData: FormData) {
  const v = read(formData);
  if (!v.ok) redirect(`/drugs/${id}/edit?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("drug").update(v.value).eq("id", id);
  if (error) redirect(`/drugs/${id}/edit?error=` + encodeURIComponent(error.message));
  revalidatePath("/drugs");
  redirect("/drugs");
}

export async function deleteDrug(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("drug").delete().eq("id", id);
  if (error)
    redirect("/drugs?error=" + encodeURIComponent("처방에 사용된 약품이라 삭제할 수 없습니다."));
  revalidatePath("/drugs");
}
```

Note: `prescription.drug_id` is `on delete restrict`, so a used drug cannot be deleted — surface the friendly message.

- [ ] **Step 2: List + create page** — `src/app/(app)/drugs/page.tsx` (copy `owners/page.tsx`; headers `["약품명","단위","규격",""]`; fields name/unit/spec; link `/drugs/{id}/edit`).

- [ ] **Step 3: Edit page** — `src/app/(app)/drugs/[id]/edit/page.tsx` (copy owner edit; fields name/unit/spec/note; `updateDrug`).

- [ ] **Step 4: Verify via preview** — create a drug (e.g. `아목시실린 / mg / 250mg`), edit, then confirm delete is blocked once it's used by a prescription (revisit after Task 5).

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: drug master CRUD"
```

---

## Task 4: Visits — create from patient detail, list, visit detail (note)

**Files:**
- Create: `src/app/(app)/patients/[id]/visits/actions.ts`, `src/app/(app)/visits/[visitId]/page.tsx`, `src/app/(app)/visits/[visitId]/actions.ts`
- Modify: `src/app/(app)/patients/[id]/page.tsx` (replace the "Plan 03" placeholder with a visit list + create form)

- [ ] **Step 1: Create-visit action** — `src/app/(app)/patients/[id]/visits/actions.ts`

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { validateVisitInput } from "@/lib/validation/visit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createVisit(patientId: string, formData: FormData) {
  const v = validateVisitInput({
    patient_id: patientId,
    visit_date: String(formData.get("visit_date") ?? ""),
    visit_no: String(formData.get("visit_no") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(`/patients/${patientId}?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { data, error } = await supabase.from("visit").insert(v.value).select("id").single();
  if (error) redirect(`/patients/${patientId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/patients/${patientId}`);
  redirect(`/visits/${data!.id}`);
}
```

- [ ] **Step 2: Patient detail — visit list + create.** Replace the placeholder `<section>진료 회차</section>` in `src/app/(app)/patients/[id]/page.tsx` with:

```tsx
// add near top: import { createVisit } from "./visits/actions";
// import { FormField, inputClass } from "@/components/FormField";
// import { SubmitButton } from "@/components/SubmitButton";
// fetch visits alongside the patient:
//   const { data: visits } = await supabase
//     .from("visit").select("id, visit_date, visit_no, note")
//     .eq("patient_id", id).order("visit_date", { ascending: false });

<section className="space-y-4">
  <h2 className="text-lg font-medium">진료 회차</h2>
  <DataTable
    headers={["날짜", "회차", "요약", ""]}
    empty="회차가 없습니다."
    rows={(visits ?? []).map((v) => [
      v.visit_date,
      v.visit_no ?? "-",
      (v.note ?? "").slice(0, 30) || "-",
      <Link key="o" href={`/visits/${v.id}`} className="text-blue-600">열기</Link>,
    ])}
  />
  <form action={createVisit.bind(null, p.id)} className="grid max-w-md grid-cols-2 gap-3">
    <FormField label="날짜"><input type="date" name="visit_date" className={inputClass} /></FormField>
    <FormField label="회차"><input name="visit_no" inputMode="numeric" className={inputClass} /></FormField>
    <div className="col-span-2">
      <FormField label="진료 내용"><textarea name="note" rows={3} className={inputClass} /></FormField>
    </div>
    <div className="col-span-2"><SubmitButton>회차 추가</SubmitButton></div>
  </form>
</section>
```

(Add `DataTable`/`Link` imports if not present.)

- [ ] **Step 3: Visit detail page (note edit)** — `src/app/(app)/visits/[visitId]/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateVisitNote } from "./actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function VisitDetail({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note, patient:patient_id(id, name)")
    .eq("id", visitId)
    .single();
  if (!v) notFound();
  const patient = v.patient as unknown as { id: string; name: string };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href={`/patients/${patient.id}`} className="text-sm text-blue-600">
          ← {patient.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {v.visit_date} {v.visit_no != null ? `· ${v.visit_no}회차` : ""}
        </h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">진료 내용</h2>
        <form action={updateVisitNote.bind(null, v.id)} className="space-y-2">
          <textarea name="note" rows={6} defaultValue={v.note ?? ""} className={inputClass} />
          <SubmitButton>저장</SubmitButton>
        </form>
      </section>

      {/* Prescriptions (Task 5) and Files (Task 6) sections mounted below */}
    </div>
  );
}
```

- [ ] **Step 4: Visit actions (note)** — `src/app/(app)/visits/[visitId]/actions.ts` — start with `updateVisitNote`; add prescription/file actions in Tasks 5-6.

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateVisitNote(visitId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim() || null;
  const supabase = await createClient();
  await supabase.from("visit").update({ note }).eq("id", visitId);
  revalidatePath(`/visits/${visitId}`);
}
```

- [ ] **Step 5: Verify via preview** — open a patient → add a visit → redirected to `/visits/{id}` → edit note, save, reload shows saved note → patient detail lists the visit.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: visits — create, list on patient, visit detail with note"
```

---

## Task 5: Prescriptions on a visit

**Files:**
- Create: `src/app/(app)/visits/[visitId]/PrescriptionForm.tsx`
- Modify: `src/app/(app)/visits/[visitId]/page.tsx` (add prescriptions section), `src/app/(app)/visits/[visitId]/actions.ts` (add/delete prescription)

- [ ] **Step 1: Actions** — append to `visits/[visitId]/actions.ts`

```ts
import { validatePrescriptionInput } from "@/lib/validation/prescription";
import { redirect } from "next/navigation";

export async function addPrescription(visitId: string, formData: FormData) {
  const v = validatePrescriptionInput({
    visit_id: visitId,
    drug_id: String(formData.get("drug_id") ?? ""),
    dose: String(formData.get("dose") ?? ""),
    frequency: String(formData.get("frequency") ?? ""),
    duration: String(formData.get("duration") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(`/visits/${visitId}?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("prescription").insert(v.value);
  if (error) redirect(`/visits/${visitId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/visits/${visitId}`);
}

export async function deletePrescription(visitId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("prescription").delete().eq("id", id);
  revalidatePath(`/visits/${visitId}`);
}
```

- [ ] **Step 2: PrescriptionForm** — `src/app/(app)/visits/[visitId]/PrescriptionForm.tsx` (server component; drug `<select>` + dose/frequency/duration inputs; binds `addPrescription`).

```tsx
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { addPrescription } from "./actions";

export function PrescriptionForm({
  visitId,
  drugs,
}: {
  visitId: string;
  drugs: { id: string; name: string }[];
}) {
  return (
    <form action={addPrescription.bind(null, visitId)} className="grid grid-cols-4 gap-2">
      <select name="drug_id" required defaultValue="" className={inputClass}>
        <option value="">약품 선택</option>
        {drugs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <input name="dose" placeholder="용량" className={inputClass} />
      <input name="frequency" placeholder="용법" className={inputClass} />
      <input name="duration" placeholder="기간" className={inputClass} />
      <div className="col-span-4"><SubmitButton>처방 추가</SubmitButton></div>
    </form>
  );
}
```

- [ ] **Step 3: Prescriptions section in visit detail** — in `visits/[visitId]/page.tsx`, fetch drugs + prescriptions and render a list with delete + the form:

```tsx
// fetch:
//   const { data: drugs } = await supabase.from("drug").select("id, name").order("name");
//   const { data: rxs } = await supabase
//     .from("prescription").select("id, dose, frequency, duration, drug:drug_id(name)")
//     .eq("visit_id", visitId);
<section className="space-y-3">
  <h2 className="text-lg font-medium">처방</h2>
  <DataTable
    headers={["약품", "용량", "용법", "기간", ""]}
    empty="처방이 없습니다."
    rows={(rxs ?? []).map((r) => [
      (r.drug as unknown as { name: string })?.name ?? "-",
      r.dose ?? "-",
      r.frequency ?? "-",
      r.duration ?? "-",
      <form key="d" action={deletePrescription.bind(null, v.id, r.id)}>
        <button className="text-red-600">삭제</button>
      </form>,
    ])}
  />
  <PrescriptionForm visitId={v.id} drugs={drugs ?? []} />
</section>
```

- [ ] **Step 4: Verify via preview** — on a visit, add a prescription picking a drug → appears in the list → delete removes it. Then confirm the drug can no longer be deleted from `/drugs` while used (Task 3 Step 4).

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: prescriptions on a visit (add/list/delete)"
```

---

## Task 6: File uploads — medical images + general media

**Files:**
- Create: `src/app/(app)/visits/[visitId]/FileUpload.tsx`
- Modify: `src/app/(app)/visits/[visitId]/page.tsx` (images + media sections), `src/app/(app)/visits/[visitId]/actions.ts` (upload/delete)

- [ ] **Step 1: Upload/delete actions** — append to `visits/[visitId]/actions.ts`

```ts
import { BUCKET, imagePath, mediaPath } from "@/lib/storage";

async function uploadTo(
  kind: "image" | "media",
  visitId: string,
  patientId: string,
  formData: FormData
) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) redirect(`/visits/${visitId}?error=` + encodeURIComponent("파일을 선택하세요."));
  const supabase = await createClient();
  const path =
    kind === "image"
      ? imagePath(patientId, visitId, file!.name)
      : mediaPath(patientId, visitId, file!.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file!, { contentType: file!.type || undefined });
  if (upErr) redirect(`/visits/${visitId}?error=` + encodeURIComponent(upErr.message));

  if (kind === "image") {
    const modality = String(formData.get("modality") ?? "other");
    await supabase.from("medical_image").insert({
      visit_id: visitId,
      modality,
      storage_path: path,
      file_name: file!.name,
    });
  } else {
    const mkind = String(formData.get("kind") ?? "").trim() || null;
    await supabase.from("media").insert({
      patient_id: patientId,
      visit_id: visitId,
      kind: mkind,
      storage_path: path,
      file_name: file!.name,
    });
  }
  revalidatePath(`/visits/${visitId}`);
}

export async function uploadImage(visitId: string, patientId: string, formData: FormData) {
  "use server";
  await uploadTo("image", visitId, patientId, formData);
}
export async function uploadMedia(visitId: string, patientId: string, formData: FormData) {
  "use server";
  await uploadTo("media", visitId, patientId, formData);
}

export async function deleteFile(
  visitId: string,
  table: "medical_image" | "media",
  id: string,
  path: string
) {
  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from(table).delete().eq("id", id);
  revalidatePath(`/visits/${visitId}`);
}
```

(Keep `uploadTo` a private module function; only the exported wrappers are Server Actions. If Next complains about non-exported closures, inline `uploadTo` into each exported action.)

- [ ] **Step 2: FileUpload component** — `src/app/(app)/visits/[visitId]/FileUpload.tsx`

```tsx
import { SubmitButton } from "@/components/SubmitButton";
import { inputClass } from "@/components/FormField";
import { uploadImage, uploadMedia } from "./actions";

export function ImageUpload({ visitId, patientId }: { visitId: string; patientId: string }) {
  return (
    <form action={uploadImage.bind(null, visitId, patientId)} className="flex flex-wrap items-center gap-2">
      <select name="modality" defaultValue="xray" className={inputClass + " w-28"}>
        <option value="xray">X-ray</option>
        <option value="mri">MRI</option>
        <option value="ct">CT</option>
        <option value="other">기타</option>
      </select>
      <input type="file" name="file" required accept="image/*,.dcm" />
      <SubmitButton>영상 업로드</SubmitButton>
    </form>
  );
}

export function MediaUpload({ visitId, patientId }: { visitId: string; patientId: string }) {
  return (
    <form action={uploadMedia.bind(null, visitId, patientId)} className="flex flex-wrap items-center gap-2">
      <input name="kind" placeholder="종류(예: 보행영상)" className={inputClass + " w-40"} />
      <input type="file" name="file" required accept="image/*,video/*" />
      <SubmitButton>사진/영상 업로드</SubmitButton>
    </form>
  );
}
```

- [ ] **Step 3: Files sections in visit detail** — fetch rows, mint signed URLs, render thumbnails/links + delete + upload forms:

```tsx
// import { signedUrl } from "@/lib/storage";
// import { ImageUpload, MediaUpload } from "./FileUpload";
// import { deleteFile } from "./actions";
// const { data: images } = await supabase.from("medical_image")
//   .select("id, modality, file_name, storage_path").eq("visit_id", visitId);
// const { data: mediaRows } = await supabase.from("media")
//   .select("id, kind, file_name, storage_path").eq("visit_id", visitId);
// const imageLinks = await Promise.all((images ?? []).map(async i => ({ ...i, url: await signedUrl(i.storage_path) })));
// const mediaLinks = await Promise.all((mediaRows ?? []).map(async m => ({ ...m, url: await signedUrl(m.storage_path) })));

<section className="space-y-3">
  <h2 className="text-lg font-medium">의료영상</h2>
  <ul className="space-y-1 text-sm">
    {imageLinks.map((i) => (
      <li key={i.id} className="flex items-center gap-3">
        <span className="uppercase text-gray-500">{i.modality}</span>
        {i.url ? <a href={i.url} target="_blank" className="text-blue-600">{i.file_name}</a> : i.file_name}
        <form action={deleteFile.bind(null, v.id, "medical_image", i.id, i.storage_path)}>
          <button className="text-red-600">삭제</button>
        </form>
      </li>
    ))}
    {imageLinks.length === 0 && <li className="text-gray-500">없음</li>}
  </ul>
  <ImageUpload visitId={v.id} patientId={patient.id} />
</section>

<section className="space-y-3">
  <h2 className="text-lg font-medium">사진 / 영상</h2>
  <ul className="space-y-1 text-sm">
    {mediaLinks.map((m) => (
      <li key={m.id} className="flex items-center gap-3">
        <span className="text-gray-500">{m.kind ?? "-"}</span>
        {m.url ? <a href={m.url} target="_blank" className="text-blue-600">{m.file_name}</a> : m.file_name}
        <form action={deleteFile.bind(null, v.id, "media", m.id, m.storage_path)}>
          <button className="text-red-600">삭제</button>
        </form>
      </li>
    ))}
    {mediaLinks.length === 0 && <li className="text-gray-500">없음</li>}
  </ul>
  <MediaUpload visitId={v.id} patientId={patient.id} />
</section>
```

- [ ] **Step 4: Verify via preview**

Because `<input type=file>` cannot be filled by `preview_fill`, verify uploads with a scripted `fetch` to the server action is not practical; instead drive the upload in the browser via `preview_eval`: build a `File`/`FormData` and call the action endpoint, OR (simpler) verify the storage path end-to-end by uploading a tiny file through the Supabase client in an eval against the page's session. Concretely:
  1. In preview_eval on the visit page, construct `const f = new File([new Uint8Array([1,2,3])], "t.png", {type:"image/png"});` put it in the file input via a `DataTransfer`, then `form.requestSubmit()`.
  2. Reload the visit page; assert the file name appears and its signed-URL link resolves (fetch returns 200).
  3. Delete it; assert it disappears and the object is gone (`select count(*) from storage.objects where name = <path>` via MCP → 0).

If the DataTransfer approach is flaky in the preview, fall back to: upload a small object directly via `supabase.storage` in an eval using the page session, insert the matching `medical_image` row, and verify the render + signed URL. Document whichever path you used.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: medical image and media uploads on a visit (Storage + signed URLs)"
```

---

## Task 7: Regression sweep + finish

- [ ] **Step 1:** `npm test` (roles + all validators pass) and `npm run build` (compiles).
- [ ] **Step 2:** Re-run `supabase/tests/rls.sql` (MCP `execute_sql`) → `RLS TESTS PASSED`.
- [ ] **Step 3:** Storage guard check — confirm the bucket is private: `select public from storage.buckets where id='patient-files'` → `false`. (External read is intentionally deferred to Plan 05 via signed URLs.)
- [ ] **Step 4:** Preview smoke: patient → add visit → note → add prescription → upload an image + a media file → all render → delete each.
- [ ] **Step 5:** Use superpowers:finishing-a-development-branch to merge `feat/clinical-records` into `main`.

---

## Done criteria (Plan 03)

- `npm test` passes (roles + hospital/owner/patient/drug/visit/prescription validators).
- Staff can: CRUD drugs; create/list visits per patient; edit a visit note; add/list/delete prescriptions; upload/list/delete medical images and media.
- Files live in the private `patient-files` bucket; views use short-lived signed URLs.
- Drug delete and owner delete are blocked (with messages) while referenced.
- RLS test still passes; bucket is private.

## Next
- **Plan 04 — 입원·바이털**: admissions lifecycle, periodic vital entry, time-series chart (Recharts).
- **Plan 05 — 초대·외부 포털**: invite issue/redeem, read-only owner + referring-vet portal (including signed-URL file access).
