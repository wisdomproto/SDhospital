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
        <p className="mt-2 text-sm text-gray-600">
          만료되었거나 이미 사용된 링크일 수 있습니다. 병원에 문의하세요.
        </p>
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
        <input
          name="password"
          type="password"
          placeholder="비밀번호 (8자 이상)"
          required
          className={inputClass}
        />
        <SubmitButton>계정 만들기</SubmitButton>
      </form>
    </main>
  );
}
