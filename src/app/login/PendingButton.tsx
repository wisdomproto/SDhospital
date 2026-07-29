"use client";
import { useFormStatus } from "react-dom";

/**
 * 로그인은 인증 왕복 + 첫 화면 렌더까지 0.5초쯤 걸린다. 그동안 아무 반응이 없으면
 * 느린 게 아니라 **안 눌린 것처럼** 보여서 한 번 더 누르게 된다.
 * 서버 액션 폼이므로 `useFormStatus` 하나면 되고, 중복 제출도 같이 막힌다.
 */
export function PendingButton({
  className,
  pendingLabel,
  children,
  ...rest
}: React.ComponentProps<"button"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...rest}
      disabled={pending}
      className={`${className ?? ""}${pending ? " is-pending" : ""}`}
      aria-busy={pending || undefined}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
