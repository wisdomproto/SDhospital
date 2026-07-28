import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret, maskResidentNo, normalizeResidentNo } from "@/lib/crypto";
import { validateConsentIssue, validateConsentSign } from "@/lib/validation/consent";
import { getForm, renderBody, CONSENT_FORMS } from "@/lib/consent/forms";

beforeAll(() => {
  process.env.CONSENT_ENC_KEY = "test-key-for-unit-tests";
});

const SIGNATURE = "data:image/png;base64," + "A".repeat(1200);

describe("주민등록번호 암호화", () => {
  it("암호문에 평문이 남지 않는다", () => {
    const blob = encryptSecret("9001011234567");
    expect(blob).not.toContain("9001011234567");
    expect(blob.startsWith("v1.")).toBe(true);
  });
  it("복호화하면 원래 값이 나온다", () => {
    expect(decryptSecret(encryptSecret("9001011234567"))).toBe("9001011234567");
  });
  it("같은 값도 매번 다른 암호문이 된다 (IV 랜덤)", () => {
    expect(encryptSecret("9001011234567")).not.toBe(encryptSecret("9001011234567"));
  });
  it("변조된 암호문은 복호화에 실패한다", () => {
    const blob = encryptSecret("9001011234567");
    const parts = blob.split(".");
    parts[3] = "B" + parts[3].slice(1);
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
  it("화면에는 뒷자리를 가린다", () => {
    expect(maskResidentNo("9001011234567")).toBe("900101-1******");
    expect(maskResidentNo("900101")).toBe("900101");
  });
  it("6자리·13자리만 받는다", () => {
    expect(normalizeResidentNo("900101-1234567")).toBe("9001011234567");
    expect(normalizeResidentNo("900101")).toBe("900101");
    expect(normalizeResidentNo("90010")).toBeNull();
    expect(normalizeResidentNo("")).toBeNull();
  });
});

describe("동의서 발행", () => {
  it("모르는 양식은 거부한다", () => {
    expect(validateConsentIssue({ form_code: "nope", values: {} }).ok).toBe(false);
  });
  it("필수 항목이 비면 거부한다", () => {
    expect(validateConsentIssue({ form_code: "surgery", values: { diagnosis: "슬개골탈구" } }).ok).toBe(false);
  });
  it("필수 항목이 차면 통과한다", () => {
    const r = validateConsentIssue({
      form_code: "surgery",
      values: { diagnosis: "슬개골탈구", procedure: "슬개골탈구교정" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.fields.diagnosis).toBe("슬개골탈구");
  });
});

describe("동의서 서명", () => {
  const admission = getForm("admission")!;

  it("서명이 비면 거부한다", () => {
    const r = validateConsentSign(admission, {
      answers: { cpr: "cpr" },
      signer_name: "홍길동",
      signature: "data:image/png;base64,AA",
    });
    expect(r.ok).toBe(false);
  });
  it("선택 항목을 안 고르면 거부한다 (CPR/DNR)", () => {
    const r = validateConsentSign(admission, {
      answers: {},
      signer_name: "홍길동",
      signature: SIGNATURE,
    });
    expect(r.ok).toBe(false);
  });
  it("선택지에 없는 값은 거부한다", () => {
    const r = validateConsentSign(admission, {
      answers: { cpr: "maybe" },
      signer_name: "홍길동",
      signature: SIGNATURE,
    });
    expect(r.ok).toBe(false);
  });
  it("주민번호 자릿수가 틀리면 거부한다", () => {
    const r = validateConsentSign(admission, {
      answers: { cpr: "dnr" },
      signer_name: "홍길동",
      resident_no: "12345",
      signature: SIGNATURE,
    });
    expect(r.ok).toBe(false);
  });
  it("다 갖추면 통과하고 주민번호는 숫자만 남는다", () => {
    const r = validateConsentSign(admission, {
      answers: { cpr: "dnr" },
      signer_name: " 홍길동 ",
      resident_no: "900101-1234567",
      signature: SIGNATURE,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.signer_name).toBe("홍길동");
      expect(r.value.resident_no).toBe("9001011234567");
      expect(r.value.answers.cpr).toBe("dnr");
    }
  });
});

describe("본문 조립", () => {
  it("발행 시 입력값이 본문에 들어간다", () => {
    const body = renderBody(getForm("surgery")!, { diagnosis: "슬개골탈구", procedure: "교정술" });
    expect(body).toContain("진단: 슬개골탈구");
    expect(body).toContain("처치: 교정술");
  });
  it("빈 값은 밑줄로 남는다", () => {
    expect(renderBody(getForm("surgery")!, {})).toContain("________");
  });
  it("모든 양식에 치환되지 않은 자리가 남지 않는다", () => {
    for (const f of CONSENT_FORMS) {
      const filled = Object.fromEntries(f.fields.map((x) => [x.key, "값"]));
      expect(renderBody(f, filled)).not.toMatch(/\{\{/);
    }
  });
});
