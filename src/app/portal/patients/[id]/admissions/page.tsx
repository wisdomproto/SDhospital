import { redirect } from "next/navigation";

/**
 * 입원 목록은 없앴다 — 입원은 회차에 딸린 기록이라 진료 기록 안에서 본다.
 *
 * 그래도 이 주소를 지우지 않는 이유: 예전 링크·북마크·알림에서 들어오는 사람이 있다.
 * 없는 페이지를 보여주는 것보다 옮겨간 곳으로 보내는 편이 낫다.
 */
export default async function AdmissionsMoved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/portal/patients/${id}/visits`);
}
