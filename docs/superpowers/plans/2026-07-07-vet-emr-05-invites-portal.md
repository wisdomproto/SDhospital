# Vet EMR — Plan 05: Invites & External Portal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff issue invite links for a pet owner or a referring hospital; let those external users redeem an invite to create a read-only account; and give them a portal to view (only) their own patients' records — visits, prescriptions, admissions, vitals chart, and files.

**Architecture:** The `invite`/`profile` tables and per-table RLS already exist (Plan 01). This plan adds: (a) two `SECURITY DEFINER` Postgres functions — `invite_target` (preview an invite) and `redeem_invite` (atomically create the auth user + identity + scoped profile and consume the invite), so redemption needs no service-role key and no email round-trip; (b) a Storage read policy letting external roles mint signed URLs for **their** patients' files; (c) staff issuance UI; (d) a public `/invite/[token]` redemption page; (e) a read-only `/portal`. Access is enforced entirely by RLS — the portal is just a read-only view over the same rows.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + Auth + Storage + RLS), Recharts, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-vet-emr-design.md`
**Prereq:** Plan 04 merged.

---

## Security model (read first)

- **Redemption is capability-based:** possessing a valid, unused, unexpired token authorizes creating exactly one account bound to that invite's role + target (owner_id or referring_hospital_id). The token is a random UUID.
- **`redeem_invite` is `SECURITY DEFINER`** and callable by `anon`. It MUST validate the token (exists, not used, not expired) and email uniqueness before creating anything, and bind role/target strictly from the invite row (never from client input). The account it creates cannot escalate.
- **All viewing goes through existing RLS.** The portal never bypasses it. Storage signing gets a new policy that mirrors the table scoping.

## Conventions (unchanged)

- Writes = `"use server"` actions; `revalidatePath` + `redirect`. Reads = Server Components.
- Verify forms in preview with `form.requestSubmit()`. Staff login `staff@sdhospital.test` / `sdhospital123!`.
- Commit after each task. Feature branch: `feat/invites-portal`.

## File Structure (created by this plan)

```
supabase/migrations/
  0005_invites_portal.sql        # invite_target + redeem_invite fns; storage external-read policy
src/lib/
  invites.ts                     # newInviteToken(); inviteUrl(host, token)
  validation/invite.ts           # validateRedeemInput (email/password)
src/app/(app)/patients/[id]/
  page.tsx                       # MODIFY: "보호자 초대" section
  invites/actions.ts             # issueOwnerInvite, revokeInvite
src/app/(app)/hospitals/
  page.tsx                       # MODIFY: per-hospital "1차병원 초대" link column
  invites/actions.ts             # issueVetInvite, revokeInvite
src/app/invite/[token]/
  page.tsx                       # public redemption page
  actions.ts                     # redeemInvite (RPC + sign in)
src/app/portal/
  layout.tsx                     # external-user shell (role gate: owner/referring_vet)
  page.tsx                       # list: owner->pets, vet->referred patients
  patients/[id]/page.tsx         # read-only record (visits, rx, admissions, vitals+chart, files)
  PortalVitals.tsx               # reuse VitalChart for portal (client wrapper)
tests/
  validation.test.ts             # MODIFY: add validateRedeemInput cases
```

---

## Task 1: Migration — invite functions + storage external-read policy

