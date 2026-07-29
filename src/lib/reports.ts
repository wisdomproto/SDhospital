import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** 보호자에게 발송된 리포트 한 건 (회차 리포트 또는 입원 일일 리포트) */
export type FeedItem = {
  key: string;
  kind: "visit" | "admission";
  href: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  comment: string;
  unread: boolean;
};

type Client = SupabaseClient<Database>;

/**
 * 한 반려동물에게 발송된 리포트를 최신순으로.
 * 알림 채널이 붙기 전까지는 이 피드가 보호자가 리포트를 발견하는 유일한 경로다.
 */
export async function ownerReportFeed(
  supabase: Client,
  patientId: string,
  base: string,
  limit = 20
): Promise<FeedItem[]> {
  const [{ data: visits }, { data: admReports }] = await Promise.all([
    supabase
      .from("visit")
      .select("id, visit_date, report_comment, report_sent_at, report_read_at")
      .eq("patient_id", patientId)
      .not("report_sent_at", "is", null)
      .order("visit_date", { ascending: false })
      .limit(limit),
    supabase
      .from("admission_report")
      .select("id, report_date, comment, read_at, admission:admission_id!inner(id, patient_id)")
      .eq("admission.patient_id", patientId)
      .not("sent_at", "is", null)
      .order("report_date", { ascending: false })
      .limit(limit),
  ]);

  const items: FeedItem[] = [
    ...(visits ?? []).map((v) => ({
      key: `v-${v.id}`,
      kind: "visit" as const,
      href: `${base}/visits/${v.id}`,
      date: v.visit_date,
      title: "진료 리포트",
      comment: v.report_comment ?? "",
      unread: v.report_read_at == null,
    })),
    ...(admReports ?? []).map((r) => {
      const a = r.admission as unknown as { id: string } | null;
      return {
        key: `a-${r.id}`,
        kind: "admission" as const,
        href: `${base}/admissions/${a?.id}`,
        date: r.report_date,
        title: "입원 경과",
        comment: r.comment ?? "",
        unread: r.read_at == null,
      };
    }),
  ];

  return items.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0)).slice(0, limit);
}

/**
 * 안 읽은 리포트만. 피드에서 걸러 쓰면 안 된다 —
 * 피드는 최신 N건을 자르므로 오래된 안 읽은 건이 빠지고,
 * 그러면 배지 숫자와 목록 개수가 어긋나 보호자가 못 찾는 항목이 생긴다.
 */
export async function unreadFeed(
  supabase: Client,
  patientId: string,
  base: string
): Promise<FeedItem[]> {
  const [{ data: visits }, { data: admReports }] = await Promise.all([
    supabase
      .from("visit")
      .select("id, visit_date, report_comment")
      .eq("patient_id", patientId)
      .not("report_sent_at", "is", null)
      .is("report_read_at", null)
      .order("visit_date", { ascending: false }),
    supabase
      .from("admission_report")
      .select("id, report_date, comment, admission:admission_id!inner(id, patient_id)")
      .eq("admission.patient_id", patientId)
      .not("sent_at", "is", null)
      .is("read_at", null)
      .order("report_date", { ascending: false }),
  ]);

  const items: FeedItem[] = [
    ...(visits ?? []).map((v) => ({
      key: `v-${v.id}`,
      kind: "visit" as const,
      href: `${base}/visits/${v.id}`,
      date: v.visit_date,
      title: "진료 리포트",
      comment: v.report_comment ?? "",
      unread: true,
    })),
    ...(admReports ?? []).map((r) => {
      const a = r.admission as unknown as { id: string } | null;
      return {
        key: `a-${r.id}`,
        kind: "admission" as const,
        href: `${base}/admissions/${a?.id}`,
        date: r.report_date,
        title: "입원 경과",
        comment: r.comment ?? "",
        unread: true,
      };
    }),
  ];

  return items.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
}

/** 반려동물별 안 읽은 리포트 수 — 목록 화면의 배지용 */
export async function unreadCounts(
  supabase: Client,
  patientIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (patientIds.length === 0) return counts;

  const [{ data: visits }, { data: admReports }, { data: consents }] = await Promise.all([
    supabase
      .from("visit")
      .select("patient_id")
      .in("patient_id", patientIds)
      .not("report_sent_at", "is", null)
      .is("report_read_at", null),
    supabase
      .from("admission_report")
      .select("id, admission:admission_id!inner(patient_id)")
      .in("admission.patient_id", patientIds)
      .not("sent_at", "is", null)
      .is("read_at", null),
    // 서명 안 한 동의서도 "확인해야 할 것"이다. 배지에서 빼면 화면의 개수와 어긋난다.
    supabase
      .from("consent")
      .select("patient_id")
      .in("patient_id", patientIds)
      .is("signed_at", null),
  ]);

  for (const v of visits ?? []) {
    counts.set(v.patient_id, (counts.get(v.patient_id) ?? 0) + 1);
  }
  for (const r of admReports ?? []) {
    const a = r.admission as unknown as { patient_id: string } | null;
    if (a) counts.set(a.patient_id, (counts.get(a.patient_id) ?? 0) + 1);
  }
  for (const c of consents ?? []) {
    counts.set(c.patient_id, (counts.get(c.patient_id) ?? 0) + 1);
  }
  return counts;
}
