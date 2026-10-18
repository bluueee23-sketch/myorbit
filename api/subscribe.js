// POST /api/subscribe — 메일 구독 신청을 받는다.
// 환경 변수 SUBSCRIBE_WEBHOOK_URL 이 있으면 그 주소로 그대로 넘긴다
// (구글 시트 Apps Script, Zapier, Make, 메일 서비스 웹훅 등).
// 없으면 501 을 돌려주고, 화면에는 "준비 중" 안내가 나간다.

export async function POST(request) {
  const hook = process.env.SUBSCRIBE_WEBHOOK_URL;
  if (!hook) return Response.json({ error: '메일 발송이 아직 연결되지 않았어요.' }, { status: 501 });

  let body;
  try { body = JSON.parse((await request.text()).slice(0, 4000)); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const email = String(body.email || '').trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'bad email' }, { status: 400 });

  const record = {
    email,
    monthly: !!body.monthly,
    issueUrl: String(body.issueUrl || '').slice(0, 1000),
    ilju: String(body.ilju || '').slice(0, 4),
    persona: String(body.persona || '').slice(0, 10),
    worry: String(body.worry || '').slice(0, 10),
    agreedAt: new Date().toISOString()
  };
  try {
    const res = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(record) });
    if (!res.ok) throw new Error('webhook ' + res.status);
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: '저장하지 못했어요.' }, { status: 502 });
  }
}