**Files:**
- Create: `supabase/migrations/0005_invites_portal.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0005_invites_portal.sql — invite preview/redeem functions + storage external read

-- Preview an invite (safe for anon): role, a display label, and validity.
create or replace function invite_target(p_token text)
returns table(role text, label text, valid boolean)
language sql stable security definer set search_path = public as $$
  select i.role,
         coalesce(o.name, h.name, '') as label,
         (not i.used and (i.expires_at is null or i.expires_at > now())) as valid
  from invite i
  left join owner o on o.id = i.owner_id
  left join referring_hospital h on h.id = i.referring_hospital_id
  where i.token = p_token
$$;
grant execute on function invite_target(text) to anon, authenticated;

-- Atomically create a scoped read-only account and consume the invite.
create or replace function redeem_invite(p_token text, p_email text, p_password text)
returns void
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
  inv public.invite;
  new_id uuid := gen_random_uuid();
begin
  select * into inv from public.invite where token = p_token;
  if inv.id is null then raise exception 'invalid_invite'; end if;
  if inv.used then raise exception 'invite_used'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'invite_expired'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'weak_password'; end if;
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'email_taken';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', false, false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    new_id::text, new_id,
    jsonb_build_object('sub', new_id::text, 'email', lower(p_email), 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profile (id, role, owner_id, referring_hospital_id, name)
  values (new_id, inv.role, inv.owner_id, inv.referring_hospital_id, null);

  update public.invite set used = true where id = inv.id;
end;
$$;
grant execute on function redeem_invite(text, text, text) to anon, authenticated;

-- Storage: allow an external role to READ (and therefore sign) objects that
-- belong to a patient they are allowed to see. Path shape:
--   images/{patientId}/{visitId}/...   or   media/{patientId}/{visitId}/...
create or replace function can_read_patient_file(object_name text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare pid uuid;
begin
  if public.current_role_name() = 'staff' then
    return true;
  end if;
  begin
    pid := nullif(split_part(object_name, '/', 2), '')::uuid;
  exception when others then
    return false;
  end;
  if pid is null then return false; end if;
  return exists (
    select 1 from public.patient p
    where p.id = pid and (
      (public.current_role_name() = 'referring_vet' and p.referring_hospital_id = public.current_hospital_id())
      or (public.current_role_name() = 'owner' and p.owner_id = public.current_owner_id())
    )
  );
end;
$$;

create policy "patient_files_external_read"
on storage.objects for select
to authenticated
using (bucket_id = 'patient-files' and public.can_read_patient_file(name));
```

- [ ] **Step 2: Apply** — via Supabase MCP `apply_migration` (name `invites_portal`). Save the file too.

- [ ] **Step 3: Verify the functions and policy work (SQL, rolled back).** Run via MCP `execute_sql`:

```sql
begin;
insert into owner (id, name) values ('9f000000-0000-0000-0000-000000000001','Portal Owner');
insert into patient (id, owner_id, name) values ('9f000000-0000-0000-0000-0000000000a1','9f000000-0000-0000-0000-000000000001','PortalPet');
insert into invite (token, role, owner_id) values ('TESTTOKEN123', 'owner', '9f000000-0000-0000-0000-000000000001');
-- preview
select * from invite_target('TESTTOKEN123');           -- role=owner, label='Portal Owner', valid=true
-- redeem
select redeem_invite('TESTTOKEN123', 'portalowner@example.com', 'secretpw1');
-- profile + auth user created, invite consumed
select (select count(*) from auth.users where email='portalowner@example.com') as users,
       (select role from profile p join auth.users u on u.id=p.id where u.email='portalowner@example.com') as role,
       (select used from invite where token='TESTTOKEN123') as used;
-- second redeem must fail
do $$ begin
  begin perform redeem_invite('TESTTOKEN123','x@example.com','secretpw1'); raise exception 'should have failed';
  exception when others then null; end;
end $$;
rollback;
```
Expected: preview row valid; users=1, role=owner, used=true; the re-redeem raises (caught). If all hold, print a success marker.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(db): invite preview/redeem functions + storage external-read policy"
```

---

## Task 2: `src/lib` helpers + redeem validator (TDD)

**Files:**
- Create: `src/lib/invites.ts`, `src/lib/validation/invite.ts`
- Modify: `tests/validation.test.ts`

- [ ] **Step 1: Failing tests** (append)

```ts
import { validateRedeemInput } from "@/lib/validation/invite";

