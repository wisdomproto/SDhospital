// 병원 홈페이지(sdamc.co.kr)에서 치료 사례와 병원 소식을 가져온다.
//   node supabase/seed/seed_from_website.mjs
//
// **글을 새로 쓰지 않는다.** 병원은 이미 147편을 썼고 보호자가 그걸 못 볼 뿐이다.
// 우리는 제목·요약·주소만 가져와 태그를 달고, 읽는 건 병원 홈페이지에서 읽게 한다.
//
// 태그는 **제목만 보고** 단다. 본문 도입부는 온갖 병명을 스치듯 언급해서(간종양 글에도 "심장"이 나온다)
// 본문까지 보면 엉뚱한 사례가 붙는다. 상관없는 사례가 리포트에 붙는 순간 그건 광고로 읽히고,
// 리포트 전체의 신뢰가 깎인다 — 그래서 **제목으로 못 고르면 붙이지 않는다**(`active=false`).
// 그 글들은 직원 화면(`/cases`)에 남아 있으니 수의사가 직접 태그를 달면 그때 살아난다.
//
// 되돌리기: `demo_history_rollback.sql` 이 c0000000-(사례) · b0000000-(소식) 행을 지운다.
import { createClient } from "@supabase/supabase-js";

const SITE = "https://sdamc.co.kr";
const Q = "YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";

/**
 * 증상 태그. 매칭은 `주 증상.includes(태그)` 라서 **병명을 집는 말만** 쓴다.
 *
 * 식욕·체중·구토 같은 흔한 말은 태그로 쓰지 않는다. 주 증상 절반에 들어 있어서
 * "기침 및 식욕 저하" 에 요로결석 글이 붙는다. 짧은 말도 안 된다 —
 * "간" 은 **"간헐적 구토"에 걸린다**. 실제로 그렇게 붙는 걸 보고 고쳤다.
 */
const TAGS = [
  [/슬개골/, ["슬개골"]],
  [/십자인대|TPLO|전십자/i, ["십자인대"]],
  [/디스크|추간판|IVDD/i, ["디스크"]],
  [/고관절|대퇴골두/, ["고관절"]],
  [/골절/, ["골절"]],
  [/PDA|동맥관/i, ["PDA", "심잡음"]],
  [/이첨판|승모판|MMVD|심잡음|폐수종|심부전|심장/i, ["심잡음", "심장"]],
  [/담낭|담즙|담관/, ["담낭"]],
  [/췌장/, ["췌장"]],
  [/간세포|간종양|간 ?종괴|간수치|간엽/, ["간종양", "간수치"]],
  [/지방종/, ["지방종", "종괴"]],
  [/비만세포종/, ["비만세포종", "종괴"]],
  [/종양|암종|육종|림프종|선종|종괴/, ["종괴", "종양"]],
  [/투석/, ["투석"]],
  [/신부전|신장|CKD|요관/i, ["신장", "신부전"]],
  [/방광|결석|요도|배뇨|혈뇨|전립선/, ["결석", "혈뇨", "배뇨"]],
  [/자궁축농증|자궁/, ["자궁"]],
  [/아토피|피부|가려움|탈모/, ["피부", "가려움"]],
  [/외이도|외이염|귓병/, ["외이염"]],
  [/각막|백내장|녹내장/, ["백내장", "각막"]],
  [/발치|치아|구강|치석/, ["치아", "구강"]],
  [/기관허탈/, ["기관허탈", "기침"]],
  [/기침|폐렴|호흡곤란/, ["기침", "호흡곤란"]],
  [/비강|콧물|재채기|비염/, ["콧물", "비염"]],
  [/이물/, ["이물"]],
  [/십이지장|장중첩|장염|위염/, ["장염", "설사"]],
  [/복막염/, ["복막염"]],
  [/빈혈|혈소판|IMHA|IMT/i, ["빈혈", "혈소판"]],
  [/당뇨/, ["당뇨"]],
  [/쿠싱|부신/, ["쿠싱"]],
  [/갑상선/, ["갑상선"]],
  [/발작|경련|뇌수|전정|사경|수두증/, ["발작", "경련", "사경"]],
];

const get = (url) => fetch(url, { headers: { "user-agent": UA, "accept-language": "ko" } }).then((r) => r.text());
/** og 태그 값은 HTML 로 이스케이프돼 있다 — 그대로 넣으면 화면에 `&#039;` 가 보인다 */
const unescapeHtml = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

const meta = (html, prop) =>
  (html.match(new RegExp(`property=["']og:${prop}["'][^>]*content=["']([^"']*)`)) ??
    html.match(new RegExp(`content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`)) ?? [])[1] ?? "";
const ogText = (html, prop) => unescapeHtml(meta(html, prop));

/** 제목 뒤에 붙은 SEO 꼬리("… | 중구동물병원 : SD동물의료센터 스토리")를 떼어 낸다 */
const cleanTitle = (t) =>
  t.split(/[|｜]/)[0].split(" : ")[0].replace(/\(.*?동물\S*\)/g, "").replace(/\s+/g, " ").trim();

