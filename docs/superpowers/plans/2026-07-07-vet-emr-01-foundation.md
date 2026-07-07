# Vet EMR — Plan 01: Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Next.js + Supabase project with the full DB schema, RLS-enforced role access (staff/referring_vet/owner), staff email/password login, and a role-aware app shell.

**Architecture:** Next.js (App Router, TypeScript) app deployed on Railway, talking to Supabase (Postgres + Auth + Storage). All access rules live in Postgres RLS so a bug in the app cannot leak another patient's data. Local development uses the Supabase CLI (Docker) so migrations and RLS are testable before touching the cloud project.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, @supabase/ssr, Supabase CLI, Vitest (TS unit), psql (SQL/RLS tests).

**Spec:** `docs/superpowers/specs/2026-07-07-vet-emr-design.md`

---

## Prerequisites (read before starting)

- **Node.js 20+** and **npm**.
- **Docker Desktop** running (required by `supabase start` for the local stack).
  - Fallback if no Docker: create a free Supabase **dev cloud project**, `supabase link` to it, and run migrations with `supabase db push`. RLS tests then run via `psql` against the dev project connection string. Prefer local (Docker) when available.
- **Supabase CLI** (`npm i -g supabase` or `npx supabase`).
- Shell: PowerShell on Windows. Commands below use forward-slash paths that work in both PowerShell and Git Bash; where a command differs, both are given.

## File Structure (created by this plan)

```
package.json, tsconfig.json, next.config.ts, tailwind.config.ts, .env.local
supabase/
  config.toml                     # created by `supabase init`
  migrations/
    0001_core_schema.sql          # all tables
    0002_rls_helpers.sql          # role helper functions
    0003_rls_policies.sql         # RLS policies per table
  tests/
    rls.sql                       # SQL script asserting scoped access
src/
  lib/supabase/
    client.ts                     # browser client
    server.ts                     # server client (cookies)
    types.ts                      # generated DB types (later)
  lib/auth/
    roles.ts                      # Role type + helpers (unit tested)
  middleware.ts                   # session refresh + route guard
  app/
    layout.tsx                    # root layout
    login/page.tsx                # staff login
    (app)/layout.tsx              # authed shell (nav, role-aware)
    (app)/page.tsx                # placeholder dashboard
tests/
  roles.test.ts                   # Vitest for roles.ts
vitest.config.ts
```

---

## Task 1: Initialize the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Scaffold Next.js**