describe("validateRedeemInput", () => {
  it("requires a valid email", () => {
    expect(validateRedeemInput({ email: "nope", password: "secretpw1" }).ok).toBe(false);
  });
  it("requires an 8+ char password", () => {
    expect(validateRedeemInput({ email: "a@b.com", password: "short" }).ok).toBe(false);
  });
  it("accepts good input and lowercases email", () => {
    const r = validateRedeemInput({ email: "  A@B.com ", password: "secretpw1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBe("a@b.com");
  });
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: `src/lib/validation/invite.ts`**

```ts
import type { Validated } from "./hospital";

export function validateRedeemInput(input: {
  email: string;
  password: string;
}): Validated<{ email: string; password: string }> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "올바른 이메일을 입력하세요." };
  const password = input.password ?? "";
  if (password.length < 8) return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };
  return { ok: true, value: { email, password } };
}
```

- [ ] **Step 4: `src/lib/invites.ts`**

```ts
export function newInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function inviteUrl(host: string, token: string): string {
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}/invite/${token}`;
}
```

- [ ] **Step 5: Run — PASS.** `npm test`.

- [ ] **Step 6: Commit** — `git commit -am "feat: invite token/url helpers and redeem validator (tested)"`

---

## Task 3: Staff issuance — owner invite (patient) + vet invite (hospital)

**Files:**
- Create: `src/app/(app)/patients/[id]/invites/actions.ts`, `src/app/(app)/hospitals/invites/actions.ts`
- Modify: `src/app/(app)/patients/[id]/page.tsx`, `src/app/(app)/hospitals/page.tsx`

- [ ] **Step 1: Owner-invite actions** — `patients/[id]/invites/actions.ts`

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { newInviteToken } from "@/lib/invites";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function issueOwnerInvite(patientId: string, ownerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("invite").insert({
    token: newInviteToken(),
    role: "owner",
    owner_id: ownerId,
    expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
  });
  if (error) redirect(`/patients/${patientId}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/patients/${patientId}`);
}

export async function revokeInvite(patientId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("invite").delete().eq("id", id);
  revalidatePath(`/patients/${patientId}`);
}
```

- [ ] **Step 2: Owner-invite section in patient detail.** In `patients/[id]/page.tsx`:
  - Read the request host: `import { headers } from "next/headers";` → `const host = (await headers()).get("host") ?? "localhost:3000";`
  - Fetch invites for this owner: `supabase.from("invite").select("id, token, used, expires_at").eq("owner_id", p.owner_id).eq("role","owner").order("created_at",{ascending:false})`
  - Render a section with an "보호자 초대 링크 발급" button (`issueOwnerInvite.bind(null, p.id, p.owner_id)`) and a list of links (`inviteUrl(host, token)`), each showing used/valid + a 취소 (revoke) button.

```tsx
// import { inviteUrl } from "@/lib/invites";
// import { issueOwnerInvite, revokeInvite } from "./invites/actions";
<section className="space-y-3">
  <h2 className="text-lg font-medium">보호자 초대</h2>
  <ul className="space-y-1 text-sm">
    {(ownerInvites ?? []).map((iv) => (
      <li key={iv.id} className="flex items-center gap-3">
        <code className="rounded bg-gray-100 px-2 py-1 text-xs">{inviteUrl(host, iv.token)}</code>
        <span className="text-gray-500">{iv.used ? "사용됨" : "미사용"}</span>
        <form action={revokeInvite.bind(null, p.id, iv.id)}>
          <button className="text-red-600">취소</button>
        </form>
      </li>
    ))}
    {(ownerInvites ?? []).length === 0 && <li className="text-gray-500">발급된 초대가 없습니다.</li>}
  </ul>
  <form action={issueOwnerInvite.bind(null, p.id, p.owner_id)}>
    <SubmitButton>보호자 초대 링크 발급</SubmitButton>
  </form>
</section>
```
(Note: `p.owner_id` — add `owner_id` to the patient `select` on this page.)

- [ ] **Step 3: Vet-invite actions** — `hospitals/invites/actions.ts` (mirror; `role: "referring_vet"`, `referring_hospital_id`, revalidate `/hospitals`).

- [ ] **Step 4: Vet-invite on hospitals page.** In `hospitals/page.tsx`, add an action `issueVetInvite.bind(null, h.id)` button per row and show the most recent link. Simplest: add a 4th column "초대" with an issue button, and below the table list issued vet invites with `inviteUrl`. Read host via `headers()`.

- [ ] **Step 5: Verify via preview** — on a patient, click 보호자 초대 링크 발급 → a link appears. On hospitals, issue a vet invite → link appears. Copy one token for Task 5. (Revoke removes it.)

- [ ] **Step 6: Commit** — `git commit -am "feat: staff issues owner/vet invite links"`

---

## Task 4: Redemption page `/invite/[token]`

**Files:**
- Create: `src/app/invite/[token]/page.tsx`, `src/app/invite/[token]/actions.ts`

Note: `/invite` is already public in `proxy.ts` (Plan 01 allow-list). `signUp` is NOT used — redemption goes through the RPC then `signInWithPassword`.

- [ ] **Step 1: Redeem action** — `src/app/invite/[token]/actions.ts`

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { validateRedeemInput } from "@/lib/validation/invite";
import { redirect } from "next/navigation";

export async function redeemInvite(token: string, formData: FormData) {
  const v = validateRedeemInput({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!v.ok) redirect(`/invite/${token}?error=` + encodeURIComponent(v.error));

  const supabase = await createClient();
  const { error: rpcErr } = await supabase.rpc("redeem_invite", {
    p_token: token,
    p_email: v.value.email,
    p_password: v.value.password,
  });
  if (rpcErr) {
    const map: Record<string, string> = {
      invalid_invite: "유효하지 않은 초대입니다.",
      invite_used: "이미 사용된 초대입니다.",
      invite_expired: "만료된 초대입니다.",
      email_taken: "이미 가입된 이메일입니다.",
      weak_password: "비밀번호는 8자 이상이어야 합니다.",
    };
    const key = Object.keys(map).find((k) => rpcErr.message.includes(k));
    redirect(`/invite/${token}?error=` + encodeURIComponent(key ? map[key] : rpcErr.message));
  }

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: v.value.email,
    password: v.value.password,
  });
  if (signErr) redirect("/login?error=" + encodeURIComponent("가입은 됐지만 로그인에 실패했습니다. 로그인해 주세요."));
  redirect("/portal");
}
```

- [ ] **Step 2: Redemption page** — `src/app/invite/[token]/page.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { redeemInvite } from "./actions";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_target", { p_token: token });
  const target = Array.isArray(data) ? data[0] : null;

  if (!target || !target.valid) {
    return (
      <main className="mx-auto mt-24 max-w-sm p-6">
        <h1 className="text-xl font-semibold">초대 링크가 유효하지 않습니다</h1>
        <p className="mt-2 text-sm text-gray-600">만료되었거나 이미 사용된 링크일 수 있습니다. 병원에 문의하세요.</p>
      </main>
    );
  }

  const roleLabel = target.role === "owner" ? "보호자" : "1차 병원";
  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="text-xl font-semibold">{roleLabel} 계정 만들기</h1>
      <p className="mt-1 mb-6 text-sm text-gray-600">
        <b>{target.label}</b> 기록을 열람할 수 있는 읽기 전용 계정을 만듭니다.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form action={redeemInvite.bind(null, token)} className="space-y-4">
        <input name="email" type="email" placeholder="이메일" required className={inputClass} />
        <input name="password" type="password" placeholder="비밀번호 (8자 이상)" required className={inputClass} />
        <SubmitButton>계정 만들기</SubmitButton>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify via preview** — open `/invite/{token}` from Task 3 (logged out; use a fresh preview or clear session). Confirm it shows the target label; submit with a new email + 8+ char password → lands on `/portal`. Reusing the token shows "이미 사용된 초대".

- [ ] **Step 4: Commit** — `git commit -am "feat: invite redemption page creates read-only account"`

---

## Task 5: Read-only portal

**Files:**
- Create: `src/app/portal/layout.tsx`, `src/app/portal/page.tsx`, `src/app/portal/patients/[id]/page.tsx`, `src/app/portal/PortalVitals.tsx`
- Note: `src/app/portal/page.tsx` currently holds the Plan 01 placeholder — replace it.

- [ ] **Step 1: Portal layout (role gate)** — `src/app/portal/layout.tsx`

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profile").select("role, name").eq("id", user.id).single();
  const role = profile?.role;
  if (role === "staff") redirect("/");
  if (role !== "owner" && role !== "referring_vet") redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/portal" className="text-sm font-medium">진료 기록</Link>
        <span className="text-sm text-gray-500">
          {profile?.name ?? ""} · {role === "owner" ? "보호자" : "의뢰 병원"} (읽기 전용)
        </span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Portal list** — `src/app/portal/page.tsx` (RLS returns only allowed patients for both roles, so one query works)

```tsx
import { createClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/DataTable";
import Link from "next/link";

export default async function PortalHome() {
  const supabase = await createClient();
  const { data: patients } = await supabase
    .from("patient")
    .select("id, name, species, breed")
    .order("name");
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">환자</h1>
      <DataTable
        headers={["이름", "종/품종"]}
        empty="열람 가능한 환자가 없습니다."
        rows={(patients ?? []).map((p) => [
          <Link key="n" href={`/portal/patients/${p.id}`} className="text-blue-600">{p.name}</Link>,
          [p.species, p.breed].filter(Boolean).join(" / ") || "-",
        ])}
      />
    </div>
  );
}
```

- [ ] **Step 3: Portal vitals wrapper** — `src/app/portal/PortalVitals.tsx`

```tsx
"use client";
export { VitalChart as PortalVitals } from "@/app/(app)/admissions/[admissionId]/VitalChart";
```
(If re-exporting across route groups is awkward, move `VitalChart.tsx` to `src/components/VitalChart.tsx` and import it from both places. Prefer moving it to `src/components/` for a single source.)

- [ ] **Step 4: Read-only patient record** — `src/app/portal/patients/[id]/page.tsx`

Fetch (RLS scopes automatically; a disallowed id yields no rows → `notFound`):

```tsx
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { VitalChart } from "@/components/VitalChart"; // after moving it here
import { notFound } from "next/navigation";

export default async function PortalPatient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: p } = await supabase
    .from("patient")
    .select("id, name, species, breed, sex, birth_date")
    .eq("id", id).single();
  if (!p) notFound();

  const { data: visits } = await supabase
    .from("visit")
    .select("id, visit_date, visit_no, note, prescription(dose, frequency, duration, drug:drug_id(name)), medical_image(id, modality, file_name, storage_path), media(id, kind, file_name, storage_path)")
    .eq("patient_id", id).order("visit_date", { ascending: false });

  const { data: admissions } = await supabase
    .from("admission")
    .select("id, admitted_at, discharged_at, status, vital(measured_at, temperature, heart_rate, resp_rate, systolic, diastolic)")
    .eq("patient_id", id).order("admitted_at", { ascending: false });

  // sign file urls
  async function sign<T extends { storage_path: string }>(rows: T[]) {
    return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(r.storage_path) })));
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">{p.name}</h1>
      <p className="text-sm text-gray-600">
        {[p.species, p.breed].filter(Boolean).join(" / ")}
        {p.sex ? ` · ${p.sex}` : ""}{p.birth_date ? ` · ${p.birth_date}` : ""}
      </p>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">진료 기록</h2>
        {(visits ?? []).map(async (v) => {
          const imgs = await sign((v.medical_image as any[]) ?? []);
          const med = await sign((v.media as any[]) ?? []);
          const rx = (v.prescription as any[]) ?? [];
          return (
            <div key={v.id} className="rounded border p-3 text-sm">
              <div className="font-medium">{v.visit_date}{v.visit_no != null ? ` · ${v.visit_no}회차` : ""}</div>
              {v.note && <p className="mt-1 whitespace-pre-wrap text-gray-700">{v.note}</p>}
              {rx.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-gray-700">
                  {rx.map((r, i) => <li key={i}>{r.drug?.name} {r.dose ?? ""} {r.frequency ?? ""} {r.duration ?? ""}</li>)}
                </ul>
              )}
              {(imgs.length > 0 || med.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {[...imgs, ...med].map((f) => (
                    f.url
                      ? <a key={f.id} href={f.url} target="_blank" className="text-blue-600">{f.file_name}</a>
                      : <span key={f.id}>{f.file_name}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {(visits ?? []).length === 0 && <p className="text-sm text-gray-500">진료 기록이 없습니다.</p>}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">입원 / 바이털</h2>
        {(admissions ?? []).map((a) => {
          const vitals = ((a.vital as any[]) ?? []).slice().sort((x, y) => x.measured_at.localeCompare(y.measured_at));
          return (
            <div key={a.id} className="rounded border p-3">
              <div className="text-sm font-medium">
                입원 {a.admitted_at} {a.status === "admitted" ? "· 입원중" : `· 퇴원 ${a.discharged_at ?? ""}`}
              </div>
              {vitals.length > 0 && <div className="mt-2"><VitalChart data={vitals} /></div>}
            </div>
          );
        })}
        {(admissions ?? []).length === 0 && <p className="text-sm text-gray-500">입원 기록이 없습니다.</p>}
      </section>
    </div>
  );
}
```

Note: React Server Components can render `await`-ed maps, but returning a Promise from `.map` requires awaiting. Cleaner: pre-compute the visit blocks with `await Promise.all((visits ?? []).map(async (v) => (...jsx...)))` and render the resulting array. Refactor the visit loop into a `const visitBlocks = await Promise.all(...)` above `return` and render `{visitBlocks}`. Do the same for admissions if needed. (The inline `async` map above is illustrative — implement it with `Promise.all` to avoid rendering Promises.)

- [ ] **Step 5: Move `VitalChart` to `src/components/VitalChart.tsx`.** Update the import in `admissions/[admissionId]/page.tsx` to `@/components/VitalChart`, delete `PortalVitals.tsx`, and import the same in the portal. `npm run build` to confirm both consumers compile.

- [ ] **Step 6: Verify via preview**

Using the account created in Task 4 (owner of a patient with data — issue the owner invite for 몽이's owner so the portal has content):
1. Log in as the portal user (or continue the redeemed session) → `/portal` lists only that owner's pet(s).
2. Open the patient → see visits with notes + prescriptions, admission with the vitals chart, and file links.
3. Click a file link → the signed URL resolves (fetch 200) — proves external Storage signing works.
4. Confirm scoping: the portal list does NOT show other owners' patients; visiting another patient's `/portal/patients/{otherId}` returns not-found.

- [ ] **Step 7: Commit** — `git commit -am "feat: read-only owner/vet portal (records, vitals chart, signed files)"`

---

## Task 6: Regression sweep + finish

- [ ] **Step 1:** `npm test` and `npm run build`.
- [ ] **Step 2:** Re-run `supabase/tests/rls.sql` → `RLS TESTS PASSED`.
- [ ] **Step 3:** Cross-scope check (SQL, rolled back): a redeemed owner cannot `select` another owner's patient; `can_read_patient_file` returns false for a foreign path under that owner's JWT.
- [ ] **Step 4:** Preview smoke: staff issues owner invite → redeem in a clean session → portal shows exactly that pet's records incl. a signed file link (200) and a vitals chart; second redeem of the same token fails.
- [ ] **Step 5:** Use superpowers:finishing-a-development-branch to merge `feat/invites-portal` into `main`.

---

## Done criteria (Plan 05)

- `npm test` passes (roles + all validators incl. redeem).
- Staff can issue and revoke owner/vet invite links from the patient and hospital screens.
- Opening a valid invite creates a scoped read-only account and lands on `/portal`; used/expired/invalid tokens are refused with clear messages.
- Owners see only their pets; referring vets see only their referred patients — both read-only, including visits, prescriptions, admissions, the vitals chart, and file links via signed URLs.
- RLS test still passes; no external user can reach another patient's rows or files.

## MVP complete
Plans 01–05 deliver the full MVP: staff EMR (patients, visits, prescriptions, images/media, admissions, vitals) plus the read-only external portal for owners and referring hospitals. Post-MVP candidates: notifications, DICOM viewer, appointments/billing, audit logging, native app wrapper.
