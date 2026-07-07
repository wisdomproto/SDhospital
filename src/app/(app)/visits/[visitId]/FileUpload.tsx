import { SubmitButton } from "@/components/SubmitButton";
import { inputClass } from "@/components/FormField";
import { uploadImage, uploadMedia } from "./actions";

export function ImageUpload({
  visitId,
  patientId,
}: {
  visitId: string;
  patientId: string;
}) {
  return (
    <form
      action={uploadImage.bind(null, visitId, patientId)}
      className="flex flex-wrap items-center gap-2"
    >
      <select name="modality" defaultValue="xray" className={inputClass + " w-28"}>
        <option value="xray">X-ray</option>
        <option value="mri">MRI</option>
        <option value="ct">CT</option>
        <option value="other">기타</option>
      </select>
      <input type="file" name="file" required accept="image/*,.dcm" />
      <SubmitButton>영상 업로드</SubmitButton>
    </form>
  );
}

export function MediaUpload({
  visitId,
  patientId,
}: {
  visitId: string;
  patientId: string;
}) {
  return (
    <form
      action={uploadMedia.bind(null, visitId, patientId)}
      className="flex flex-wrap items-center gap-2"
    >
      <input name="kind" placeholder="종류(예: 보행영상)" className={inputClass + " w-40"} />
      <input type="file" name="file" required accept="image/*,video/*" />
      <SubmitButton>사진/영상 업로드</SubmitButton>
    </form>
  );
}
