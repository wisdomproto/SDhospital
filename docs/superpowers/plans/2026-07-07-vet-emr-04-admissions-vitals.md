# Vet EMR — Plan 04: Admissions & Vitals Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff open and close admissions (입원) for a patient, record periodic vitals during an admission, and view those vitals as a time-series chart.

**Architecture:** The `admission` and `vital` tables + RLS already exist (Plan 01). This plan adds Server Actions for admission lifecycle and vital entry, an admission detail page, and a **Recharts** client-component chart fed by server-loaded vitals. Pure validators are unit-tested; screens verified in the preview browser. Follows Plan 02/03 conventions.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (RLS), Recharts, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-vet-emr-design.md`
**Prereq:** Plan 03 merged. Reuses `@/components/*`, `@/lib/validation/*` pattern.

---

## Conventions (unchanged)

- Writes = `"use server"` actions; validate with a pure helper; `revalidatePath` + `redirect`.
- Reads = Server Components via `await createClient()`.
- Charts must be a Client Component (`"use client"`); the page (server) fetches rows and passes plain arrays down.
- Verify forms in preview with `form.requestSubmit()`. Staff login `staff@sdhospital.test` / `sdhospital123!`.
- Commit after each task. Feature branch: `feat/admissions-vitals`.

## Data notes (existing schema)

- `admission`: `patient_id`, `admitted_at date` (default today), `discharged_at date` (nullable), `status` in `('admitted','discharged')`, `note`.
- `vital`: `admission_id`, `measured_at timestamptz` (default now), `temperature numeric`, `heart_rate int`, `resp_rate int`, `systolic int`, `diastolic int`, `note`, `recorded_by`.

## File Structure (created by this plan)

```
src/lib/validation/
  admission.ts                  # validateAdmissionInput
  vital.ts                      # validateVitalInput (+ parseNum helper)
src/app/(app)/patients/[id]/
  page.tsx                      # MODIFY: add "입원" list + admit form
  admissions/actions.ts         # createAdmission (from patient detail)
src/app/(app)/admissions/[admissionId]/
  page.tsx                      # admission detail: info, discharge, vitals table + chart
  actions.ts                    # discharge, addVital, deleteVital
  VitalChart.tsx                # "use client" Recharts time-series
tests/
  validation.test.ts            # MODIFY: add admission/vital cases
```

Admission create lives under the patient route (staff admit from the patient); the admission **detail** is a top-level route `/admissions/[admissionId]` (stable home for vitals + chart), mirroring how visits were done in Plan 03.

---

## Task 1: Validators for admission + vital (TDD)

**Files:**
- Create: `src/lib/validation/admission.ts`, `src/lib/validation/vital.ts`
- Modify: `tests/validation.test.ts`

- [ ] **Step 1: Add failing tests** (append to `tests/validation.test.ts`)

```ts
import { validateAdmissionInput } from "@/lib/validation/admission";
import { validateVitalInput } from "@/lib/validation/vital";

describe("validateAdmissionInput", () => {
  it("requires patient_id", () => {
    expect(validateAdmissionInput({ patient_id: "" }).ok).toBe(false);
  });
  it("defaults admitted_at when blank, nulls note", () => {
    const r = validateAdmissionInput({ patient_id: "p1", admitted_at: "", note: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.patient_id).toBe("p1");
      expect(typeof r.value.admitted_at).toBe("string"); // YYYY-MM-DD
      expect(r.value.note).toBeNull();
    }
  });
});

describe("validateVitalInput", () => {
  it("requires admission_id", () => {
    expect(validateVitalInput({ admission_id: "", temperature: "38" }).ok).toBe(false);
  });
  it("requires at least one measurement", () => {
    const r = validateVitalInput({ admission_id: "a1" });
    expect(r.ok).toBe(false);
  });
  it("parses numbers and nulls blanks", () => {
    const r = validateVitalInput({
      admission_id: "a1",
      temperature: "38.5",
      heart_rate: "120",
      resp_rate: "",
      systolic: "130",
      diastolic: "",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.temperature).toBe(38.5);
      expect(r.value.heart_rate).toBe(120);
      expect(r.value.resp_rate).toBeNull();
      expect(r.value.systolic).toBe(130);
      expect(r.value.diastolic).toBeNull();
    }
  });
  it("rejects a non-numeric measurement", () => {
    expect(validateVitalInput({ admission_id: "a1", heart_rate: "fast" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify FAIL** — `npm test`.

- [ ] **Step 3: Implement `src/lib/validation/admission.ts`**

```ts
import type { Validated } from "./hospital";

export type AdmissionValues = {
  patient_id: string;
  admitted_at: string; // YYYY-MM-DD
  note: string | null;
};

export function validateAdmissionInput(input: {
  patient_id: string;
  admitted_at?: string;
  note?: string;
}): Validated<AdmissionValues> {
  const patient_id = (input.patient_id ?? "").trim();
  if (!patient_id) return { ok: false, error: "환자 정보가 없습니다." };
  const admitted_at = (input.admitted_at ?? "").trim() || new Date().toISOString().slice(0, 10);
  const note = (input.note ?? "").trim() || null;
  return { ok: true, value: { patient_id, admitted_at, note } };
}
```

- [ ] **Step 4: Implement `src/lib/validation/vital.ts`**

```ts
import type { Validated } from "./hospital";

export type VitalValues = {
  admission_id: string;
  temperature: number | null;
  heart_rate: number | null;
  resp_rate: number | null;
  systolic: number | null;
  diastolic: number | null;
  note: string | null;
};

// Parse an optional numeric field: blank -> null; non-numeric -> error.
function parseNum(v: string | undefined, label: string):
  | { ok: true; value: number | null }
  | { ok: false; error: string } {
  const t = (v ?? "").trim();
  if (!t) return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, error: `${label} 값이 올바르지 않습니다.` };
  return { ok: true, value: n };
}

export function validateVitalInput(input: {
  admission_id: string;
  temperature?: string;
  heart_rate?: string;
  resp_rate?: string;
  systolic?: string;
  diastolic?: string;
  note?: string;
}): Validated<VitalValues> {
  const admission_id = (input.admission_id ?? "").trim();
  if (!admission_id) return { ok: false, error: "입원 정보가 없습니다." };

  const fields: [keyof VitalValues, string | undefined, string][] = [
    ["temperature", input.temperature, "체온"],
    ["heart_rate", input.heart_rate, "심박수"],
    ["resp_rate", input.resp_rate, "호흡수"],
    ["systolic", input.systolic, "수축기 혈압"],
    ["diastolic", input.diastolic, "이완기 혈압"],
  ];

  const out: Record<string, number | null> = {};
  let anyPresent = false;
  for (const [key, raw, label] of fields) {
    const p = parseNum(raw, label);
    if (!p.ok) return { ok: false, error: p.error };
    out[key as string] = p.value;
    if (p.value !== null) anyPresent = true;
  }
  if (!anyPresent) return { ok: false, error: "측정값을 하나 이상 입력하세요." };

  return {
    ok: true,
    value: {
      admission_id,
      temperature: out.temperature,
      heart_rate: out.heart_rate,
      resp_rate: out.resp_rate,
      systolic: out.systolic,
      diastolic: out.diastolic,
      note: (input.note ?? "").trim() || null,
    },
  };
}
```

- [ ] **Step 5: Run — verify PASS** — `npm test`.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: validators for admission and vital (tested)"
```

---

## Task 2: Admission lifecycle — create/list on patient, admission detail, discharge

**Files:**
- Create: `src/app/(app)/patients/[id]/admissions/actions.ts`, `src/app/(app)/admissions/[admissionId]/page.tsx`, `src/app/(app)/admissions/[admissionId]/actions.ts`
- Modify: `src/app/(app)/patients/[id]/page.tsx` (add an 입원 section)

- [ ] **Step 1: Create-admission action** — `src/app/(app)/patients/[id]/admissions/actions.ts`

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { validateAdmissionInput } from "@/lib/validation/admission";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createAdmission(patientId: string, formData: FormData) {
  const v = validateAdmissionInput({
    patient_id: patientId,
    admitted_at: String(formData.get("admitted_at") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(`/patients/${patientId}?error=` + encodeURIComponent(v.error));
  const supabase = await createClient();
  const { data, error } = await supabase.from("admission").insert(v.value).select("id").single();
  if (error) redirect(`/patients/${patientId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/patients/${patientId}`);
  redirect(`/admissions/${data!.id}`);
}
```

- [ ] **Step 2: Discharge action** — `src/app/(app)/admissions/[admissionId]/actions.ts`

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function discharge(admissionId: string, formData: FormData) {
  const raw = String(formData.get("discharged_at") ?? "").trim();
  const discharged_at = raw || new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  await supabase
    .from("admission")
    .update({ discharged_at, status: "discharged" })
    .eq("id", admissionId);
  revalidatePath(`/admissions/${admissionId}`);
}

export async function reopenAdmission(admissionId: string) {
  const supabase = await createClient();
  await supabase
    .from("admission")
    .update({ discharged_at: null, status: "admitted" })
    .eq("id", admissionId);
  revalidatePath(`/admissions/${admissionId}`);
}
```

- [ ] **Step 3: Patient detail — 입원 section.** In `patients/[id]/page.tsx`, fetch admissions and render a list + admit form (place it after the 진료 회차 section):

```tsx
// import { createAdmission } from "./admissions/actions";
// fetch:
//   const { data: admissions } = await supabase
//     .from("admission").select("id, admitted_at, discharged_at, status")
//     .eq("patient_id", id).order("admitted_at", { ascending: false });

<section className="space-y-4">
  <h2 className="text-lg font-medium">입원</h2>
  <DataTable
    headers={["입원일", "퇴원일", "상태", ""]}
    empty="입원 이력이 없습니다."
    rows={(admissions ?? []).map((a) => [
      a.admitted_at,
      a.discharged_at ?? "-",
      a.status === "admitted" ? "입원중" : "퇴원",
      <Link key="o" href={`/admissions/${a.id}`} className="text-blue-600">열기</Link>,
    ])}
  />
  <form action={createAdmission.bind(null, p.id)} className="grid max-w-md grid-cols-2 gap-3">
    <FormField label="입원일"><input type="date" name="admitted_at" className={inputClass} /></FormField>
    <div className="col-span-2">
      <FormField label="비고"><input name="note" className={inputClass} /></FormField>
    </div>
    <div className="col-span-2"><SubmitButton>입원 등록</SubmitButton></div>
  </form>
</section>
```

- [ ] **Step 4: Admission detail page (info + discharge control; vitals added in Task 3-4)** — `src/app/(app)/admissions/[admissionId]/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { discharge, reopenAdmission } from "./actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdmissionDetail({
  params,
}: {
  params: Promise<{ admissionId: string }>;
}) {
  const { admissionId } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status, note, patient:patient_id(id, name)")
    .eq("id", admissionId)
    .single();
  if (!a) notFound();
  const patient = a.patient as unknown as { id: string; name: string };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href={`/patients/${patient.id}`} className="text-sm text-blue-600">← {patient.name}</Link>
        <h1 className="mt-1 text-xl font-semibold">
          입원 {a.admitted_at} {a.status === "admitted" ? "· 입원중" : `· 퇴원 ${a.discharged_at ?? ""}`}
        </h1>
      </div>

      <section className="space-y-2">
        {a.status === "admitted" ? (
          <form action={discharge.bind(null, a.id)} className="flex items-end gap-2">
            <label className="text-sm">
              <span className="mr-2 text-gray-600">퇴원일</span>
              <input type="date" name="discharged_at" className={inputClass + " inline-block w-40"} />
            </label>
            <SubmitButton>퇴원 처리</SubmitButton>
          </form>
        ) : (
          <form action={reopenAdmission.bind(null, a.id)}>
            <button className="text-sm text-blue-600">입원중으로 되돌리기</button>
          </form>
        )}
      </section>

      {/* Vitals table + chart (Tasks 3-4) mounted here */}
    </div>
  );
}
```

- [ ] **Step 5: Verify via preview** — open a patient → 입원 등록 → redirected to `/admissions/{id}` → 퇴원 처리 sets status to 퇴원 → 되돌리기 restores 입원중. Patient detail lists the admission with correct status.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: admission lifecycle — admit, list on patient, discharge/reopen"
```

