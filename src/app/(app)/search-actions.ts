"use server";
import { createClient } from "@/lib/supabase/server";
import { kstToday } from "@/lib/worklist";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type Hit = {
  id: string;
  name: string;
  chart_no: string | null;
  species: string | null;
  breed: string | null;
  owner: string | null;
  admitted: boolean;
};

/**
 * 상단 검색(⌘K). 목록을 통째로 클라이언트에 넘기지 않는다 — 지금은 12명이지만
 * 환자는 계속 쌓이고, 그때 고치려면 화면부터 다시 짜야 한다.
 */
export async function searchPatients(q: string): Promise<Hit[]> {
  const term = q.trim();
  const supabase = await createClient();

  let query = supabase
    .from("patient")
    .select("id, name, chart_no, species, breed, owner:owner_id(name)")
    .limit(8);

  if (term) {
    // 이름·차트번호·품종 아무거나. 보호자 이름은 조인이라 아래에서 따로 찾는다.
    const like = `%${term}%`;
    query = query.or(`name.ilike.${like},chart_no.ilike.${like},breed.ilike.${like}`);
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const [{ data: rows }, { data: byOwner }] = await Promise.all([
    query,
    term
      ? supabase
          .from("patient")
          .select("id, name, chart_no, species, breed, owner:owner_id!inner(name)")
          .ilike("owner.name", `%${term}%`)
          .limit(8)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const merged = [...(rows ?? []), ...(byOwner ?? [])];
  const seen = new Set<string>();
  const hits = merged.filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, 8);
  if (hits.length === 0) return [];

  const { data: admitted } = await supabase
    .from("admission")
    .select("patient_id")
    .eq("status", "admitted")
    .in("patient_id", hits.map((p) => p.id));
  const admittedSet = new Set((admitted ?? []).map((a) => a.patient_id));

  return hits.map((p) => ({
    id: p.id,
    name: p.name,
    chart_no: p.chart_no,
    species: p.species,
    breed: p.breed,
    owner: (p.owner as unknown as { name: string } | null)?.name ?? null,
    admitted: admittedSet.has(p.id),
  }));
}

/**
 * "진료 입력" — 환자를 고르면 오늘 날짜 회차를 만들고 바로 그 화면으로 보낸다.
 * 회차 번호는 그 환자의 기존 회차 수 + 1. 사람이 셀 일이 아니다.
 */
export async function startVisit(patientId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("visit")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  const { data, error } = await supabase
    .from("visit")
    .insert({ patient_id: patientId, visit_date: kstToday(), visit_no: (count ?? 0) + 1 })
    .select("id")
    .single();
  if (error) redirect(`/patients/${patientId}?error=` + encodeURIComponent(error.message));

  revalidatePath(`/patients/${patientId}`, "layout");
  // new=1 이면 회차 화면이 진료 내용에 커서를 놓는다 — 만들자마자 바로 쓰기 시작한다
  redirect(`/patients/${patientId}/v/${data!.id}?new=1`);
}
