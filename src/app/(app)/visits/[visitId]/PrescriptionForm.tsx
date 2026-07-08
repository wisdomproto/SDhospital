import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { addPrescription } from "./actions";

export function PrescriptionForm({
  visitId,
  drugs,
}: {
  visitId: string;
  drugs: { id: string; name: string }[];
}) {
  return (
    <form action={addPrescription.bind(null, visitId)} className="grid grid-cols-4 gap-2">
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
      <div className="col-span-4">
        <SubmitButton>처방 추가</SubmitButton>
      </div>
    </form>
  );
}
