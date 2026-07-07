import { describe, it, expect } from "vitest";
import { validateHospitalInput } from "@/lib/validation/hospital";
import { validateOwnerInput } from "@/lib/validation/owner";
import { validatePatientInput, buildPatientSearch } from "@/lib/validation/patient";
import { validateDrugInput } from "@/lib/validation/drug";
import { validateVisitInput } from "@/lib/validation/visit";
import { validatePrescriptionInput } from "@/lib/validation/prescription";

describe("validateHospitalInput", () => {
  it("requires a name", () => {
    expect(validateHospitalInput({ name: "" }).ok).toBe(false);
  });
  it("trims and passes valid input", () => {
    const r = validateHospitalInput({ name: "  A동물병원 ", contact: " 010 " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: "A동물병원", contact: "010" });
  });
});

describe("validateOwnerInput", () => {
  it("requires a name", () => {
    expect(validateOwnerInput({ name: "  " }).ok).toBe(false);
  });
  it("nulls empty contact", () => {
    const r = validateOwnerInput({ name: "홍길동", contact: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.contact).toBeNull();
  });
});

describe("validatePatientInput", () => {
  it("requires name and owner_id", () => {
    expect(validatePatientInput({ name: "", owner_id: "x" }).ok).toBe(false);
    expect(validatePatientInput({ name: "초코", owner_id: "" }).ok).toBe(false);
  });
  it("maps empty referring_hospital_id to null", () => {
    const r = validatePatientInput({ name: "초코", owner_id: "o1", referring_hospital_id: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.referring_hospital_id).toBeNull();
  });
});

describe("buildPatientSearch", () => {
  it("returns null for blank query", () => {
    expect(buildPatientSearch("   ")).toBeNull();
  });
  it("builds an ilike OR across name and species", () => {
    expect(buildPatientSearch("초코")).toBe("name.ilike.%초코%,species.ilike.%초코%");
  });
  it("escapes commas and parens that would break the or() filter", () => {
    expect(buildPatientSearch("a,b")).toBe("name.ilike.%a b%,species.ilike.%a b%");
  });
});

describe("validateDrugInput", () => {
  it("requires a name", () => {
    expect(validateDrugInput({ name: " " }).ok).toBe(false);
  });
  it("trims and nulls empties", () => {
    const r = validateDrugInput({ name: " 아목시실린 ", unit: "", spec: "정" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: "아목시실린", unit: null, spec: "정", note: null });
  });
});

describe("validateVisitInput", () => {
  it("requires patient_id", () => {
    expect(validateVisitInput({ patient_id: "" }).ok).toBe(false);
  });
  it("defaults visit_date when blank and parses visit_no", () => {
    const r = validateVisitInput({ patient_id: "p1", visit_date: "", visit_no: "3", note: " 메모 " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.patient_id).toBe("p1");
      expect(r.value.visit_no).toBe(3);
      expect(r.value.note).toBe("메모");
      expect(typeof r.value.visit_date).toBe("string");
    }
  });
  it("rejects a non-numeric visit_no", () => {
    expect(validateVisitInput({ patient_id: "p1", visit_no: "abc" }).ok).toBe(false);
  });
});

describe("validatePrescriptionInput", () => {
  it("requires visit_id and drug_id", () => {
    expect(validatePrescriptionInput({ visit_id: "", drug_id: "d" }).ok).toBe(false);
    expect(validatePrescriptionInput({ visit_id: "v", drug_id: "" }).ok).toBe(false);
  });
  it("nulls empty optional fields", () => {
    const r = validatePrescriptionInput({ visit_id: "v", drug_id: "d", dose: "1T", frequency: "", duration: "5d" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ visit_id: "v", drug_id: "d", dose: "1T", frequency: null, duration: "5d", note: null });
  });
});
