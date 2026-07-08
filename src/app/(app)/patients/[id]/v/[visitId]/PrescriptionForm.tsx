import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { addPrescription } from "./actions";

export function PrescriptionForm({
  patientId,
  visitId,
  drugs,
}: {
  patientId: string;
  visitId: string;
  drugs: { id: string; name: string }[];
}) {
  return (
    <form
      action={addPrescription.bind(null, patientId, visitId)}
      style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}
    >
      <select name="drug_id" required defaultValue="" className={inputClass}>
        <option value="">약품 선택</option>
        {drugs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <input name="dose" placeholder="용량" className={inputClass} />
      <input name="frequency" placeholder="용법" className={inputClass} />
      <input name="duration" placeholder="기간" className={inputClass} />
      <div style={{ gridColumn: "1 / -1" }}>
        <SubmitButton>처방 추가</SubmitButton>
      </div>
    </form>
  );
}
