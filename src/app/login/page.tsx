import { signIn, quickLoginStaff, quickLoginOwner } from "./actions";
import { DEMO_ACCOUNTS } from "./demo";

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
        <input
          name="email"
          type="email"
          placeholder="이메일"
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="비밀번호"
          required
          className="w-full rounded border px-3 py-2"
        />
        <button type="submit" className="w-full rounded bg-black py-2 text-white">
          로그인
        </button>
      </form>

      {/* ⚠️ DEMO ONLY — remove before production */}
      <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="mb-3 text-xs font-medium text-gray-500">테스트 계정 (클릭하면 바로 입장)</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-600">
              <div className="font-medium text-gray-800">직원 (EMR)</div>
              <code>{DEMO_ACCOUNTS.staff.email}</code> / <code>{DEMO_ACCOUNTS.staff.password}</code>
            </div>
            <form action={quickLoginStaff}>
              <button className="shrink-0 rounded border border-gray-800 px-3 py-1.5 text-sm">
                직원으로 입장
              </button>
            </form>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-600">
              <div className="font-medium text-gray-800">보호자 (포털)</div>
              <code>{DEMO_ACCOUNTS.owner.email}</code> / <code>{DEMO_ACCOUNTS.owner.password}</code>
            </div>
            <form action={quickLoginOwner}>
              <button className="shrink-0 rounded border border-gray-800 px-3 py-1.5 text-sm">
                보호자로 입장
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
