import { createClient } from "@/lib/supabase/server";
import { DEMO_ACCOUNTS, DEMO_ENABLED } from "../demo";
import { quickOwnerAs } from "./actions";
import { PendingButton } from "../PendingButton";

/**
 * ⚠️ **DEMO ONLY.** 원장님 EMR 실제 환자를 골라 그 아이 앱으로 들어간다.
 *
 * 로그인 전 화면이라 목록을 읽을 세션이 없다. **DB 에 익명 읽기 함수를 만들지 않고**
 * 여기서 직원 계정으로 한 번 읽어 온다 — 데모가 꺼지면 이 코드가 아예 안 돈다.
 * 함수를 열었으면 env 를 꺼도 DB 는 계속 열려 있었을 것이다.
 */
export async function DemoPatients() {
  if (!DEMO_ENABLED) return null;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(DEMO_ACCOUNTS.staff);
  if (error) return null;
  const { data } = await supabase
    .from("patient")
    .select("id, name, species, breed, chart_no, emr_owner:emr_owner_id(name)")
    .not("emr_owner_id", "is", null)
    .order("chart_no");
  await supabase.auth.signOut(); // 목록만 읽고 바로 나온다 — 직원 세션을 남기지 않는다

  if (!data?.length) return null;

  return (
    <form action={quickOwnerAs} style={{ display: "grid", gap: 8 }}>
      <div className="login-divider">원장님 환자 · 골라서 입장</div>
      <select name="patientId" className="field" defaultValue={data[0].id} aria-label="환자 선택">
        {data.map((p) => {
          const owner = (p.emr_owner as unknown as { name: string } | null)?.name;
          return (
            <option key={p.id} value={p.id}>
              {owner ? `${owner} · ` : ""}
              {p.name} ({p.breed ?? p.species ?? "—"}) · {p.chart_no}
            </option>
          );
        })}
      </select>
      <PendingButton className="btn btn-primary" style={{ padding: 12 }} pendingLabel="입장 중…">
        이 아이로 입장 ({data.length}명)
      </PendingButton>
    </form>
  );
}
