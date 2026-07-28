import { SubmitButton } from "@/components/SubmitButton";
import { inputClass } from "@/components/FormField";
import { uploadAdmImage, uploadAdmMedia } from "./actions";
import { MedicalImageInput, ShrinkFileInput } from "@/components/PhotoInput";

export function AdmImageUpload({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId: string;
}) {
  return (
    <form
      action={uploadAdmImage.bind(null, patientId, admissionId)}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}
    >
      <select name="modality" defaultValue="xray" className={inputClass} style={{ width: 110 }}>
        <option value="xray">X-ray</option>
        <option value="mri">MRI</option>
        <option value="ct">CT</option>
        <option value="other">기타</option>
      </select>
      <MedicalImageInput />
      <SubmitButton variant="secondary">영상 업로드</SubmitButton>
    </form>
  );
}

export function AdmMediaUpload({
  patientId,
  admissionId,
}: {
  patientId: string;
  admissionId: string;
}) {
  return (
    <form
      action={uploadAdmMedia.bind(null, patientId, admissionId)}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}
    >
      <input name="kind" placeholder="종류(예: 상처 경과, 보행)" className={inputClass} style={{ width: 180 }} />
      <ShrinkFileInput required />
      <SubmitButton variant="secondary">사진/영상 업로드</SubmitButton>
    </form>
  );
}
