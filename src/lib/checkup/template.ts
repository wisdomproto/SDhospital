/**
 * 건강검진 결과서 템플릿.
 *
 * 실제 결과서 5부(로지·봉구·챙이·토리·몽글이)를 그대로 옮긴 것이다.
 * 지금은 사람이 매번 표를 채우기 때문에 같은 항목이 다른 이름으로 적히고
 * (`cPL`/`PancreaticLipase`, `cProBNP`/`cproBNP`, `Cholesterol`/`TCHOL`),
 * 단위가 틀린 채로 나가기도 한다(혈청화학 ALB 를 `umol/L`, GLU 를 `mmol/L` 로 적은 결과서가 있다).
 * **항목·단위·참고범위를 코드에 고정하면 그 흔들림이 사라진다.**
 *
 * 참고범위는 **종마다 다르다** (BUN 개 6~31 / 고양이 18~33). 그래서 종별로 나눠 둔다.
 * 여기 없는 범위는 판정하지 않는다 — 근거 없이 "주의"라고 말하는 게 제일 나쁘다.
 */

export type Species = "dog" | "cat";

export type Range = { min?: number; max?: number; text?: string };

export type CheckupItem = {
  /** 저장 키. 결과서 표기가 흔들려도 이 값으로 모은다 */
  key: string;
  /** 결과서에 찍히는 이름 */
  label: string;
  unit?: string;
  ranges?: Partial<Record<Species, Range>>;
  /** 숫자가 아닌 결과를 받는 항목 (Negative / 음성 / 2+ / <1/HPF …) */
  qualitative?: boolean;
  /** 계산값이라 참고범위가 없는 항목 (ALB/GLOB 같은 비율) */
  derived?: boolean;
};

export type CheckupSection = {
  key: string;
  title: string;
  /** 값 표가 아니라 서술만 있는 섹션 (귀·피부·영상 등) */
  narrative?: boolean;
  /** 좌/우를 따로 적는 섹션 (안과) */
  bilateral?: boolean;
  items?: CheckupItem[];
};

const n = (min?: number, max?: number): Range => ({ min, max });

