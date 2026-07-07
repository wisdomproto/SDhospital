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
