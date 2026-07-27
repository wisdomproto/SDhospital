import { describe, it, expect } from "vitest";
import { validateHospitalInput } from "@/lib/validation/hospital";
import { validateOwnerInput } from "@/lib/validation/owner";
import { validatePatientInput, buildPatientSearch } from "@/lib/validation/patient";
import { validateDrugInput } from "@/lib/validation/drug";
import { validateVisitInput } from "@/lib/validation/visit";
import { validatePrescriptionInput } from "@/lib/validation/prescription";
import { validateAdmissionInput } from "@/lib/validation/admission";
import { validateReportInput } from "@/lib/validation/report";
import { daysBetween, admittedDay, sortWorkItems } from "@/lib/worklist";
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

describe("worklist", () => {
  it("counts overdue days from the visit date", () => {
    expect(daysBetween("2026-07-24", "2026-07-27")).toBe(3);
    expect(daysBetween("2026-07-27", "2026-07-27")).toBe(0);
  });
  it("counts the admission day as day 1 on arrival", () => {
    expect(admittedDay("2026-07-27", "2026-07-27")).toBe(1);
    expect(admittedDay("2026-07-25", "2026-07-27")).toBe(3);
  });
  it("puts the most overdue item first", () => {
    const mk = (n: string, d: number, kind: "visit" | "admission" = "visit") =>
      ({ kind, href: "/" + n, patientName: n, species: null, date: "", overdueDays: d, subtitle: "" });
    const sorted = sortWorkItems([mk("a", 0), mk("b", 5), mk("c", 2)]);
    expect(sorted.map((i) => i.patientName)).toEqual(["b", "c", "a"]);
  });
});

describe("validateReportInput", () => {
  it("allows an empty draft", () => {
    const r = validateReportInput({ comment: "  ", send: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ comment: null, send: false });
  });
  it("refuses to send without a comment", () => {
    expect(validateReportInput({ comment: "", send: "1" }).ok).toBe(false);
  });
  it("sends with a comment", () => {
    const r = validateReportInput({ comment: " 경과 양호합니다 ", send: "1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ comment: "경과 양호합니다", send: true });
  });
});

describe("validateAdmissionInput", () => {
  it("requires patient_id", () => {
    expect(validateAdmissionInput({ patient_id: "", visit_id: "v1" }).ok).toBe(false);
  });
  // 입원은 진료 회차에 딸린 기록 — 회차 없이는 만들 수 없다
  it("requires visit_id", () => {
    expect(validateAdmissionInput({ patient_id: "p1", visit_id: "" }).ok).toBe(false);
  });
  it("defaults admitted_at when blank, nulls note", () => {
    const r = validateAdmissionInput({ patient_id: "p1", visit_id: "v1", admitted_at: "", note: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.patient_id).toBe("p1");
      expect(r.value.visit_id).toBe("v1");
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
