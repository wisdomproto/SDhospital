"use server";
import { createClient } from "@/lib/supabase/server";
import { validateRedeemInput } from "@/lib/validation/invite";
import { redirect } from "next/navigation";

export async function redeemInvite(token: string, formData: FormData) {
  const v = validateRedeemInput({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!v.ok) redirect(`/invite/${token}?error=` + encodeURIComponent(v.error));

  const supabase = await createClient();
  const { error: rpcErr } = await supabase.rpc("redeem_invite", {
    p_token: token,
    p_email: v.value.email,
    p_password: v.value.password,
  });
  if (rpcErr) {
    const map: Record<string, string> = {
      invalid_invite: "유효하지 않은 초대입니다.",
      invite_used: "이미 사용된 초대입니다.",
      invite_expired: "만료된 초대입니다.",
      email_taken: "이미 가입된 이메일입니다.",
      weak_password: "비밀번호는 8자 이상이어야 합니다.",
    };
    const key = Object.keys(map).find((k) => rpcErr.message.includes(k));
    redirect(`/invite/${token}?error=` + encodeURIComponent(key ? map[key] : rpcErr.message));
  }

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: v.value.email,
    password: v.value.password,
  });
  if (signErr)
    redirect(
      "/login/portal?error=" +
        encodeURIComponent("가입은 됐지만 로그인에 실패했습니다. 로그인해 주세요.")
    );
  redirect("/portal");
}
