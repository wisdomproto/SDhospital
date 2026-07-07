import { FormField, inputClass } from "@/components/FormField";

type Option = { id: string; name: string };
type Defaults = Partial<{
  name: string;
  owner_id: string;
  referring_hospital_id: string | null;
  species: string;
  breed: string;
  sex: string;
  birth_date: string;
  note: string;
}>;

export function PatientFields({
  owners,
  hospitals,
  d = {},
}: {
  owners: Option[];
  hospitals: Option[];
  d?: Defaults;
}) {
  return (
    <div className="space-y-3">
      <FormField label="이름">
        <input name="name" required defaultValue={d.name ?? ""} className={inputClass} />
      </FormField>
      <FormField label="보호자">
        <select name="owner_id" required defaultValue={d.owner_id ?? ""} className={inputClass}>
          <option value="">— 선택 —</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="의뢰 1차병원 (선택)">
        <select
          name="referring_hospital_id"
          defaultValue={d.referring_hospital_id ?? ""}
          className={inputClass}
        >
          <option value="">— 없음 —</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="종">
          <input name="species" defaultValue={d.species ?? ""} className={inputClass} />
        </FormField>
        <FormField label="품종">
          <input name="breed" defaultValue={d.breed ?? ""} className={inputClass} />
        </FormField>
        <FormField label="성별">
          <input name="sex" defaultValue={d.sex ?? ""} className={inputClass} />
        </FormField>
        <FormField label="생일">
          <input type="date" name="birth_date" defaultValue={d.birth_date ?? ""} className={inputClass} />
        </FormField>
      </div>
      <FormField label="비고">
        <textarea name="note" defaultValue={d.note ?? ""} className={inputClass} rows={3} />
      </FormField>
    </div>
  );
}
