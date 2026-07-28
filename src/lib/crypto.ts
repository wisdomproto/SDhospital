import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * 주민등록번호는 개인정보보호법상 고유식별정보라 암호화 저장이 의무다.
 * DB에 평문으로 두지 않는다 — 키는 앱 환경변수에만 있고 DB에는 절대 들어가지 않는다.
 *
 * 형식: v1.<iv(base64)>.<tag(base64)>.<ciphertext(base64)>
 * 버전 접두어를 붙여 나중에 키 교체·알고리즘 변경 시 구분할 수 있게 한다.
 */
const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.CONSENT_ENC_KEY;
  if (!raw) {
    throw new Error(
      "CONSENT_ENC_KEY 가 설정되지 않았습니다. 주민등록번호를 저장할 수 없습니다."
    );
  }
  // 어떤 길이의 문자열이 와도 32바이트 키로 정규화한다
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [VERSION, iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== VERSION) throw new Error(`알 수 없는 암호문 버전: ${v}`);
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/** 화면에는 늘 가려서 보여준다 — 900101-1****** */
export function maskResidentNo(rrn: string): string {
  const digits = rrn.replace(/\D/g, "");
  if (digits.length <= 6) return digits; // 앞 6자리(생년월일)만 받은 경우
  return `${digits.slice(0, 6)}-${digits.slice(6, 7)}${"*".repeat(Math.max(0, digits.length - 7))}`;
}

/** 6자리(생년월일) 또는 13자리(전체)만 허용 */
export function normalizeResidentNo(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length !== 6 && digits.length !== 13) return null;
  return digits;
}