Run (in `C:/projects/SDhospital`, which already contains `.git`, `docs/`, `.gitignore`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

When prompted that the directory is not empty, keep existing files. If create-next-app refuses, scaffold in a temp dir and copy `src/`, `package.json`, configs over — do NOT overwrite `docs/`, `.git`, `.gitignore`.

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev`
Expected: server starts on http://localhost:3000 with the default page. Stop it (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (TS, Tailwind, App Router)"
```

---

## Task 2: Add Supabase client libraries and env config

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `.env.local`
- Modify: `.gitignore` (already ignores `.env.local` — verify)

- [ ] **Step 1: Install deps**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create `.env.local` (placeholder values, filled in Task 3)**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_LOCAL_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_LOCAL_SERVICE_ROLE_KEY
```

- [ ] **Step 3: Browser client** — `src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Server client** — `src/lib/supabase/server.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component; middleware refreshes the session
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add supabase browser/server clients and env template"
```

---

## Task 3: Initialize Supabase local stack

**Files:**
- Create: `supabase/config.toml` (via CLI)

- [ ] **Step 1: Init**

```bash
npx supabase init
```

- [ ] **Step 2: Start local stack (Docker must be running)**

```bash
npx supabase start
```
Expected: prints `API URL`, `anon key`, `service_role key`, `DB URL`. Copy anon + service_role keys into `.env.local` (URL is `http://127.0.0.1:54321`).

- [ ] **Step 3: Sanity check Studio**

Open http://127.0.0.1:54323 → Supabase Studio loads. This confirms the local DB is up.

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml
git commit -m "chore: init supabase local stack config"
```

---

## Task 4: Core schema migration

**Files:**
- Create: `supabase/migrations/0001_core_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0001_core_schema.sql — core EMR tables

create extension if not exists "pgcrypto";

create table referring_hospital (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  created_at timestamptz not null default now()
);

create table owner (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  created_at timestamptz not null default now()
);

create table patient (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owner(id) on delete restrict,
  referring_hospital_id uuid references referring_hospital(id) on delete set null,
  name text not null,
  species text,
  breed text,
  sex text,
  birth_date date,
  note text,
  created_at timestamptz not null default now()
);
create index on patient (owner_id);
create index on patient (referring_hospital_id);

create table visit (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  visit_date date not null default current_date,
  visit_no int,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on visit (patient_id);

create table drug (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text,
  spec text,
  note text,
  created_at timestamptz not null default now()
);

create table prescription (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visit(id) on delete cascade,
  drug_id uuid not null references drug(id) on delete restrict,
  dose text,
  frequency text,
  duration text,
  note text
);
create index on prescription (visit_id);

create table medical_image (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visit(id) on delete cascade,
  modality text check (modality in ('xray','mri','ct','other')),
  storage_path text not null,
  file_name text,
  uploaded_at timestamptz not null default now()
);
create index on medical_image (visit_id);

create table media (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  visit_id uuid references visit(id) on delete set null,
  kind text,
  storage_path text not null,
  file_name text,
  uploaded_at timestamptz not null default now()
);
create index on media (patient_id);

create table admission (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  admitted_at date not null default current_date,
  discharged_at date,
  status text not null default 'admitted' check (status in ('admitted','discharged')),
  note text
);
create index on admission (patient_id);

create table vital (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references admission(id) on delete cascade,
  measured_at timestamptz not null default now(),
  temperature numeric,
  heart_rate int,
  resp_rate int,
  systolic int,
  diastolic int,
  note text,
  recorded_by uuid references auth.users(id)
);
create index on vital (admission_id);

create table profile (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('staff','referring_vet','owner')),
  referring_hospital_id uuid references referring_hospital(id),
  owner_id uuid references owner(id),
  name text,
  created_at timestamptz not null default now()
);

create table invite (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  role text not null check (role in ('referring_vet','owner')),
  owner_id uuid references owner(id),
  referring_hospital_id uuid references referring_hospital(id),
  expires_at timestamptz,
  used boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: migration applies cleanly; no errors. Re-run confirms idempotency via reset.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_core_schema.sql
git commit -m "feat(db): core EMR schema (patients, visits, prescriptions, admissions, vitals)"
```

---

## Task 5: RLS helper functions

**Files:**
- Create: `supabase/migrations/0002_rls_helpers.sql`

- [ ] **Step 1: Write helpers** (SECURITY DEFINER so they can read `profile` regardless of caller RLS)

```sql
-- 0002_rls_helpers.sql

create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from profile where id = auth.uid()
$$;

create or replace function current_owner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select owner_id from profile where id = auth.uid()
$$;

create or replace function current_hospital_id() returns uuid
language sql stable security definer set search_path = public as $$
  select referring_hospital_id from profile where id = auth.uid()
$$;
```

- [ ] **Step 2: Apply**

Run: `npx supabase db reset`
Expected: applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_rls_helpers.sql
git commit -m "feat(db): RLS helper functions for current role/owner/hospital"
```

---

## Task 6: RLS policies

**Files:**
- Create: `supabase/migrations/0003_rls_policies.sql`

- [ ] **Step 1: Write policies.** Pattern: `staff` gets full access; external roles get SELECT only, scoped through `patient`. Child tables use `exists(...)` against `patient`.

```sql
-- 0003_rls_policies.sql

alter table referring_hospital enable row level security;
alter table owner enable row level security;
alter table patient enable row level security;
alter table visit enable row level security;
alter table drug enable row level security;
alter table prescription enable row level security;
alter table medical_image enable row level security;
alter table media enable row level security;
alter table admission enable row level security;
alter table vital enable row level security;
alter table profile enable row level security;
alter table invite enable row level security;

-- profile: a user can read their own profile; staff can read all
create policy profile_self_read on profile for select
  using (id = auth.uid() or current_role_name() = 'staff');
create policy profile_staff_write on profile for all
  using (current_role_name() = 'staff')
  with check (current_role_name() = 'staff');

-- staff-only reference tables
create policy hospital_staff_all on referring_hospital for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
-- a referring_vet may read their own hospital row
create policy hospital_vet_read on referring_hospital for select
  using (current_role_name() = 'referring_vet' and id = current_hospital_id());

create policy owner_staff_all on owner for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy owner_self_read on owner for select
  using (current_role_name() = 'owner' and id = current_owner_id());

create policy drug_staff_all on drug for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
-- external roles read drug rows only through a prescription they can see
create policy drug_external_read on drug for select
  using (exists (
    select 1 from prescription pr join visit v on v.id = pr.visit_id
      join patient p on p.id = v.patient_id
    where pr.drug_id = drug.id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- patient: staff all; external scoped read
create policy patient_staff_all on patient for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy patient_vet_read on patient for select
  using (current_role_name() = 'referring_vet' and referring_hospital_id = current_hospital_id());
create policy patient_owner_read on patient for select
  using (current_role_name() = 'owner' and owner_id = current_owner_id());

-- helper predicate reused via inline exists on patient scope
-- visit
create policy visit_staff_all on visit for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy visit_external_read on visit for select
  using (exists (
    select 1 from patient p where p.id = visit.patient_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- prescription (child of visit)
create policy rx_staff_all on prescription for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy rx_external_read on prescription for select
  using (exists (
    select 1 from visit v join patient p on p.id = v.patient_id
    where v.id = prescription.visit_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- medical_image (child of visit)
create policy img_staff_all on medical_image for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy img_external_read on medical_image for select
  using (exists (
    select 1 from visit v join patient p on p.id = v.patient_id
    where v.id = medical_image.visit_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- media (child of patient)
create policy media_staff_all on media for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy media_external_read on media for select
  using (exists (
    select 1 from patient p where p.id = media.patient_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- admission (child of patient)
create policy adm_staff_all on admission for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy adm_external_read on admission for select
  using (exists (
    select 1 from patient p where p.id = admission.patient_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- vital (child of admission -> patient)
create policy vital_staff_all on vital for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
create policy vital_external_read on vital for select
  using (exists (
    select 1 from admission a join patient p on p.id = a.patient_id
    where a.id = vital.admission_id and (
      (current_role_name() = 'referring_vet' and p.referring_hospital_id = current_hospital_id())
      or (current_role_name() = 'owner' and p.owner_id = current_owner_id())
    )
  ));

-- invite: staff only
create policy invite_staff_all on invite for all
  using (current_role_name() = 'staff') with check (current_role_name() = 'staff');
```

- [ ] **Step 2: Apply**

Run: `npx supabase db reset`
Expected: applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_rls_policies.sql
git commit -m "feat(db): RLS policies enforcing staff/vet/owner scoped access"
```

---

## Task 7: RLS test — prove scoped access (the critical safety test)

**Files:**
- Create: `supabase/tests/rls.sql`

This test seeds two hospitals, two owners, two patients, and asserts that a referring_vet sees only their referred patient and an owner sees only their own pet. It runs against the local DB by impersonating users via `request.jwt.claims`.

- [ ] **Step 1: Write the test script**

```sql
-- supabase/tests/rls.sql
-- Run with: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- DB_URL from `npx supabase status` (DB URL), e.g. postgres://postgres:postgres@127.0.0.1:54322/postgres

begin;

-- fake auth users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'vetA@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ownerX@example.com');

insert into referring_hospital (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Hospital A'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Hospital B');

insert into owner (id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Owner X'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Owner Y');

insert into patient (id, owner_id, referring_hospital_id, name) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Pet-Referred-by-A'),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Pet-Referred-by-B');