---

## Task 3: Vital entry + list

**Files:**
- Modify: `src/app/(app)/admissions/[admissionId]/actions.ts` (addVital, deleteVital), `src/app/(app)/admissions/[admissionId]/page.tsx` (entry form + table)

- [ ] **Step 1: Actions** — append to `admissions/[admissionId]/actions.ts`

```ts
import { validateVitalInput } from "@/lib/validation/vital";
import { redirect } from "next/navigation";

export async function addVital(admissionId: string, formData: FormData) {
  const v = validateVitalInput({
    admission_id: admissionId,
    temperature: String(formData.get("temperature") ?? ""),
    heart_rate: String(formData.get("heart_rate") ?? ""),
    resp_rate: String(formData.get("resp_rate") ?? ""),
    systolic: String(formData.get("systolic") ?? ""),
    diastolic: String(formData.get("diastolic") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!v.ok) redirect(`/admissions/${admissionId}?error=` + encodeURIComponent(v.error));

  const measuredRaw = String(formData.get("measured_at") ?? "").trim();
  const row: Record<string, unknown> = { ...v.value };
  if (measuredRaw) row.measured_at = new Date(measuredRaw).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("vital").insert(row);
  if (error) redirect(`/admissions/${admissionId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/admissions/${admissionId}`);
}

export async function deleteVital(admissionId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("vital").delete().eq("id", id);
  revalidatePath(`/admissions/${admissionId}`);
}
```

- [ ] **Step 2: Fetch vitals + render table and entry form** in `admissions/[admissionId]/page.tsx`:

```tsx
// import { addVital, deleteVital } from "./actions";
// import { DataTable } from "@/components/DataTable";
// import { FormField } from "@/components/FormField";
// fetch (ascending for chart, table can reverse):
//   const { data: vitals } = await supabase
//     .from("vital")
//     .select("id, measured_at, temperature, heart_rate, resp_rate, systolic, diastolic")
//     .eq("admission_id", admissionId)
//     .order("measured_at", { ascending: true });

<section className="space-y-3">
  <h2 className="text-lg font-medium">바이털</h2>
  <DataTable
    headers={["측정시각", "체온", "심박", "호흡", "수축기", "이완기", ""]}
    empty="측정 기록이 없습니다."
    rows={[...(vitals ?? [])].reverse().map((v) => [
      new Date(v.measured_at).toLocaleString("ko-KR"),
      v.temperature ?? "-",
      v.heart_rate ?? "-",
      v.resp_rate ?? "-",
      v.systolic ?? "-",
      v.diastolic ?? "-",
      <form key="d" action={deleteVital.bind(null, a.id, v.id)}>
        <button className="text-red-600">삭제</button>
      </form>,
    ])}
  />

  <form action={addVital.bind(null, a.id)} className="grid grid-cols-3 gap-2 md:grid-cols-6">
    <FormField label="측정시각"><input type="datetime-local" name="measured_at" className={inputClass} /></FormField>
    <FormField label="체온"><input name="temperature" inputMode="decimal" className={inputClass} /></FormField>
    <FormField label="심박"><input name="heart_rate" inputMode="numeric" className={inputClass} /></FormField>
    <FormField label="호흡"><input name="resp_rate" inputMode="numeric" className={inputClass} /></FormField>
    <FormField label="수축기"><input name="systolic" inputMode="numeric" className={inputClass} /></FormField>
    <FormField label="이완기"><input name="diastolic" inputMode="numeric" className={inputClass} /></FormField>
    <div className="col-span-3 md:col-span-6"><SubmitButton>바이털 추가</SubmitButton></div>
  </form>
</section>
```

- [ ] **Step 3: Verify via preview** — on an admission, add a vital (temp 38.5 / HR 120) → appears in table; add a 2nd; delete one; try submitting an empty form → validation error "측정값을 하나 이상 입력하세요."; try `heart_rate=abc` → "심박수 값이 올바르지 않습니다."

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: vital entry and list on an admission"
```

---

## Task 4: Vital time-series chart (Recharts)

**Files:**
- Create: `src/app/(app)/admissions/[admissionId]/VitalChart.tsx`
- Modify: `src/app/(app)/admissions/[admissionId]/page.tsx` (mount the chart)

- [ ] **Step 1: Install Recharts**

```bash
npm install recharts
```
If npm reports a React 19 peer-dependency conflict, retry with `npm install recharts --legacy-peer-deps` (Recharts ≥2.15 supports React 19).

- [ ] **Step 2: Chart component** — `src/app/(app)/admissions/[admissionId]/VitalChart.tsx`

```tsx
"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export type VitalPoint = {
  measured_at: string;
  temperature: number | null;
  heart_rate: number | null;
  resp_rate: number | null;
  systolic: number | null;
  diastolic: number | null;
};

