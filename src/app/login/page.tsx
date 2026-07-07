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
    </main>
  );
}
