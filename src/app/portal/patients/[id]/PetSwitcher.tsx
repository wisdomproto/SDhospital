"use client";
import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

export type Pet = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  photo: string | null;
  unread: number;
};

const Avatar = ({ pet, size }: { pet: Pet; size: number }) =>
  pet.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={pet.photo}
      alt={pet.name}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }}
    />
  ) : (
    <span style={{ fontSize: size * 0.72, lineHeight: 1 }}>{pet.species === "고양이" ? "🐱" : "🐶"}</span>
  );

/**
 * 반려동물 전환.
 *
 * 여러 마리를 키우는 보호자는 목록 화면으로 돌아갔다 다시 들어와야 했다.
 * 이름은 어차피 헤더에 늘 있으니 그걸 누르면 바꾸게 한다 — 한 마리면 그냥 이름이다.
 *
 * 바꿀 때 **보던 탭을 유지한다.** 진료 기록을 보다 다른 아이로 옮기면 그 아이의 진료 기록이어야지,
 * 매번 첫 화면으로 튕기면 비교하려고 오간 의미가 없다.
 */
export function PetSwitcher({ pets, current }: { pets: Pet[]; current: Pet }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  if (pets.length < 2) return <span className="title">{current.name}</span>;

  const go = (pet: Pet) => {
    dialog.current?.close();
    // /portal/patients/<id>/<tab>/... → 탭까지만 유지하고 상세는 버린다 (남의 회차 id 다)
    const tab = pathname.split("/")[4];
    const keep = ["visits", "chat", "profile"].includes(tab ?? "") ? `/${tab}` : "";
    router.push(`/portal/patients/${pet.id}${keep}`);
  };

  // 헤더에는 점을 찍지 않는다 — 하단 탭 배지가 이미 같은 말을 하고 있고,
  // 표시가 둘이면 어느 쪽을 봐야 하는지 헷갈린다. 다른 아이 소식은 시트 안에서 숫자로 보여준다.

  return (
    <>
      <button type="button" className="pet-switch" onClick={() => dialog.current?.showModal()}>
        <span className="title">{current.name}</span>
        <span aria-hidden className="pet-switch-caret">▾</span>
      </button>

      <dialog ref={dialog} className="pet-sheet" onClick={() => dialog.current?.close()}>
        <div className="pet-sheet-box" onClick={(e) => e.stopPropagation()}>
          <div style={{ fontWeight: 800, padding: "2px 4px 10px" }}>어떤 아이를 볼까요?</div>
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pet-row${p.id === current.id ? " current" : ""}`}
              onClick={() => go(p)}
            >
              <span className="pet-row-av">
                <Avatar pet={p} size={38} />
              </span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <span style={{ fontWeight: 700, display: "block" }}>{p.name}</span>
                <span className="portal-tile-sub">
                  {[p.species, p.breed].filter(Boolean).join(" / ") || "-"}
                </span>
              </span>
              {p.unread > 0 && <span className="pill-new">새 소식 {p.unread}</span>}
              {p.id === current.id && <span aria-hidden style={{ color: "var(--primary)" }}>✓</span>}
            </button>
          ))}
        </div>
      </dialog>
    </>
  );
}