const cleanBody = (d) =>
  d
    .replace(/^>?\s*(원글로 이동|원글 ?보러가기|해당 글의 (블로그 포스팅 )?(원글 )?보러가기!?)>?\s*/g, "")
    .replace(/^안녕하세요[,.]?\s*SD\s*동물의료센터입니다\.?\s*/, "")
    .trim();

async function listIds(board) {
  const ids = new Set();
  let last = "";
  for (let page = 1; page <= 40; page++) {
    const html = await get(`${SITE}/${board}/?q=${Q}&page=${page}`);
    const found = [...html.matchAll(/bmode=view&(?:amp;)?idx=(\d+)/g)].map((m) => m[1]);
    const key = found.join(",");
    if (!found.length || key === last) break; // 마지막 페이지를 넘기면 같은 목록이 계속 나온다
    last = key;
    found.forEach((id) => ids.add(id));
  }
  return [...ids];
}

async function detail(board, id) {
  const html = await get(`${SITE}/${board}/?q=${Q}&bmode=view&idx=${id}&t=board`);
  return {
    id,
    title: cleanTitle(ogText(html, "title")),
    body: cleanBody(ogText(html, "description")),
    image: meta(html, "image"),
    url: `${SITE}/${board}/?bmode=view&idx=${id}&t=board`,
  };
}

/** 병렬로 긁되 한 번에 8개까지 — 남의 서버다 */
async function mapLimit(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  }
  return out;
}

const uuid = (prefix, id) => `${prefix}-0000-4000-8000-${String(id).padStart(12, "0")}`;

/** 요약으로 쓸 수 없는 첫 문장들 — 블로그 껍데기지 사례 설명이 아니다 */
const JUNK = /^(해당 이미지|원글|지난 포스팅|안녕하세요|:\)|이미지를 클릭)/;

/**
 * 첫 문장만 쓴다. 껍데기 문장이거나 제목을 되풀이하면 **요약을 비운다** —
 * 제목 밑에 제목이 한 번 더 있으면 읽는 사람은 그 카드를 통째로 건너뛴다.
 */
const firstSentence = (s, max, title = "") => {
  const one = (s.replace(/^:\)\s*/, "").split(/(?<=[.!?])\s|(?<=다\.)/)[0] ?? s).trim();
  if (!one || JUNK.test(one)) return null;
  if (title && (title.startsWith(one.slice(0, 20)) || one.startsWith(title.slice(0, 20)))) return null;
  return one.length > max ? one.slice(0, max - 1) + "…" : one;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const { error: authErr } = await supabase.auth.signInWithPassword({
  email: "staff@sdhospital.test",
  password: "sdhospital123!",
});
if (authErr) throw authErr;

// ── 치료 사례 ────────────────────────────────────────────────
const storyIds = await listIds("Story");
console.log(`Story ${storyIds.length}편`);
const stories = await mapLimit(storyIds, 8, (id) => detail("Story", id));

const cases = stories
  .filter((s) => s.title)
  .map((s) => {
    const tags = [...new Set(TAGS.filter(([re]) => re.test(s.title)).flatMap(([, v]) => v))].slice(0, 3);
    const species = /고양이|냥이|묘|캣/.test(s.title)
      ? "고양이"
      : /강아지|반려견|말티|푸들|포메|시츄|비숑|닥스|리트리버|치와와|웰시|코카/.test(s.title)
        ? "강아지"
        : null;
    return {
      id: uuid("c0000000", s.id),
      title: s.title.slice(0, 200),
      url: s.url,
      summary: firstSentence(s.body, 90, s.title),
      tags,
      species,
      // 태그를 못 단 글은 숨긴 채로 넣는다 — 버리면 다시 긁어야 하고, 켜 두면 엉뚱한 데 붙는다
      active: tags.length > 0,
    };
  });

const { error: caseErr } = await supabase.from("case_story").upsert(cases);
if (caseErr) throw caseErr;
console.log(`  사례 ${cases.length}건 (노출 ${cases.filter((c) => c.active).length} · 태그 대기 ${cases.filter((c) => !c.active).length})`);

// ── 병원 소식 ────────────────────────────────────────────────
const noticeIds = await listIds("Notice");
const notices = (await mapLimit(noticeIds, 8, (id) => detail("Notice", id))).filter((n) => n.title);
const today = new Date();
const { error: noticeErr } = await supabase.from("notice").upsert(
  notices.map((n, i) => ({
    id: uuid("b0000000", n.id),
    title: n.title.slice(0, 200),
    body: firstSentence(n.body, 220, n.title),
    image_url: n.image || null,
    link_url: n.url,
    link_label: "홈페이지에서 읽기",
    // 최신 글이 위로 오도록 하루씩 물린다. 소식은 기간이 지나면 RLS 가 감추므로 종료일은 비운다
    starts_on: new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10),
    pinned: false,
  }))
);
if (noticeErr) throw noticeErr;
console.log(`  소식 ${notices.length}건`);
