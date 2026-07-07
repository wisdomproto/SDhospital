# Vet EMR — Plan 02: Patient Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff manage referring hospitals, owners, and patients — full CRUD plus a searchable patient list and a patient detail page.

**Architecture:** Server Components read from Supabase via the server client (RLS already restricts to staff). Writes go through Server Actions co-located per feature. Pure input validation and search-filter building live in `src/lib/validation/` and are unit-tested with Vitest; screens are verified end-to-end with the preview browser. Follows the structure and conventions established in Plan 01.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (`@supabase/ssr`, RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-vet-emr-design.md`
**Prereq:** Plan 01 merged (schema, RLS, `staff` auth, app shell, `src/lib/supabase/*`, `src/lib/auth/roles.ts`).

---

## Conventions (from Plan 01)

- Server reads: `const supabase = await createClient()` from `@/lib/supabase/server` inside a Server Component; `.from("table").select(...)`.
- Writes: `"use server"` action files; after mutation call `revalidatePath(...)` and `redirect(...)` as needed.
- Types: import row/insert types from `@/lib/supabase/types` (`Tables<"patient">`, `TablesInsert<"patient">`).
- Tests: pure helpers in `src/lib/**`, tested under `tests/`. Run `npm test`.
- After a UI task, verify via preview (`preview_start` → fill/click → snapshot). Staff login: `staff@sdhospital.test` / `sdhospital123!`.
- Commit after each task.

## File Structure (created by this plan)

```
src/lib/validation/
  hospital.ts            # validateHospitalInput (pure)
  owner.ts               # validateOwnerInput (pure)
  patient.ts             # validatePatientInput, buildPatientSearch (pure)
src/components/
  FormField.tsx          # labeled input wrapper
  SubmitButton.tsx       # form submit w/ pending state
  DataTable.tsx          # minimal table (headers + rows)
src/app/(app)/hospitals/
  page.tsx               # list + create form
  actions.ts             # create/update/delete hospital
  [id]/edit/page.tsx     # edit form
src/app/(app)/owners/
  page.tsx               # list + create form
  actions.ts
  [id]/edit/page.tsx
src/app/(app)/patients/
  page.tsx               # searchable list
  actions.ts             # create/update/delete patient
  new/page.tsx           # create (owner + hospital pickers)
  [id]/page.tsx          # detail
  [id]/edit/page.tsx     # edit
tests/
  validation.test.ts     # covers hospital/owner/patient validators + search
```

---

## Task 1: Validation + search helpers (pure, TDD)

**Files:**
- Create: `src/lib/validation/hospital.ts`, `src/lib/validation/owner.ts`, `src/lib/validation/patient.ts`, `tests/validation.test.ts`

- [ ] **Step 1: Write failing tests** — `tests/validation.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { validateHospitalInput } from "@/lib/validation/hospital";
import { validateOwnerInput } from "@/lib/validation/owner";
import { validatePatientInput, buildPatientSearch } from "@/lib/validation/patient";

describe("validateHospitalInput", () => {
  it("requires a name", () => {
    expect(validateHospitalInput({ name: "" }).ok).toBe(false);
  });
  it("trims and passes valid input", () => {
    const r = validateHospitalInput({ name: "  A동물병원 ", contact: " 010 " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: "A동물병원", contact: "010" });
  });
});

describe("validateOwnerInput", () => {
  it("requires a name", () => {
    expect(validateOwnerInput({ name: "  " }).ok).toBe(false);
  });
  it("nulls empty contact", () => {
    const r = validateOwnerInput({ name: "홍길동", contact: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.contact).toBeNull();
  });
});

describe("validatePatientInput", () => {
  it("requires name and owner_id", () => {
    expect(validatePatientInput({ name: "", owner_id: "x" }).ok).toBe(false);
    expect(validatePatientInput({ name: "초코", owner_id: "" }).ok).toBe(false);
  });
  it("maps empty referring_hospital_id to null", () => {
    const r = validatePatientInput({ name: "초코", owner_id: "o1", referring_hospital_id: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.referring_hospital_id).toBeNull();
  });
});

describe("buildPatientSearch", () => {
  it("returns null for blank query", () => {
    expect(buildPatientSearch("   ")).toBeNull();
  });
  it("builds an ilike OR across name and species", () => {
    expect(buildPatientSearch("초코")).toBe("name.ilike.%초코%,species.ilike.%초코%");
  });
  it("escapes commas and parens that would break the or() filter", () => {
    expect(buildPatientSearch("a,b")).toBe("name.ilike.%a b%,species.ilike.%a b%");
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `npm test`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `src/lib/validation/hospital.ts`**

```ts
export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateHospitalInput(input: {
  name: string;
  contact?: string;
}): Validated<{ name: string; contact: string | null }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "병원명을 입력하세요." };
  const contact = (input.contact ?? "").trim();
  return { ok: true, value: { name, contact: contact || null } };
}
```

- [ ] **Step 4: Implement `src/lib/validation/owner.ts`**

```ts
import type { Validated } from "./hospital";

export function validateOwnerInput(input: {
  name: string;
  contact?: string;
}): Validated<{ name: string; contact: string | null }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "보호자 이름을 입력하세요." };
  const contact = (input.contact ?? "").trim();
  return { ok: true, value: { name, contact: contact || null } };
}
```

- [ ] **Step 5: Implement `src/lib/validation/patient.ts`**

```ts
import type { Validated } from "./hospital";

export type PatientValues = {
  name: string;
  owner_id: string;
  referring_hospital_id: string | null;
  species: string | null;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  note: string | null;
};

function clean(v: string | undefined | null): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

export function validatePatientInput(input: {
  name: string;
  owner_id: string;
  referring_hospital_id?: string;
  species?: string;
  breed?: string;
  sex?: string;
  birth_date?: string;
  note?: string;
}): Validated<PatientValues> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "환자 이름을 입력하세요." };
  const owner_id = (input.owner_id ?? "").trim();
  if (!owner_id) return { ok: false, error: "보호자를 선택하세요." };
  return {
    ok: true,
    value: {
      name,
      owner_id,
      referring_hospital_id: clean(input.referring_hospital_id),
      species: clean(input.species),
      breed: clean(input.breed),
      sex: clean(input.sex),
      birth_date: clean(input.birth_date),
      note: clean(input.note),
    },
  };
}

// Builds the value for supabase `.or(...)`. Commas/parens are special in the
// PostgREST or() grammar, so strip them from the user term to stay safe.
export function buildPatientSearch(query: string): string | null {
  const q = (query ?? "").trim();
  if (!q) return null;
  const safe = q.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  return `name.ilike.%${safe}%,species.ilike.%${safe}%`;
}
```

- [ ] **Step 6: Run — verify PASS**

Run: `npm test`
Expected: PASS (roles + validation).

- [ ] **Step 7: Commit**

```bash
git add src/lib/validation tests/validation.test.ts
git commit -m "feat: input validation and patient search helpers (tested)"
```

---

## Task 2: Shared UI components

**Files:**
- Create: `src/components/FormField.tsx`, `src/components/SubmitButton.tsx`, `src/components/DataTable.tsx`

- [ ] **Step 1: `FormField.tsx`** (label + input/select/textarea via children)

```tsx
export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "w-full rounded border px-3 py-2 text-sm";
```

- [ ] **Step 2: `SubmitButton.tsx`** (client component with pending state)

```tsx
"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {pending ? "저장 중…" : children}
    </button>
  );
}
```

- [ ] **Step 3: `DataTable.tsx`** (headers + rows; minimal)

```tsx
export function DataTable({
  headers,
  rows,
  empty = "데이터가 없습니다.",
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          {headers.map((h) => (
            <th key={h} className="py-2 pr-4 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i} className="border-b last:border-0">
            {cells.map((c, j) => (
              <td key={j} className="py-2 pr-4">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npm run build`
Expected: compiles.
```bash
git add src/components
git commit -m "feat: shared FormField, SubmitButton, DataTable components"
```

---

## Task 3: Referring hospitals CRUD

**Files:**
- Create: `src/app/(app)/hospitals/actions.ts`, `src/app/(app)/hospitals/page.tsx`, `src/app/(app)/hospitals/[id]/edit/page.tsx`

- [ ] **Step 1: Actions** — `src/app/(app)/hospitals/actions.ts`

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { validateHospitalInput } from "@/lib/validation/hospital";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createHospital(formData: FormData) {
  const v = validateHospitalInput({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });
  if (!v.ok) redirect("/hospitals?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("referring_hospital").insert(v.value);
  if (error) redirect("/hospitals?error=" + encodeURIComponent(error.message));
  revalidatePath("/hospitals");
  redirect("/hospitals");
}

export async function updateHospital(id: string, formData: FormData) {
  const v = validateHospitalInput({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });
  if (!v.ok) redirect(`/hospitals/${id}/edit?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("referring_hospital")
    .update(v.value)
    .eq("id", id);
  if (error) redirect(`/hospitals/${id}/edit?error=` + encodeURIComponent(error.message));
  revalidatePath("/hospitals");
  redirect("/hospitals");
}

export async function deleteHospital(id: string) {
  const supabase = await createClient();
  await supabase.from("referring_hospital").delete().eq("id", id);
  revalidatePath("/hospitals");
}
```

- [ ] **Step 2: List + create page** — `src/app/(app)/hospitals/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DataTable } from "@/components/DataTable";
import { createHospital, deleteHospital } from "./actions";
import Link from "next/link";

export default async function HospitalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: hospitals } = await supabase
    .from("referring_hospital")
    .select("id, name, contact")
    .order("name");

  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">1차 병원</h1>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable
          headers={["병원명", "연락처", ""]}
          rows={(hospitals ?? []).map((h) => [
            h.name,
            h.contact ?? "-",
            <span key="a" className="flex gap-3">
              <Link href={`/hospitals/${h.id}/edit`} className="text-blue-600">
                수정
              </Link>
              <form action={deleteHospital.bind(null, h.id)}>
                <button className="text-red-600">삭제</button>
              </form>
            </span>,
          ])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">병원 추가</h2>
        <form action={createHospital} className="space-y-3">
          <FormField label="병원명">
            <input name="name" required className={inputClass} />
          </FormField>
          <FormField label="연락처">
            <input name="contact" className={inputClass} />
          </FormField>
          <SubmitButton>추가</SubmitButton>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Edit page** — `src/app/(app)/hospitals/[id]/edit/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { FormField, inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { updateHospital } from "../../actions";
import { notFound } from "next/navigation";

export default async function EditHospital({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: h } = await supabase
    .from("referring_hospital")
    .select("id, name, contact")
    .eq("id", id)
    .single();
  if (!h) notFound();

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">1차 병원 수정</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={updateHospital.bind(null, h.id)} className="space-y-3">
        <FormField label="병원명">
          <input name="name" defaultValue={h.name} required className={inputClass} />
        </FormField>
        <FormField label="연락처">
          <input name="contact" defaultValue={h.contact ?? ""} className={inputClass} />
        </FormField>
        <SubmitButton>저장</SubmitButton>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Add nav link** — in `src/app/(app)/layout.tsx`, add `<Link href="/hospitals">1차병원</Link>` to the nav.

- [ ] **Step 5: Verify via preview**

`preview_start` → login → go to `/hospitals` → add "A동물병원 / 010-1111" → appears in list → edit → delete. Confirm each via snapshot.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/hospitals src/app/\(app\)/layout.tsx
git commit -m "feat: referring hospital CRUD"
```

---

## Task 4: Owners CRUD

**Files:**
- Create: `src/app/(app)/owners/actions.ts`, `src/app/(app)/owners/page.tsx`, `src/app/(app)/owners/[id]/edit/page.tsx`

- [ ] **Step 1: Actions** — mirror Task 3 using `owner` table and `validateOwnerInput`; redirect targets `/owners`.

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { validateOwnerInput } from "@/lib/validation/owner";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createOwner(formData: FormData) {
  const v = validateOwnerInput({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });
  if (!v.ok) redirect("/owners?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("owner").insert(v.value);
  if (error) redirect("/owners?error=" + encodeURIComponent(error.message));
  revalidatePath("/owners");
  redirect("/owners");
}

export async function updateOwner(id: string, formData: FormData) {
  const v = validateOwnerInput({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
  });
  if (!v.ok) redirect(`/owners/${id}/edit?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("owner").update(v.value).eq("id", id);
  if (error) redirect(`/owners/${id}/edit?error=` + encodeURIComponent(error.message));
  revalidatePath("/owners");
  redirect("/owners");
}

export async function deleteOwner(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("owner").delete().eq("id", id);
  if (error) redirect("/owners?error=" + encodeURIComponent("보호자에 연결된 환자가 있어 삭제할 수 없습니다."));
  revalidatePath("/owners");
}
```

Note: `owner` is referenced by `patient` with `on delete restrict`, so deletes fail while a patient is linked — the action surfaces a friendly message.

- [ ] **Step 2: List + create page** — `src/app/(app)/owners/page.tsx` (copy Task 3 list/create structure; table headers `["이름","연락처",""]`, link `/owners/{id}/edit`, action `createOwner`/`deleteOwner`).

- [ ] **Step 3: Edit page** — `src/app/(app)/owners/[id]/edit/page.tsx` (copy Task 3 edit; fields 이름/연락처; `updateOwner`).

- [ ] **Step 4: Add nav link** `/owners` labeled "보호자".

- [ ] **Step 5: Verify via preview** — create/edit/delete an owner; confirm restrict message appears if you later try to delete an owner with a patient (revisit after Task 6).

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: owner CRUD"
```

---

## Task 5: Patient create (with owner + hospital pickers)

**Files:**
- Create: `src/app/(app)/patients/actions.ts`, `src/app/(app)/patients/new/page.tsx`

- [ ] **Step 1: Actions** — `src/app/(app)/patients/actions.ts`

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { validatePatientInput } from "@/lib/validation/patient";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function readPatientForm(formData: FormData) {
  return validatePatientInput({
    name: String(formData.get("name") ?? ""),
    owner_id: String(formData.get("owner_id") ?? ""),
    referring_hospital_id: String(formData.get("referring_hospital_id") ?? ""),
    species: String(formData.get("species") ?? ""),
    breed: String(formData.get("breed") ?? ""),
    sex: String(formData.get("sex") ?? ""),
    birth_date: String(formData.get("birth_date") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
}

export async function createPatient(formData: FormData) {
  const v = readPatientForm(formData);
  if (!v.ok) redirect("/patients/new?error=" + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient")
    .insert(v.value)
    .select("id")
    .single();
  if (error) redirect("/patients/new?error=" + encodeURIComponent(error.message));
  revalidatePath("/patients");
  redirect(`/patients/${data!.id}`);
}

export async function updatePatient(id: string, formData: FormData) {
  const v = readPatientForm(formData);
  if (!v.ok) redirect(`/patients/${id}/edit?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { error } = await supabase.from("patient").update(v.value).eq("id", id);
  if (error) redirect(`/patients/${id}/edit?error=` + encodeURIComponent(error.message));
  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}`);
}

export async function deletePatient(id: string) {
  const supabase = await createClient();
  await supabase.from("patient").delete().eq("id", id);
  revalidatePath("/patients");
  redirect("/patients");
}
```

- [ ] **Step 2: Reusable form fields component** — `src/app/(app)/patients/PatientFields.tsx` (server component; renders inputs + owner/hospital selects; takes options + optional defaults).

```tsx
import { FormField, inputClass } from "@/components/FormField";

type Option = { id: string; name: string };
type Defaults = Partial<{
  name: string; owner_id: string; referring_hospital_id: string | null;
  species: string; breed: string; sex: string; birth_date: string; note: string;
}>;

export function PatientFields({
  owners, hospitals, d = {},
}: { owners: Option[]; hospitals: Option[]; d?: Defaults }) {
  return (
    <div className="space-y-3">
      <FormField label="이름">
        <input name="name" required defaultValue={d.name ?? ""} className={inputClass} />
      </FormField>
      <FormField label="보호자">
        <select name="owner_id" required defaultValue={d.owner_id ?? ""} className={inputClass}>
          <option value="">— 선택 —</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </FormField>
      <FormField label="의뢰 1차병원 (선택)">
        <select name="referring_hospital_id" defaultValue={d.referring_hospital_id ?? ""} className={inputClass}>
          <option value="">— 없음 —</option>
          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="종"><input name="species" defaultValue={d.species ?? ""} className={inputClass} /></FormField>
        <FormField label="품종"><input name="breed" defaultValue={d.breed ?? ""} className={inputClass} /></FormField>
        <FormField label="성별"><input name="sex" defaultValue={d.sex ?? ""} className={inputClass} /></FormField>
        <FormField label="생일"><input type="date" name="birth_date" defaultValue={d.birth_date ?? ""} className={inputClass} /></FormField>
      </div>
      <FormField label="비고">
        <textarea name="note" defaultValue={d.note ?? ""} className={inputClass} rows={3} />
      </FormField>
    </div>
  );
}
```

- [ ] **Step 3: New page** — `src/app/(app)/patients/new/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { PatientFields } from "../PatientFields";
import { createPatient } from "../actions";

export default async function NewPatient({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: owners }, { data: hospitals }] = await Promise.all([
    supabase.from("owner").select("id, name").order("name"),
    supabase.from("referring_hospital").select("id, name").order("name"),
  ]);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">환자 등록</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={createPatient} className="space-y-3">
        <PatientFields owners={owners ?? []} hospitals={hospitals ?? []} />
        <SubmitButton>등록</SubmitButton>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build` → compiles.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: patient create with owner/hospital pickers"
```

---

## Task 6: Patient list with search

**Files:**
- Create: `src/app/(app)/patients/page.tsx`
- Modify: `src/app/(app)/layout.tsx` (the `환자` link already points to `/patients`)

- [ ] **Step 1: List page with search** — `src/app/(app)/patients/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { buildPatientSearch } from "@/lib/validation/patient";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("patient")
    .select("id, name, species, breed, owner:owner_id(name), hospital:referring_hospital_id(name)")
    .order("created_at", { ascending: false });

  const or = buildPatientSearch(q);
  if (or) query = query.or(or);
  const { data: patients } = await query;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">환자</h1>
        <Link href="/patients/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          환자 등록
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="이름 또는 종으로 검색"
          className="w-64 rounded border px-3 py-2 text-sm"
        />
        <button className="rounded border px-3 py-2 text-sm">검색</button>
      </form>

      <DataTable
        headers={["이름", "종/품종", "보호자", "의뢰 병원"]}
        empty="환자가 없습니다."
        rows={(patients ?? []).map((p) => [
          <Link key="n" href={`/patients/${p.id}`} className="text-blue-600">
            {p.name}
          </Link>,
          [p.species, p.breed].filter(Boolean).join(" / ") || "-",
          // @ts-expect-error supabase embeds a related row object
          p.owner?.name ?? "-",
          // @ts-expect-error supabase embeds a related row object
          p.hospital?.name ?? "-",
        ])}
      />
    </div>
  );
}
```

Note on the embedded-relation typings: `select("...owner:owner_id(name)...")` returns nested objects that the generated types express as arrays in some versions. If TS complains, type the row explicitly or map with a small local type instead of `@ts-expect-error`. Prefer a clean local type if the ts-expect-error does not hold.

- [ ] **Step 2: Verify via preview**

Login → `/patients` → register a patient (owner/hospital created in Tasks 3-4) → it appears → search by name filters → search by species filters → blank search shows all.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat: searchable patient list"
```

---

## Task 7: Patient detail + edit

**Files:**
- Create: `src/app/(app)/patients/[id]/page.tsx`, `src/app/(app)/patients/[id]/edit/page.tsx`

- [ ] **Step 1: Detail page** — `src/app/(app)/patients/[id]/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { deletePatient } from "../actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PatientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("patient")
    .select(
      "id, name, species, breed, sex, birth_date, note, owner:owner_id(name, contact), hospital:referring_hospital_id(name, contact)"
    )
    .eq("id", id)
    .single();
  if (!p) notFound();

  // owner/hospital are embedded relation objects
  const owner = p.owner as unknown as { name: string; contact: string | null } | null;
  const hospital = p.hospital as unknown as { name: string; contact: string | null } | null;

  const rows: [string, string][] = [
    ["종/품종", [p.species, p.breed].filter(Boolean).join(" / ") || "-"],
    ["성별", p.sex ?? "-"],
    ["생일", p.birth_date ?? "-"],
    ["보호자", owner ? `${owner.name}${owner.contact ? ` (${owner.contact})` : ""}` : "-"],
    ["의뢰 병원", hospital ? `${hospital.name}${hospital.contact ? ` (${hospital.contact})` : ""}` : "-"],
    ["비고", p.note ?? "-"],
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <div className="flex gap-3 text-sm">
          <Link href={`/patients/${p.id}/edit`} className="text-blue-600">
            수정
          </Link>
          <form action={deletePatient.bind(null, p.id)}>
            <button className="text-red-600">삭제</button>
          </form>
        </div>
      </div>

      <dl className="divide-y rounded border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex px-4 py-2 text-sm">
            <dt className="w-28 shrink-0 text-gray-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-2 text-lg font-medium">진료 회차</h2>
        <p className="text-sm text-gray-500">Plan 03에서 구현됩니다.</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Edit page** — `src/app/(app)/patients/[id]/edit/page.tsx` (loads patient + owner/hospital options, reuses `PatientFields` with defaults, calls `updatePatient`).

```tsx
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { PatientFields } from "../../PatientFields";
import { updatePatient } from "../../actions";
import { notFound } from "next/navigation";

export default async function EditPatient({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: p }, { data: owners }, { data: hospitals }] = await Promise.all([
    supabase.from("patient").select("*").eq("id", id).single(),
    supabase.from("owner").select("id, name").order("name"),
    supabase.from("referring_hospital").select("id, name").order("name"),
  ]);
  if (!p) notFound();

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">환자 수정</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={updatePatient.bind(null, p.id)} className="space-y-3">
        <PatientFields
          owners={owners ?? []}
          hospitals={hospitals ?? []}
          d={{
            name: p.name,
            owner_id: p.owner_id,
            referring_hospital_id: p.referring_hospital_id,
            species: p.species ?? "",
            breed: p.breed ?? "",
            sex: p.sex ?? "",
            birth_date: p.birth_date ?? "",
            note: p.note ?? "",
          }}
        />
        <SubmitButton>저장</SubmitButton>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify via preview**

Open a patient from the list → detail shows fields + owner + hospital → 수정 changes a field and persists → 삭제 removes and returns to list.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: patient detail and edit"
```

---

## Task 8: Regression sweep + finish

- [ ] **Step 1: Full test + build**

Run: `npm test` (roles + validation pass) and `npm run build` (compiles, no type errors).

- [ ] **Step 2: RLS still intact**

Re-run `supabase/tests/rls.sql` (via psql or Supabase MCP `execute_sql`) → `RLS TESTS PASSED`. Confirms Plan 02 did not weaken scoping.

- [ ] **Step 3: Preview smoke test**

Login → create hospital → create owner → create patient referencing both → search → open detail → edit → confirm. Then verify deleting an owner that has a patient shows the friendly restrict message.

- [ ] **Step 4: Finish**

Use superpowers:finishing-a-development-branch to merge `feat/patient-management` into `main`.

---

## Done criteria (Plan 02)

- `npm test` passes (roles + validation).
- Staff can CRUD referring hospitals, owners, and patients through the UI.
- Patient list searches by name/species; blank query lists all.
- Patient detail shows owner + referring hospital; edit persists; delete works.
- Owner delete is blocked with a clear message while a patient references it.
- RLS test still passes.

## Next
- **Plan 03 — 진료 기록**: visits (text), drug master, prescriptions, medical image + media upload (Supabase Storage).
