import type { Validated } from "./hospital";
import { getForm, type ConsentForm } from "@/lib/consent/forms";
import { normalizeResidentNo } from "@/lib/crypto";

export type ConsentIssueValues = {
  form_code: string;
  form_title: string;
  fields: Record<string, string>;
};

/** 발행 — 직원이 양식을 고르고 진단·처치 같은 가변 값을 채운다 */
export function validateConsentIssue(input: {
  form_code: string;
  values: Record<string, string>;
}): Validated<ConsentIssueValues> {
  const form = getForm((input.form_code ?? "").trim());
  if (!form) return { ok: false, error: "동의서 양식을 선택하세요." };

  const fields: Record<string, string> = {};
  for (const f of form.fields) {
    const v = (input.values[f.key] ?? "").trim();
    if (f.required && !v) return { ok: false, error: `${f.label} 항목을 입력하세요.` };
    if (v) fields[f.key] = v;
  }
  return { ok: true, value: { form_code: form.code, form_title: form.title, fields } };
}

export type ConsentSignValues = {
  answers: Record<string, string>;
  signer_name: string;
  /** 숫자만 남긴 주민등록번호. 저장 전에 반드시 암호화한다 */
  resident_no: string | null;
  signature: string;
};

/** 서명 — 보호자(또는 병원 태블릿)에서 선택지·이름·주민번호·서명을 받는다 */
export function validateConsentSign(
  form: ConsentForm,
  input: {
    answers: Record<string, string>;
    signer_name?: string;
    resident_no?: string;
    signature?: string;
  }
): Validated<ConsentSignValues> {
  const name = (input.signer_name ?? "").trim();
  if (!name) return { ok: false, error: "서명하시는 분의 성함을 입력해 주세요." };

  const signature = (input.signature ?? "").trim();
  // 캔버스가 비어 있으면 아주 짧은 data URL 이 넘어온다
  if (!signature.startsWith("data:image/png;base64,") || signature.length < 1000) {
    return { ok: false, error: "서명란에 서명해 주세요." };
  }

  const answers: Record<string, string> = {};
  for (const c of form.choices) {
    const v = (input.answers[c.key] ?? "").trim();
    if (!v) return { ok: false, error: `${c.label} 항목을 선택해 주세요.` };
    if (!c.options.some((o) => o.value === v)) {
      return { ok: false, error: `${c.label} 선택값이 올바르지 않습니다.` };
    }
    answers[c.key] = v;
  }

  const raw = (input.resident_no ?? "").trim();
  let resident_no: string | null = null;
  if (raw) {
    resident_no = normalizeResidentNo(raw);
    if (!resident_no) {
      return { ok: false, error: "주민등록번호는 생년월일 6자리 또는 13자리로 입력해 주세요." };
    }
  }

  return { ok: true, value: { answers, signer_name: name, resident_no, signature } };
}