export const CHECKUP_SECTIONS: CheckupSection[] = [
  {
    key: "vitals",
    title: "활력징후",
    items: [
      { key: "weight", label: "체중", unit: "kg" },
      { key: "hr", label: "심박수", unit: "회/분", ranges: { dog: n(60, 160), cat: n(120, 200) } },
      // 헐떡거림(Panting)처럼 숫자가 아닌 값이 실제로 들어온다
      { key: "rr", label: "호흡수", unit: "회/분", qualitative: true },
      { key: "temp", label: "체온", unit: "℃", ranges: { dog: n(37.5, 39.2), cat: n(37.8, 39.5) } },
      { key: "bp", label: "혈압(수축기)", unit: "mmHg", ranges: { dog: n(90, 160), cat: n(90, 160) } },
    ],
  },
  {
    key: "physical",
    title: "신체 검사",
    items: [
      { key: "general", label: "일반상태", qualitative: true },
      { key: "musculoskeletal", label: "근골격계", qualitative: true },
      { key: "cardiovascular", label: "심혈관계", qualitative: true },
      { key: "respiratory", label: "호흡기계", qualitative: true },
      { key: "digestive", label: "소화기계", qualitative: true },
      { key: "urogenital", label: "비뇨생식기계", qualitative: true },
      { key: "neuro", label: "신경계", qualitative: true },
      { key: "lymph", label: "림프절", qualitative: true },
    ],
  },
  {
    key: "cbc",
    title: "혈구 검사",
    items: [
      { key: "WBC", label: "WBC", ranges: { dog: n(5.05, 16.76), cat: n(2.87, 17.02) } },
      { key: "RBC", label: "RBC", ranges: { dog: n(5.65, 8.87), cat: n(6.54, 12.2) } },
      { key: "HGB", label: "HGB", ranges: { dog: n(13.1, 20.5), cat: n(9.8, 16.2) } },
      { key: "HCT", label: "HCT", ranges: { dog: n(37.3, 61.7), cat: n(30.3, 52.3) } },
      { key: "MCV", label: "MCV", ranges: { dog: n(61.6, 73.5), cat: n(35.9, 53.1) } },
      { key: "MCH", label: "MCH", ranges: { dog: n(21.2, 25.9), cat: n(11.8, 17.3) } },
      { key: "MCHC", label: "MCHC", ranges: { dog: n(32.0, 37.9), cat: n(28.1, 35.8) } },
      { key: "RETIC_PCT", label: "%RETIC" },
      { key: "RETIC", label: "RETIC", ranges: { dog: n(10, 110), cat: n(3, 50) } },
      { key: "RDW", label: "RDW", ranges: { dog: n(13.6, 21.7), cat: n(15, 27) } },
      { key: "PLT", label: "PLT", ranges: { dog: n(148, 484), cat: n(151, 600) } },
      { key: "MPV", label: "MPV", ranges: { dog: n(8.7, 13.2), cat: n(11.4, 21.6) } },
      { key: "PCT", label: "PCT", ranges: { dog: n(0.14, 0.46), cat: n(0.17, 0.86) } },
      { key: "PDW", label: "PDW", ranges: { dog: n(9.1, 19.4) } },
      { key: "RETIC_HGB", label: "RETIC-HGB", ranges: { dog: n(22.3, 29.6), cat: n(13.2, 20.8) } },
      { key: "NEU_PCT", label: "%NEU" },
      { key: "LYM_PCT", label: "%LYM" },
      { key: "MONO_PCT", label: "%MONO" },
      { key: "EOS_PCT", label: "%EOS" },
      { key: "BASO_PCT", label: "%BASO" },
      { key: "NEU", label: "NEU", ranges: { dog: n(2.95, 11.64), cat: n(2.3, 10.29) } },
      { key: "LYM", label: "LYM", ranges: { dog: n(1.05, 5.1), cat: n(0.92, 6.88) } },
      { key: "MONO", label: "MONO", ranges: { dog: n(0.16, 1.12), cat: n(0.05, 0.67) } },
      { key: "EOS", label: "EOS", ranges: { dog: n(0.06, 1.23), cat: n(0.17, 1.57) } },
      { key: "BASO", label: "BASO", ranges: { dog: n(0, 0.1), cat: n(0.01, 0.26) } },
    ],
  },
  {
    key: "chemistry",
    title: "혈청화학 검사",
    items: [
      { key: "TP", label: "TP", unit: "g/dL", ranges: { dog: n(5, 8.2), cat: n(6.6, 8.4) } },
      { key: "ALB", label: "ALB", unit: "g/dL", ranges: { dog: n(2.2, 4.4), cat: n(2.2, 4.6) } },
      { key: "GLOB", label: "GLOB", unit: "g/dL", ranges: { dog: n(2.5, 4.5), cat: n(2.8, 5.1) } },
      { key: "ALB_GLOB", label: "ALB/GLOB", derived: true },
      { key: "ALT", label: "ALT", unit: "U/L", ranges: { dog: n(12, 121), cat: n(27, 101) } },
      { key: "ALP", label: "ALP", unit: "U/L", ranges: { dog: n(12, 212), cat: n(14, 111) } },
      { key: "GGT", label: "GGT", unit: "U/L", ranges: { dog: n(0, 14), cat: n(0, 4) } },
      { key: "TBIL", label: "TBIL", unit: "mg/dL", ranges: { dog: n(0, 0.4), cat: n(0, 0.2) } },
      { key: "BUN", label: "BUN", unit: "mg/dL", ranges: { dog: n(6, 31), cat: n(18, 33) } },
      { key: "CREA", label: "CREA", unit: "mg/dL", ranges: { dog: n(0.5, 1.6), cat: n(1.1, 2.2) } },
      { key: "BUN_CREA", label: "BUN/CREA", derived: true },
      { key: "GLU", label: "GLU", unit: "mg/dL", ranges: { dog: n(70, 138), cat: n(63, 118) } },
      { key: "CHOL", label: "Cholesterol", unit: "mg/dL", ranges: { dog: n(110, 320), cat: n(89, 258) } },
      { key: "TG", label: "TG", unit: "mg/dL", ranges: { dog: n(10, 150) } },
      { key: "Ca", label: "Ca", unit: "mg/dL", ranges: { dog: n(7.8, 12), cat: n(9, 10.9) } },
      { key: "PHOS", label: "PHOS", unit: "mg/dL", ranges: { dog: n(3, 6.2), cat: n(3.2, 6.3) } },
      { key: "CK", label: "CK", unit: "U/L", ranges: { dog: n(10, 320) } },
    ],
  },
  {
    key: "chemistry_extra",
    title: "추가 혈청화학 검사",
    items: [
      { key: "SDMA", label: "SDMA", ranges: { dog: n(0, 14), cat: n(0, 14) } },
      { key: "TT4", label: "TT4", ranges: { dog: n(1, 4), cat: n(0.8, 4.7) } },
      // 개는 cPL·CRP·cproBNP, 고양이는 fPL·fSAA·fBNP 로 찍힌다 — 같은 자리라 한 키로 모은다
      { key: "PL", label: "췌장염 수치 (cPL / fPL)", ranges: { dog: n(50, 200), cat: n(0, 4.4) } },
      { key: "INFLAM", label: "염증 수치 (CRP / fSAA)", ranges: { dog: n(0, 1), cat: n(0, 5) } },
      { key: "BNP", label: "심장 수치 (cproBNP / fBNP)", ranges: { dog: n(0, 900) }, qualitative: true },
    ],
  },
  {
    key: "electrolytes",
    title: "전해질 및 혈액가스 검사",
    items: [
      { key: "pH", label: "pH", ranges: { dog: n(7.31, 7.46), cat: n(7.21, 7.41) } },
      { key: "pCO2", label: "pCO2", unit: "mmHg", ranges: { dog: n(27, 50), cat: n(28, 50) } },
      { key: "pO2", label: "pO2", unit: "mmHg", ranges: { dog: n(24, 48), cat: n(24, 48) } },
      { key: "Na", label: "cNa+", unit: "mmol/L", ranges: { dog: n(145, 151), cat: n(149, 157) } },
      { key: "K", label: "cK+", unit: "mmol/L", ranges: { dog: n(3.9, 5.1), cat: n(3.3, 4.5) } },
      { key: "iCa", label: "cCa2+", unit: "mmol/L", ranges: { dog: n(1.16, 1.4), cat: n(1.11, 1.38) } },
      { key: "Cl", label: "cCl-", unit: "mmol/L", ranges: { dog: n(110, 119), cat: n(117, 127) } },
      { key: "ctHb", label: "ctHb", unit: "g/dL", ranges: { dog: n(13.5, 17.5), cat: n(13.5, 17.5) } },
      { key: "HCO3", label: "cHCO3-", unit: "mmol/L", ranges: { dog: n(21, 28), cat: n(21, 28) } },
      { key: "AG", label: "Anion Gap", unit: "mmol/L", ranges: { dog: n(7, 16), cat: n(7, 16) } },
      { key: "Hct_bg", label: "Hct", ranges: { dog: n(32, 55), cat: n(32, 55) } },
      { key: "sO2", label: "sO2", ranges: { dog: n(95, 99), cat: n(95, 99) } },
      { key: "SBE", label: "SBE", ranges: { dog: n(-1.5, 3), cat: n(-1.5, 3) } },
      { key: "tO2", label: "tO2", ranges: { dog: n(8.4, 9.9), cat: n(8.4, 9.9) } },
    ],
  },
  {
    key: "heartworm",
    title: "심장사상충 항원검사",
    items: [{ key: "HW_AG", label: "HW Ag kit", qualitative: true, ranges: { dog: { text: "Negative" }, cat: { text: "Negative" } } }],
  },
  {
    key: "urine_stick",
    title: "뇨 스틱 검사",
    items: [
      { key: "U_pH", label: "pH", ranges: { dog: n(5.5, 7.5), cat: n(5.5, 7.5) } },
      { key: "U_PRO", label: "PRO (단백)", qualitative: true, ranges: { dog: { text: "음성" }, cat: { text: "음성" } } },
      { key: "U_GLU", label: "GLU (당)", qualitative: true, ranges: { dog: { text: "음성" }, cat: { text: "음성" } } },
      { key: "U_KET", label: "KET (케톤)", qualitative: true, ranges: { dog: { text: "음성" }, cat: { text: "음성" } } },
      { key: "U_BIL", label: "BIL (빌리루빈)", qualitative: true },
      { key: "U_BLD", label: "BLD (혈액)", qualitative: true, ranges: { dog: { text: "음성" }, cat: { text: "음성" } } },
      { key: "U_UBG", label: "UBG (우로빌리노겐)", qualitative: true },
      { key: "USG", label: "뇨비중 (USG)", ranges: { dog: n(1.015, 1.045), cat: n(1.035, 1.06) } },
    ],
  },
  { key: "antibody", title: "항체가 검사", narrative: true },
  { key: "ear", title: "귀 검사 (검이경)", narrative: true },
  { key: "dental", title: "구강 및 치아 검사", narrative: true },
  { key: "skin", title: "피부 검사", narrative: true },
  {
    key: "eye",
    title: "안과 검사",
    bilateral: true,
    items: [
      { key: "STT", label: "눈물량 검사 (STT)", unit: "mm/분", ranges: { dog: n(15, 25), cat: n(15, 25) } },
      { key: "IOP", label: "안압검사", unit: "mmHg", ranges: { dog: n(10, 20), cat: n(10, 20) } },
    ],
  },
  { key: "rad_thorax", title: "방사선 — 흉부", narrative: true },
  { key: "rad_abdomen", title: "방사선 — 복부", narrative: true },
  { key: "rad_limb", title: "방사선 — 관절 및 후지", narrative: true },
  { key: "us_abdomen", title: "복부 초음파", narrative: true },
  { key: "us_cardiac", title: "심장 초음파", narrative: true },
  { key: "conclusion", title: "담당의 종합 소견", narrative: true },
];

export const SECTION_BY_KEY = new Map(CHECKUP_SECTIONS.map((s) => [s.key, s]));

export function findItem(sectionKey: string, itemKey: string): CheckupItem | null {
  return SECTION_BY_KEY.get(sectionKey)?.items?.find((i) => i.key === itemKey) ?? null;
}

/** 종 문자열(개/강아지/고양이…) → 템플릿 종 */
export function toSpecies(species: string | null | undefined): Species | null {
  if (!species) return null;
  if (/고양이|cat|묘/i.test(species)) return "cat";
  if (/개|강아지|dog|견/i.test(species)) return "dog";
  return null;
}
