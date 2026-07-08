import { isVideoFile, isImageFile } from "@/lib/storage";

export type SignedFile = {
  id: string;
  file_name: string | null;
  storage_path: string;
  modality?: string | null;
  kind?: string | null;
  url: string | null;
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
              {tag && <div className="portal-tile-sub" style={{ marginTop: 4 }}>{tag}</div>}
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
