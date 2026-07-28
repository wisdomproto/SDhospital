import { isVideoFile, isImageFile } from "@/lib/storage";

export type SignedFile = {
  id: string;
  file_name: string | null;
  storage_path: string;
  modality?: string | null;
  kind?: string | null;
  url: string | null;
  /** 보호자는 가벼운 사본을 보고, 필요할 때만 원본을 받는다 (의료영상 전용) */
  originalUrl?: string | null;
};

export function MediaGrid({ files }: { files: SignedFile[] }) {
  if (files.length === 0)
    return <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: 0 }}>없음</p>;
  return (
    <div className="media-grid2">
      {files.map((f) => {
        const tag = f.modality ? f.modality.toUpperCase() : f.kind ?? "";
        if (f.url && isVideoFile(f.file_name)) {
          return (
            <div key={f.id}>
              <video className="media-thumb" src={f.url} controls preload="metadata" />
              {tag && <div className="portal-tile-sub" style={{ marginTop: 4 }}>{tag}</div>}
            </div>
          );
        }
        if (f.url && isImageFile(f.file_name)) {
          return (
            <div key={f.id}>
              <a href={f.url} target="_blank" className="media-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.file_name ?? ""} />
              </a>
              <div className="portal-tile-sub" style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                {tag && <span>{tag}</span>}
                {f.originalUrl && (
                  <a href={f.originalUrl} target="_blank" download style={{ fontWeight: 700 }}>
                    원본 받기
                  </a>
                )}
              </div>
            </div>
          );
        }
        return (
          <a key={f.id} href={f.url ?? "#"} target="_blank" className="portal-tile" style={{ padding: 10 }}>
            <span className="pill muted">{tag || "파일"}</span>
            <span style={{ fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis" }}>
              {f.file_name}
            </span>
          </a>
        );
      })}
    </div>
  );
}