insert into profile (id, role, referring_hospital_id, owner_id) values
  ('11111111-1111-1111-1111-111111111111', 'referring_vet', 'aaaaaaaa-0000-0000-0000-000000000001', null),
  ('22222222-2222-2222-2222-222222222222', 'owner', null, 'bbbbbbbb-0000-0000-0000-000000000001');

-- impersonate vet A (referred Hospital A)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from patient;
  if n <> 1 then raise exception 'vetA should see exactly 1 patient, saw %', n; end if;
  perform 1 from patient where name = 'Pet-Referred-by-A';
  if not found then raise exception 'vetA must see their referred patient'; end if;
  perform 1 from patient where name = 'Pet-Referred-by-B';
  if found then raise exception 'vetA must NOT see Hospital B patient'; end if;
end $$;

-- impersonate owner X
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from patient;
  if n <> 1 then raise exception 'ownerX should see exactly 1 patient, saw %', n; end if;
  perform 1 from patient where owner_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if not found then raise exception 'ownerX must see their own pet'; end if;
end $$;

reset role;
select 'RLS TESTS PASSED' as result;
rollback;
```

- [ ] **Step 2: Run and verify it PASSES**

Get DB URL: `npx supabase status` (copy "DB URL").
Run (Git Bash):
```bash
DB_URL=$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```
PowerShell:
```powershell
$DB_URL = (npx supabase status -o env | Select-String '^DB_URL=').ToString().Split('=',2)[1].Trim('"')
psql $DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```
Expected: final row `RLS TESTS PASSED`. Any policy gap raises an exception and fails the run.

- [ ] **Step 3: Prove the test can FAIL (guard against false green)**

Temporarily edit `patient_vet_read` policy in `0003_rls_policies.sql` to drop the `referring_hospital_id = current_hospital_id()` clause, `npx supabase db reset`, re-run the test.
Expected: FAILS with "vetA must NOT see Hospital B patient". Then revert the edit and `npx supabase db reset` again → PASSES.

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/rls.sql
git commit -m "test(db): assert RLS scopes patients to referring vet and owner"
```

