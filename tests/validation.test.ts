import { describe, it, expect } from "vitest";
import { validateHospitalInput } from "@/lib/validation/hospital";
import { validateOwnerInput } from "@/lib/validation/owner";
import { validatePatientInput, buildPatientSearch } from "@/lib/validation/patient";

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
