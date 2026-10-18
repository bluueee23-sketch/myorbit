// POST /api/reading — 원국 정보를 받아 AI 해석 원고(JSON)를 돌려준다.
// 환경 변수: ANTHROPIC_API_KEY (필수), ANTHROPIC_MODEL (선택)
// 키가 없으면 501 을 돌려주고, 화면은 기본 원고를 그대로 보여준다.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

const SYSTEM = `당신은 사주 매거진 "나의 궤도(MY ORBIT)"의 수석 에디터다.
독자 한 사람의 원국(사주 여덟 글자)을 취재해 그 사람만을 위한 피처 기사를 쓴다.

원칙
- 근거: 반드시 주어진 원국(일간, 오행 개수, 십신 분포, 각 기둥의 십신)에 근거해서 쓴다. 근거를 문장 안에 자연스럽게 드러낸다 (예: "월지에 정관이 앉아 있어서").
- 개인화: 독자의 신분과 지금 고민을 계속 붙잡고 쓴다. 누구에게나 맞는 말(바넘 효과식 문장)은 피한다.
- 톤: 다정하지만 단단한 잡지 문장. 겁주거나 단정하지 않는다. 불행·질병·사고·죽음을 예언하지 않는다. 의료·법률·투자 판단을 대신하지 않는다.
- 문체: lede 는 매거진 리드처럼 "~다"체, 나머지는 "~요"체.
- 시간을 모르면 시주 없이 본다는 점을 전제로 쓴다. 없는 정보를 지어내지 않는다 (대운·세운 계산값은 주어지지 않았으니 구체적인 연도 예언은 하지 않는다).
- 한자는 꼭 필요한 곳에만 쓰고, 처음 나오는 사주 용어는 쉬운 말로 풀어준다.

출력은 아래 JSON 하나만. 코드 블록이나 다른 말은 붙이지 않는다.
{
  "headline": "표지 헤드라인, 16자 이내",
  "lede": "리드 문단, 2~3문장",
  "profile": ["일간과 일주로 본 이 사람, 문단 1", "문단 2"],
  "quote": "본문에서 뽑은 풀쿼트, 25자 이내, 중간에 줄바꿈(\\n) 한 번",
  "balance": ["오행·십신 밸런스 해설 문단 1", "문단 2"],
  "feature": ["지금 고민에 대한 답 문단 1", "문단 2", "문단 3 — 이번 달에 해볼 구체적인 행동 하나로 마무리"],
  "pick": { "color": "부족한 기운을 채우는 색", "place": "장소", "act": "행동" }
}`;

function clean(v, max) {
  return String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
}

function buildPrompt(b) {
  const pillars = (Array.isArray(b.pillars) ? b.pillars : []).slice(0, 4).map((p) => p.unknown
    ? `- ${clean(p.label, 10)}: 시간 모름`
    : `- ${clean(p.label, 10)}: 천간 ${clean(p.stem, 12)}(${clean(p.stemElement, 2)}, ${clean(p.stemGod, 4)}) / 지지 ${clean(p.branch, 12)}(${clean(p.branchElement, 2)}, ${clean(p.branchGod, 4)})`).join('\n');
  const w = b.worry || {};
  return `오늘 날짜: ${clean(b.today, 10)}
독자: ${clean(b.name, 10) || '이름 비공개'} (${clean(b.sex, 2)})
신분: ${clean(b.persona, 10)}
이번 호 특집(지금 고민): ${clean(w.label, 10)} — ${clean(w.sub, 30)}

원국
${pillars}
일간: ${clean(b.dayMaster, 40)}
일주: ${clean(b.ilju, 40)}
오행 개수: ${clean(b.elements, 60)}
십신 분포: ${clean(b.tenGodGroups, 60)}
가장 강한 십신 무리: ${clean(b.strongest, 4)}
가장 약한 오행: ${clean(b.weakestElement, 2)}
${b.timeUnknown ? '태어난 시간을 몰라 시주 없이 본다.' : ''}

이 독자를 위한 이번 호 피처 기사를 JSON 으로 써줘.`;
}

function pickArticle(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < s) return null;
  let j;
  try { j = JSON.parse(text.slice(s, e + 1)); } catch { return null; }
  const arr = (a, n, max) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => clean(x, max)).filter(Boolean);
  const out = {
    headline: clean(j.headline, 24),
    lede: clean(j.lede, 400),
    profile: arr(j.profile, 3, 600),
    quote: String(j.quote ?? '').slice(0, 40).replace(/\\n/g, '\n'),
    balance: arr(j.balance, 3, 600),
    feature: arr(j.feature, 4, 700)
  };
  if (j.pick && typeof j.pick === 'object') {
    out.pick = { color: clean(j.pick.color, 40), place: clean(j.pick.place, 60), act: clean(j.pick.act, 80) };
  }
  if (!out.headline || !out.lede || !out.feature.length) return null;
  return out;
}

export async function POST(request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'AI 해석이 아직 연결되지 않았어요.' }, { status: 501 });

  const raw = await request.text();
  if (raw.length > 8000) return Response.json({ error: 'too large' }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{ role: 'user', content: buildPrompt(body) }]
      })
    });
    if (!res.ok) {
      console.error('anthropic error', res.status, (await res.text()).slice(0, 500));
      return Response.json({ error: 'AI 해석을 받지 못했어요.' }, { status: 502 });
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const article = pickArticle(text);
    if (!article) return Response.json({ error: '해석 형식이 맞지 않아요.' }, { status: 502 });
    return Response.json({ article });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'AI 해석을 받지 못했어요.' }, { status: 502 });
  }
}