---

## Task 8: Role helpers (TS) + Vitest

**Files:**
- Create: `src/lib/auth/roles.ts`, `tests/roles.test.ts`, `vitest.config.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```
Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Write the failing test** — `tests/roles.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { isStaff, homePathForRole, type Role } from "@/lib/auth/roles";

describe("roles", () => {
  it("identifies staff", () => {
    expect(isStaff("staff")).toBe(true);
    expect(isStaff("owner")).toBe(false);
  });
  it("routes each role to its home", () => {
    const cases: [Role, string][] = [
      ["staff", "/"],
      ["referring_vet", "/portal"],
      ["owner", "/portal"],
    ];
    for (const [role, path] of cases) expect(homePathForRole(role)).toBe(path);
  });
});
```

- [ ] **Step 4: Run — verify FAIL**

Run: `npm test`
Expected: FAIL (module `@/lib/auth/roles` not found). Note: `@/*` alias resolves via `vite-tsconfig-paths` — if unresolved, install `npm i -D vite-tsconfig-paths` and add `plugins: [tsconfigPaths()]` to `vitest.config.ts`.

- [ ] **Step 5: Implement** — `src/lib/auth/roles.ts`

```ts
export type Role = "staff" | "referring_vet" | "owner";

export function isStaff(role: Role | null | undefined): boolean {
  return role === "staff";
}

export function homePathForRole(role: Role): string {
  return role === "staff" ? "/" : "/portal";
}
```

- [ ] **Step 6: Run — verify PASS**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: role model with home-path routing (tested)"
```

---

## Task 9: Middleware — session refresh + route guard

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write middleware** (refresh session; redirect unauthenticated users away from protected routes to `/login`)

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/invite");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Manual verify**

Run `npm run dev`, visit http://localhost:3000/ while logged out.
Expected: redirected to `/login` (page 404s until Task 10 — that's fine; the redirect is what we verify here).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: auth middleware refreshes session and guards routes"
```

