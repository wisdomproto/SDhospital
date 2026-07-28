"use client";
import { useState } from "react";
import { CONSENT_FORMS } from "@/lib/consent/forms";
import { issueConsent } from "./consent-actions";
import { inputClass } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";

/**
 * 동의서 발행. 양식을 고르면 그 양식이 필요로 하는 칸만 나타난다.
 * (수술 동의서만 진단·처치·시술 설명을 받고, 나머지는 한두 칸이다)
 */
export function ConsentIssue({ patientId, visitId }: { patientId: string; visitId: string }) {
  const [code, setCode] = useState<string>(CONSENT_FORMS[0].code);
  const form = CONSENT_FORMS.find((f) => f.code === code)!;

  return (
    <details style={{ marginTop: 12 }}>
      <summary>
        <span className="btn btn-secondary btn-sm">+ 동의서 발행</span>
      </summary>
      <form
        action={issueConsent.bind(null, patientId, visitId)}
        style={{ display: "grid", gap: 12, maxWidth: 560, marginTop: 12 }}
      >
        <label className="field-label">
          양식
          <select
            name="form_code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass}
            style={{ marginTop: 6 }}
          >
            {CONSENT_FORMS.map((f) => (
              <option key={f.code} value={f.code}>
                {f.title}
              </option>
            ))}
          </select>
        </label>

        {form.fields.map((f) => (
          <label key={f.key} className="field-label">
            {f.label}
            {f.required && <span style={{ color: "var(--danger, #b4541f)" }}> *</span>}
            {f.multiline ? (
              <textarea
                name={`f_${f.key}`}
                rows={3}
                placeholder={f.placeholder}
                className={inputClass}
                style={{ marginTop: 6 }}
              />
            ) : (
              <input
                name={`f_${f.key}`}
                placeholder={f.placeholder}
                className={inputClass}
                style={{ marginTop: 6 }}
              />
            )}
          </label>
        ))}

        <div>
          <SubmitButton>발행</SubmitButton>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          발행하면 보호자 앱에 뜹니다. 병원 태블릿으로 그 자리에서 받으시려면 목록에서 <b>서명받기</b>를 누르세요.
        </p>
      </form>
    </details>
  );
}
