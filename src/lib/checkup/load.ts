import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { CHECKUP_SECTIONS, toSpecies, type CheckupItem, type Species } from "./template";
import { evaluate, countOutOfRange, type Evaluated } from "./evaluate";

type Client = SupabaseClient<Database>;

export type LoadedValue = {
  item: CheckupItem;
  side: string | null;
  raw: string;
  note: string | null;
  eval: Evaluated;
};

export type LoadedSection = {
  key: string;
  title: string;
  narrative: boolean;
  /** 서술형 소견 (섹션 해석문) */
  note: string | null;
  values: LoadedValue[];
  outOfRange: number;
};

export type LoadedCheckup = {
  id: string;
  patientId: string;
  visitId: string;
  checkedOn: string;
  vetName: string | null;
  conclusion: string | null;
  recheckOn: string | null;
  recheckNote: string | null;
  sentAt: string | null;
  readAt: string | null;
  species: Species | null;
  sections: LoadedSection[];
  outOfRange: number;
};

/**
 * 검진 한 건을 화면에 쓸 모양으로 읽는다.
 *
 * **값이 있는 섹션만** 만든다 — 검진마다 한 항목이 다르고(14쪽 결과서와 29쪽 결과서),
 * 안 한 검사를 빈칸으로 늘어놓으면 보호자는 "안 해준 것"으로 읽는다.
 */
export async function loadCheckup(
  supabase: Client,
  checkupId: string
): Promise<LoadedCheckup | null> {
  const { data: c } = await supabase
    .from("checkup")
    .select("id, patient_id, visit_id, checked_on, vet_name, conclusion, recheck_on, recheck_note, sent_at, read_at, patient:patient_id(species)")
    .eq("id", checkupId)
    .maybeSingle();
  if (!c) return null;

  const { data: rows } = await supabase
    .from("checkup_value")
    .select("section_key, item_key, value, side, note")
    .eq("checkup_id", checkupId);

  const species = toSpecies((c.patient as unknown as { species: string | null } | null)?.species);
  const bySection = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    const list = bySection.get(r.section_key) ?? [];
    list.push(r);
    bySection.set(r.section_key, list);
  }

  const sections: LoadedSection[] = [];
  for (const def of CHECKUP_SECTIONS) {
    const rowsOf = bySection.get(def.key);
    if (!rowsOf?.length) continue;

    // 항목 키가 없는 행은 섹션 해석문이다 (`item_key = '_note'`)
    const note = rowsOf.find((r) => r.item_key === "_note")?.note ?? null;
    const values: LoadedValue[] = [];
    for (const item of def.items ?? []) {
      for (const r of rowsOf.filter((x) => x.item_key === item.key)) {
        const raw = r.value ?? "";
        values.push({
          item,
          side: r.side,
          raw,
          note: r.note,
          eval: evaluate(def.key, item.key, raw, species),
        });
      }
    }
    sections.push({
      key: def.key,
      title: def.title,
      narrative: Boolean(def.narrative),
      note,
      values,
      outOfRange: countOutOfRange(values.map((v) => v.eval)),
    });
  }

  return {
    id: c.id,
    patientId: c.patient_id,
    visitId: c.visit_id,
    checkedOn: c.checked_on,
    vetName: c.vet_name,
    conclusion: c.conclusion,
    recheckOn: c.recheck_on,
    recheckNote: c.recheck_note,
    sentAt: c.sent_at,
    readAt: c.read_at,
    species,
    sections,
    outOfRange: sections.reduce((n, s) => n + s.outOfRange, 0),
  };
}

/**
 * 같은 항목의 지난 검진 값 — "작년 대비" 는 검진의 핵심이다.
 * 한 번 받은 검진은 숫자일 뿐이지만, 두 번째부터 의미가 생긴다.
 */
export async function previousValues(
  supabase: Client,
  patientId: string,
  beforeDate: string
): Promise<{ checkedOn: string; byKey: Map<string, string> } | null> {
  const { data: prev } = await supabase
    .from("checkup")
    .select("id, checked_on")
    .eq("patient_id", patientId)
    .lt("checked_on", beforeDate)
    .order("checked_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return null;

  const { data: rows } = await supabase
    .from("checkup_value")
    .select("section_key, item_key, value")
    .eq("checkup_id", prev.id);

  const byKey = new Map<string, string>();
  for (const r of rows ?? []) {
    if (r.value) byKey.set(`${r.section_key}.${r.item_key}`, r.value);
  }
  return { checkedOn: prev.checked_on, byKey };
}
