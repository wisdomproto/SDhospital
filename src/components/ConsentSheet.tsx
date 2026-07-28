import { SignaturePad } from "@/components/SignaturePad";
import { signConsent } from "@/app/(app)/patients/[id]/v/[visitId]/consent-actions";
import { getForm, renderBody } from "@/lib/consent/forms";

export type ConsentRow = {
  id: string;
  form_code: string;
  form_title: string;
  fields: unknown;
  answers: unknown;
  body_snapshot: string | null;
  signer_name: string | null;
  signature_png: string | null;
  signed_at: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" });

/**
 * 동의서 한 장. 보호자 앱·병원 태블릿·직원 열람이 모두 이 화면을 쓴다.
 * 서명 전에는 서명 폼이, 서명 후에는 서명 이미지와 시각이 붙는다.
 */
export function ConsentSheet({
  consent,
  patientName,
  backPath,
  error,
}: {
  consent: ConsentRow;
  patientName: string;
  backPath: string;
  error?: string;
}) {
  const form = getForm(consent.form_code);
  const fields = (consent.fields ?? {}) as Record<string, string>;
  const answers = (consent.answers ?? {}) as Record<string, string>;
  // 서명된 건은 그때 박아둔 본문을 그대로 — 양식이 바뀌어도 증빙은 변하지 않는다
  const body = consent.body_snapshot ?? (form ? renderBody(form, fields) : "");
  const signed = !!consent.signed_at;

  return (
    <div className="consent-sheet">
      <div className="consent-head">
        <h1>{consent.form_title}</h1>
        <p>{patientName}</p>
      </div>

      {error && <div className="consent-error">{error}</div>}

      <pre className="consent-body">{body}</pre>

      {signed ? (
        <>
          {form && form.choices.length > 0 && (
            <div className="consent-answers">
              {form.choices.map((c) => {
                const picked = c.options.find((o) => o.value === answers[c.key]);
                return (
                  <div key={c.key} className="consent-answer">
                    <span>{c.label}</span>
                    <b>{picked?.label ?? "-"}</b>
                  </div>
                );
              })}
            </div>
          )}
          <div className="consent-signed">
            <div>
              <div className="consent-signed-name">보호자 또는 의뢰인: {consent.signer_name}</div>
              <div className="consent-signed-at">{consent.signed_at && fmt(consent.signed_at)}</div>
            </div>
            {consent.signature_png && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={consent.signature_png} alt="서명" className="consent-signature" />
            )}
          </div>
        </>
      ) : (
        <form action={signConsent.bind(null, consent.id, backPath)} className="consent-form no-print">
          {form?.choices.map((c) => (
            <fieldset key={c.key} className="consent-choice">
              <legend>{c.label}</legend>
              {c.note && <p className="consent-note">{c.note}</p>}
              {c.options.map((o) => (
                <label key={o.value} className="consent-option">
                  <input type="radio" name={`c_${c.key}`} value={o.value} />
                  <span>{o.label}</span>
                </label>
              ))}
            </fieldset>
          ))}

          <div className="consent-field">
            <label htmlFor="signer_name">서명하시는 분 성함</label>
            <input id="signer_name" name="signer_name" required autoComplete="name" />
          </div>

          <div className="consent-field">
            <label htmlFor="resident_no">주민등록번호</label>
            <input
              id="resident_no"
              name="resident_no"
              inputMode="numeric"
              placeholder="숫자만 입력"
              autoComplete="off"
            />
            <span className="consent-hint">
              암호화되어 저장되며, 동의서 발급 외의 용도로 사용하지 않습니다.
            </span>
          </div>

          <SignaturePad />

          <button className="consent-submit">동의하고 서명 완료</button>
          <p className="consent-hint" style={{ textAlign: "center" }}>
            제출하면 수정할 수 없습니다
          </p>
        </form>
      )}
    </div>
  );
}
