import { SubmitButton } from "@/components/SubmitButton";
import { inputClass } from "@/components/FormField";
import { uploadImage, uploadMedia } from "./actions";

export function ImageUpload({
  patientId,
  visitId,
}: {
  patientId: string;
  visitId: string;
}) {
  return (
    <form
      action={uploadImage.bind(null, patientId, visitId)}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}
    >
      <select name="modality" defaultValue="xray" className={inputClass} style={{ width: 110 }}>
        <option value="xray">X-ray</option>
        <option value="mri">MRI</option>
        <option value="ct">CT</option>
        <option value="other">기타</option>
      </select>
      <input type="file" name="file" required accept="image/*,.dcm" />
      <SubmitButton variant="secondary">영상 업로드</SubmitButton>
    </form>
  );
}

export function MediaUpload({
  patientId,
  visitId,
}: {
  patientId: string;
  visitId: string;
}) {
  return (
    <form
      action={uploadMedia.bind(null, patientId, visitId)}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}
    >
      <input name="kind" placeholder="종류(예: 보행영상)" className={inputClass} style={{ width: 160 }} />
      <input type="file" name="file" required accept="image/*,video/*" />
      <SubmitButton variant="secondary">사진/영상 업로드</SubmitButton>
    </form>
  );
}
