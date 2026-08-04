import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { kstToday } from "@/lib/worklist";
import { LifeChart } from "@/components/LifeChart";
import {
  aggregate,
  baseline,
  choiceOf,
  FIELDS,
  isActive,
  recentChanges,
  shiftDate,
  type Grain,
  type Intake,
  type LifeLog,
} from "@/lib/life-log";

const RANGE: Record<Grain, { days: number; label: string }> = {
  day: { days: 30, label: "일별 · 최근 30일" },
  week: { days: 84, label: "주별 · 최근 12주" },
  month: { days: 730, label: "월별 · 최근 2년" },
};

/**
 * 생활기록 (직원 화면) — 진료 기록과 **별도로** 본다.
 *
 * 회차에 딸린 기록이 아니다. 보호자가 집에서 남기는 것이라 진료 사이를 메우고,
 * 그래서 왼쪽 내비게이션에서도 회차 목록 위에 따로 둔다.
 *
 * 알갱이를 셋으로 나눈 이유: 같은 데이터인데 **묻는 질문이 다르다.**
 *   일별 — "지난주에 무슨 일이 있었나"  (원본을 그대로 본다)
 *   주별 — "나아지고 있나"              (주 단위 추세)
 *   월별 — "몇 달째 이런가"             (장기 변화·체중)
 */
export default async function StaffLifePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ g?: string }>;
}) {
  const { id } = await params;
  const { g } = await searchParams;
  const grain: Grain = g === "week" || g === "month" ? g : "day";
  const supabase = await createClient();
  const today = kstToday();
  const since = shiftDate(today, -RANGE[grain].days);

  const { data: patient } = await supabase
    .from("patient")
    .select("id, name, species")
    .eq("id", id)
    .single();
  if (!patient) notFound();

  const [{ data: logRows }, { data: intakeRows }] = await Promise.all([
    supabase
      .from("life_log")
      .select("id, logged_on, appetite, stool, energy, weight_kg, meds, note")
      .eq("patient_id", id)
      .gte("logged_on", since)
      .order("logged_on", { ascending: false }),
    supabase
      .from("life_intake")
      .select("id, label, photo_path, started_on, stopped_on")
      .eq("patient_id", id)
      .order("started_on", { ascending: false }),
  ]);

  const logs = (logRows ?? []) as (LifeLog & { id: string })[];
  const buckets = aggregate(logs, grain);
  const base = baseline(logs, today);
  const intakes = (intakeRows ?? []) as Intake[];
  const active = intakes.filter((i) => isActive(i, today));
  const changed = recentChanges(intakes, today);

  const photoRows = logs.length
    ? (await supabase
        .from("life_photo")
        .select("id, log_id, storage_path")
        .in("log_id", logs.map((l) => l.id))).data ?? []
    : [];
  const photoUrls = new Map<string, { id: string; url: string | null }[]>();
  for (const p of photoRows) {
    const url = await signedUrl(p.storage_path);
    photoUrls.set(p.log_id, [...(photoUrls.get(p.log_id) ?? []), { id: p.id, url }]);
  }

  const base_ = `/patients/${id}/life`;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <h2>생활기록</h2>
          <div className="seg">
            {(["day", "week", "month"] as Grain[]).map((k) => (
              <Link
                key={k}
                href={k === "day" ? base_ : `${base_}?g=${k}`}
                className={`seg-btn${grain === k ? " active" : ""}`}
              >
                {k === "day" ? "일별" : k === "week" ? "주별" : "월별"}
              </Link>
            ))}
          </div>
        </div>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: -4 }}>
          {RANGE[grain].label} · 보호자가 집에서 남긴 것입니다. 진료 기록이 아닙니다.
        </p>

        {logs.length === 0 ? (
          <p className="muted">이 기간에 기록이 없습니다.</p>
        ) : (
          <LifeChart buckets={buckets} />
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>평소</h2>
        </div>
        {!base.enough ? (
          <p className="muted">
            최근 30일 중 기록된 날이 <b>{base.days}일</b>입니다 —
            <b> 평소를 말하기에 부족합니다.</b> 근거 없이 “평소보다 적다”고 판단하지 않습니다.
          </p>
        ) : (
          <p>
            최근 30일 중 <b>{base.days}일</b> 기록. 식사를 <b>평소만큼 한 날이 {base.appetiteGoodRate}%</b>
            {base.weightFirst != null && base.weightLast != null && (
              <>
                {" · "}집 체중 <b>{base.weightFirst}kg → {base.weightLast}kg</b>
              </>
            )}
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>먹이는 것 · {active.length}</h2>
        </div>
        {changed.length > 0 && (
          <div className="callout-warn">
            <b>최근 2주 안에 바뀐 것 {changed.length}건</b> — 설사·구토 문의가 오면 여기부터 봅니다.
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {changed.map((i) => (
                <li key={i.id}>
                  {i.label ?? "(이름 없음 · 사진)"} —{" "}
                  {i.stopped_on ? `${i.stopped_on} 중단` : `${i.started_on} 시작`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {active.length === 0 ? (
          <p className="muted">등록된 것이 없습니다.</p>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>시작</th>
                  <th>사진</th>
                </tr>
              </thead>
              <tbody>
                {await Promise.all(
                  active.map(async (i) => {
                    const url = i.photo_path ? await signedUrl(i.photo_path) : null;
                    return (
                      <tr key={i.id}>
                        <td>{i.label ?? <span className="muted">(이름 없음)</span>}</td>
                        <td>{i.started_on}</td>
                        <td>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" style={{ height: 44, borderRadius: 6 }} />
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: ".82rem" }}>
          사료·간식·과일·영양제·다른 병원 약을 <b>구분하지 않고</b> 받습니다 — 새로 준 것이면 전부 원인 후보입니다.
        </p>
      </div>

      {logs.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>날짜별</h2>
          </div>
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>날짜</th>
                  {FIELDS.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  <th>체중</th>
                  <th>메모 · 사진</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.logged_on}>
                    <td style={{ whiteSpace: "nowrap" }}>{l.logged_on}</td>
                    {FIELDS.map((f) => {
                      const c = choiceOf(f.key, l[f.key]);
                      return (
                        <td key={f.key}>
                          {c ? <span className={`pill ${pillOf(c.tone)}`}>{c.label}</span> : <span className="muted">·</span>}
                        </td>
                      );
                    })}
                    <td>{l.weight_kg != null ? `${l.weight_kg}kg` : <span className="muted">·</span>}</td>
                    <td>
                      {l.note}
                      {(photoUrls.get(l.id) ?? []).map((p) =>
                        p.url ? (
                          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt="" style={{ height: 40, borderRadius: 6, verticalAlign: "middle" }} />
                          </a>
                        ) : null
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const pillOf = (t: string) => (t === "good" ? "success" : t === "alert" ? "danger" : "warning");
