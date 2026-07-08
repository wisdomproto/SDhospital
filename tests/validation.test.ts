import { describe, it, expect } from "vitest";
import { validateHospitalInput } from "@/lib/validation/hospital";
import { validateOwnerInput } from "@/lib/validation/owner";
import { validatePatientInput, buildPatientSearch } from "@/lib/validation/patient";
import { validateDrugInput } from "@/lib/validation/drug";
import { validateVisitInput } from "@/lib/validation/visit";
import { validatePrescriptionInput } from "@/lib/validation/prescription";
import { validateAdmissionInput } from "@/lib/validation/admission";
import { validateVitalInput } from "@/lib/validation/vital";
import { validateRedeemInput } from "@/lib/validation/invite";

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

describe("validateAdmissionInput", () => {
  it("requires patient_id", () => {
    expect(validateAdmissionInput({ patient_id: "" }).ok).toBe(false);
  });
  it("defaults admitted_at when blank, nulls note", () => {
    const r = validateAdmissionInput({ patient_id: "p1", admitted_at: "", note: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.patient_id).toBe("p1");
      expect(typeof r.value.admitted_at).toBe("string");
      expect(r.value.note).toBeNull();
    }
  });
});

describe("validateVitalInput", () => {
  it("requires admission_id", () => {
    expect(validateVitalInput({ admission_id: "", temperature: "38" }).ok).toBe(false);
  });
  it("requires at least one measurement", () => {
    expect(validateVitalInput({ admission_id: "a1" }).ok).toBe(false);
  });
  it("parses numbers and nulls blanks", () => {
    const r = validateVitalInput({
      admission_id: "a1",
      temperature: "38.5",
      heart_rate: "120",
      resp_rate: "",
      systolic: "130",
      diastolic: "",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.temperature).toBe(38.5);
      expect(r.value.heart_rate).toBe(120);
      expect(r.value.resp_rate).toBeNull();
      expect(r.value.systolic).toBe(130);
      expect(r.value.diastolic).toBeNull();
    }
  });
  it("rejects a non-numeric measurement", () => {
    expect(validateVitalInput({ admission_id: "a1", heart_rate: "fast" }).ok).toBe(false);
  });
});

describe("validateRedeemInput", () => {
  it("requires a valid email", () => {
    expect(validateRedeemInput({ email: "nope", password: "secretpw1" }).ok).toBe(false);
  });
  it("requires an 8+ char password", () => {
    expect(validateRedeemInput({ email: "a@b.com", password: "short" }).ok).toBe(false);
  });
  it("accepts good input and lowercases email", () => {
    const r = validateRedeemInput({ email: "  A@B.com ", password: "secretpw1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBe("a@b.com");
  });
});