export function VitalChart({ data }: { data: VitalPoint[] }) {
  if (data.length === 0) return null;
  const rows = data.map((d) => ({
    t: new Date(d.measured_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    temperature: d.temperature,
    heart_rate: d.heart_rate,
    resp_rate: d.resp_rate,
    systolic: d.systolic,
    diastolic: d.diastolic,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} />
          {/* left axis: HR/RR/BP; right axis: temperature */}
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" domain={[35, 42]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line yAxisId="right" type="monotone" dataKey="temperature" name="체온" stroke="#e11d48" connectNulls dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="heart_rate" name="심박" stroke="#2563eb" connectNulls dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="resp_rate" name="호흡" stroke="#16a34a" connectNulls dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="systolic" name="수축기" stroke="#a855f7" connectNulls dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="diastolic" name="이완기" stroke="#f59e0b" connectNulls dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Mount chart** in `admissions/[admissionId]/page.tsx`, above the vitals table:

```tsx
// import { VitalChart } from "./VitalChart";
<section className="space-y-3">
  <h2 className="text-lg font-medium">바이털 추이</h2>
  <VitalChart data={(vitals ?? []).map((v) => ({
    measured_at: v.measured_at,
    temperature: v.temperature, heart_rate: v.heart_rate, resp_rate: v.resp_rate,
    systolic: v.systolic, diastolic: v.diastolic,
  }))} />
</section>
```

Place this section before the vitals table section from Task 3 (chart on top, table below).

- [ ] **Step 4: Verify via preview**

Add 3+ vitals with varying values, reload the admission page. Confirm:
- The chart container renders (`preview_snapshot` shows an SVG under 바이털 추이; or `preview_eval` returns `document.querySelectorAll('svg.recharts-surface').length >= 1`).
- Lines exist: `preview_eval` counts `.recharts-line` paths ≥ 2.
- `preview_screenshot` to capture the chart for the user.
(Recharts needs a sized container — the `h-72 w-full` wrapper provides it; if the chart is empty, confirm the container has non-zero height in `preview_inspect`.)

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: vital time-series chart (Recharts, dual-axis temp vs rates)"
```

---

## Task 5: Regression sweep + finish

- [ ] **Step 1:** `npm test` (all validators pass) and `npm run build` (compiles; Recharts client component builds).
- [ ] **Step 2:** Re-run `supabase/tests/rls.sql` (MCP `execute_sql`) → `RLS TESTS PASSED`. Optionally extend it to assert a referring_vet/owner sees only their patient's `admission`/`vital` rows.
- [ ] **Step 3:** Preview smoke: patient → 입원 등록 → add 3 vitals → chart renders → discharge → reopen → delete a vital.
- [ ] **Step 4:** Use superpowers:finishing-a-development-branch to merge `feat/admissions-vitals` into `main`.

---

## Done criteria (Plan 04)

- `npm test` passes (roles + all validators incl. admission/vital).
- Staff can: admit a patient, see admissions listed on the patient, open an admission, discharge/reopen it.
- Staff can add/list/delete vitals; empty or non-numeric entries are rejected with clear messages.
- Vitals render as a time-series chart (temperature on a right axis, HR/RR/BP on the left).
- RLS test still passes.

## Next
- **Plan 05 — 초대·외부 포털**: invite issue/redeem, read-only owner + referring-vet portal (patient records, visits, prescriptions, admissions/vitals, and signed-URL file access).