---

## Task 10: Staff login page

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`

- [ ] **Step 1: Server action** — `src/app/login/actions.ts`

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
  redirect("/");
}
```

- [ ] **Step 2: Login page** — `src/app/login/page.tsx`

```tsx
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">직원 로그인</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form action={signIn} className="space-y-4">
        <input name="email" type="email" placeholder="이메일" required
          className="w-full rounded border px-3 py-2" />
        <input name="password" type="password" placeholder="비밀번호" required
          className="w-full rounded border px-3 py-2" />
        <button type="submit" className="w-full rounded bg-black py-2 text-white">
          로그인
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Create a test staff user + profile**

In Supabase Studio (http://127.0.0.1:54323) → Authentication → Add user (email + password, auto-confirm). Copy the user id, then in SQL editor:
```sql
insert into profile (id, role, name) values ('<USER_ID>', 'staff', '테스트 직원');
```

- [ ] **Step 4: Manual verify login**

Run `npm run dev`, go to `/login`, sign in with the staff creds.
Expected: redirected to `/` (renders placeholder from Task 11). Wrong password shows the error message.

- [ ] **Step 5: Commit**

```bash
git add src/app/login
git commit -m "feat: staff email/password login"
```

---

## Task 11: Authed app shell + placeholder dashboard

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`
- Move: default `src/app/page.tsx` content into the `(app)` group (delete the old root page if create-next-app left one)

- [ ] **Step 1: Authed layout** — `src/app/(app)/layout.tsx` (loads role, redirects non-staff to portal placeholder)

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Role } from "@/lib/auth/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile").select("role, name").eq("id", user.id).single();
  const role = profile?.role as Role | undefined;
  if (role !== "staff") redirect("/portal");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <nav className="flex gap-4 text-sm">
          <Link href="/">대시보드</Link>
          <Link href="/patients">환자</Link>
          <Link href="/drugs">약품</Link>
        </nav>
        <span className="text-sm text-gray-500">{profile?.name} · 직원</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Dashboard placeholder** — `src/app/(app)/page.tsx`

```tsx
export default function Dashboard() {
  return (
    <div>
      <h1 className="text-xl font-semibold">동물병원 EMR</h1>
      <p className="mt-2 text-gray-600">환자·진료·입원 관리 (기반 완료). 다음 계획서에서 기능 추가.</p>
    </div>
  );
}
```

- [ ] **Step 3: Portal placeholder** — `src/app/portal/page.tsx`

```tsx
export default function Portal() {
  return <main className="p-6"><h1 className="text-xl font-semibold">보호자 · 1차병원 포털 (준비 중)</h1></main>;
}
```

- [ ] **Step 4: Verify end-to-end**

Run `npm run dev`. Logged out → `/` redirects to `/login`. Log in as staff → see the shell + dashboard. `/patients` 404s (built in Plan 02) — expected.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: role-aware app shell with staff dashboard and portal placeholder"
```

---

## Task 12: Generate DB types + push to remote (cloud) project

**Files:**
- Create: `src/lib/supabase/types.ts`

- [ ] **Step 1: Generate types from local schema**

```bash
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

- [ ] **Step 2: (When ready) link + push to Supabase cloud dev project**

```bash
npx supabase link --project-ref <YOUR_PROJECT_REF>
npx supabase db push
```
Then set Railway/production `.env` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to the cloud project values. (Do NOT commit real keys.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "chore: generate Supabase TypeScript types"
```

---

## Done criteria (Plan 01)

- `npm test` passes (roles unit test).
- `psql ... -f supabase/tests/rls.sql` prints `RLS TESTS PASSED`, and the deliberate-break step proves the test can fail.
- Logged-out users are redirected to `/login`; staff can log in and see the shell; non-staff land on `/portal`.
- All 12 tasks committed. Push: `git push origin main`.

## Next
- **Plan 02 — 환자 관리**: owners / referring hospitals / patients CRUD, list + search, patient detail. Written after Plan 01 is executed and verified.
