/* 나의 궤도 — 화면 흐름: 신분 → 고민 → 생년월일 → 표지 → 본문 */
(function () {
  const C = window.ORBIT_CONTENT;
  const Z = window.OrbitSaju;
  const { PERSONAS, EL_K, EL_SUBJ, EL_SHORT, EL_COLOR_ADJ, ANIMAL, EL_HEX, THEMES, STEMS, CATS, WORRY, FILL } = C;
  const { STEM_H, STEM_K, BR_H, BR_K, STEM_EL, BR_EL, EL_H, mod } = Z;

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* 저장 안 돼도 화면은 그대로 */ } }
  };

  /* ---------- 상태 ---------- */
  const S = { persona: null, worry: null, cal: '양력', sex: '여', unknown: false, leap: false };
  let R = null;        // 계산 결과 + 입력
  let ARTICLE = null;  // 본문 원고 (견본 → AI 로 교체)
  let aiStatus = 'idle';

  function persona() { return PERSONAS.find((p) => p.id === S.persona) || PERSONAS[0]; }
  function worryItem() { return persona().items[S.worry ?? 0]; }

  function setTheme(i) {
    const t = THEMES[i];
    root.style.setProperty('--bg', t.bg); root.style.setProperty('--display', t.display);
    root.style.setProperty('--text', t.text); root.style.setProperty('--on-display', t.on);
    root.style.setProperty('--rule', t.text + '80');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
  }

  function go(name) {
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 's-' + name; });
    $('s-' + name).scrollTop = 0;
    if (name === 'worry') renderWorry();
    if (name === 'birth') renderBirthChips();
    if (name === 'cover') renderCover();
    if (name === 'inside') renderInside();
  }
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });

  /* ---------- 온보딩 ---------- */
  function renderWho() {
    $('who-list').innerHTML = '';
    PERSONAS.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'who'; b.type = 'button';
      b.setAttribute('aria-pressed', String(S.persona === p.id));
      b.innerHTML = `<b>${p.label}</b><span>${p.tag}</span>`;
      b.onclick = () => {
        if (S.persona !== p.id) S.worry = null;
        S.persona = p.id; renderWho();
        setTimeout(() => go('worry'), 260);
      };
      $('who-list').appendChild(b);
    });
  }
  function renderWorry() {
    const p = persona();
    $('worry-chip').textContent = `${p.label} · ${p.tag}`;
    $('worry-q').textContent = p.q;
    $('tiles').innerHTML = '';
    p.items.forEach(([label, tag, sub], i) => {
      const b = document.createElement('button');
      b.className = 'tile'; b.type = 'button';
      b.setAttribute('aria-pressed', String(S.worry === i));
      b.innerHTML = `<small>${tag}</small><b>${label}</b><span>${sub}</span>`;
      b.onclick = () => { S.worry = i; renderWorry(); setTimeout(() => go('birth'), 260); };
      $('tiles').appendChild(b);
    });
  }
  function renderBirthChips() {
    $('birth-chips').innerHTML = [persona().label, worryItem()[0]].map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  }
  function pills(id, opts, key, after) {
    $(id).innerHTML = '';
    opts.forEach((o) => {
      const b = document.createElement('button');
      b.className = 'pill'; b.type = 'button'; b.textContent = o;
      b.setAttribute('aria-pressed', String(S[key] === o));
      b.onclick = () => { S[key] = o; pills(id, opts, key, after); if (after) after(); };
      $(id).appendChild(b);
    });
  }
  function syncLeap() {
    $('f-leap').hidden = S.cal !== '음력';
    if (S.cal !== '음력') S.leap = false;
    $('f-leap').setAttribute('aria-pressed', String(S.leap));
  }
  pills('cal', ['양력', '음력'], 'cal', syncLeap);
  pills('sex', ['여', '남'], 'sex');
  $('f-leap').onclick = () => { S.leap = !S.leap; syncLeap(); };
  function syncUnknown() {
    $('f-unknown').setAttribute('aria-pressed', String(S.unknown));
    $('f-time').disabled = S.unknown;
    $('f-time').placeholder = S.unknown ? '시주 제외' : '04:30';
  }
  $('f-unknown').onclick = () => { S.unknown = !S.unknown; syncUnknown(); };
  $('f-date').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('.');
  });
  $('f-time').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d;
  });

  $('birth-next').onclick = () => {
    const dm = $('f-date').value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    const thisYear = new Date().getFullYear();
    if (!dm || +dm[1] < 1900 || +dm[1] > thisYear) { $('err').textContent = '생년월일을 1998.03.14처럼 8자리로 적어주세요.'; return; }
    let hh = 0, mi = 0;
    if (!S.unknown) {
      const tm = $('f-time').value.match(/^(\d{1,2}):(\d{2})$/);
      if (!tm || +tm[1] > 23 || +tm[2] > 59) { $('err').textContent = '시간은 04:30처럼 적거나, "시간을 몰라요"를 눌러주세요.'; return; }
      hh = +tm[1]; mi = +tm[2];
    }
    const input = {
      p: S.persona || PERSONAS[0].id, w: S.worry ?? 0,
      n: $('f-name').value.trim().slice(0, 10),
      c: S.cal === '음력' ? 'lunar' : 'solar', l: S.leap ? 1 : 0, x: S.sex,
      y: +dm[1], m: +dm[2], d: +dm[3], hh, mi, u: S.unknown ? 1 : 0
    };
    try { compute(input); } catch (e) { $('err').textContent = e.message; return; }
    $('err').textContent = '';
    try { history.replaceState(null, '', '#r=' + encodeState(input)); } catch (e) { /* 주소 저장 실패는 무시 */ }
    go('cover');
  };

  /* ---------- 계산 ---------- */
  function compute(raw) {
    // 공유 링크로 들어온 값도 여기서 정리한다
    const int = (v, lo, hi) => { const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n < lo || n > hi) throw new Error('잘못된 링크예요.'); return n; };
    const input = {
      p: PERSONAS.some((x) => x.id === raw.p) ? raw.p : PERSONAS[0].id,
      w: int(raw.w ?? 0, 0, 5),
      n: String(raw.n ?? '').slice(0, 10),
      c: raw.c === 'lunar' ? 'lunar' : 'solar', l: raw.l ? 1 : 0, x: raw.x === '남' ? '남' : '여',
      y: int(raw.y, 1900, 2100), m: int(raw.m, 1, 12), d: int(raw.d, 1, 31),
      hh: int(raw.hh ?? 0, 0, 23), mi: int(raw.mi ?? 0, 0, 59), u: raw.u ? 1 : 0
    };
    const r = Z.calculate({
      year: input.y, month: input.m, day: input.d,
      calendar: input.c, leap: !!input.l,
      hour: input.hh, minute: input.mi, timeUnknown: !!input.u
    });
    const pad = (n) => String(n).padStart(2, '0');
    r.input = input;
    r.name = input.n;
    r.dateLabel = `${input.y}.${pad(input.m)}.${pad(input.d)}`;
    r.timeLabel = input.u ? '시간 모름' : `${pad(input.hh)}:${pad(input.mi)}`;
    r.calLabel = input.c === 'lunar' ? (input.l ? '음력(윤)' : '음력') : '양력';
    R = r;
    S.persona = input.p; S.worry = input.w;
    ARTICLE = buildTemplate();
    aiStatus = 'idle';
    setTheme(R.dayEl);
    requestReading();
    return r;
  }

  function encodeState(o) {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeState(s) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  }

  /* ---------- 분석 ---------- */
  function analyse() {
    const counts = R.counts;
    const maxEl = counts.indexOf(Math.max(...counts));
    const missing = counts.map((n, i) => (n === 0 ? i : -1)).filter((i) => i >= 0);
    const minEl = counts.indexOf(Math.min(...counts));
    const strongCat = R.catCount.indexOf(Math.max(...R.catCount));
    const fillEl = missing.length ? missing[0] : minEl;
    return { maxEl, missing, minEl, strongCat, fillEl };
  }
  function headline(A) {
    const st = STEMS[R.ds];
    if (R.counts[A.maxEl] >= 3 && A.maxEl !== R.dayEl) return `${EL_K[A.maxEl]}${EL_SUBJ[A.maxEl]} 많은 ${st.meta}`;
    if (A.missing.length) return `${EL_K[A.missing[0]]}${EL_SUBJ[A.missing[0]]} 없는 ${st.meta}`;
    return `균형 잡힌 ${st.meta}`;
  }
  const ilju = () => STEM_H[R.ds] + BR_H[R.db];
  const iljuK = () => STEM_K[R.ds] + BR_K[R.db];
  const nick = () => `${EL_COLOR_ADJ[R.dayEl]} ${ANIMAL[R.db]}`;
  const who = () => R.name || '당신';

  /* 견본 원고 — AI 해석이 오기 전, 또는 AI 를 쓰지 않을 때 */
  function buildTemplate() {
    const A = analyse(), st = STEMS[R.ds], p = persona(), w = worryItem();
    const bal = [];
    R.catCount.forEach((n, ci) => { if (n >= 3) bal.push(CATS[ci].many); });
    R.catCount.forEach((n, ci) => { if (n === 0) bal.push(CATS[ci].none); });
    if (!bal.length) bal.push('다섯 기운이 비교적 고르게 퍼져 있어요. 한쪽으로 크게 쏠리지 않아서 상황에 따라 다른 얼굴을 꺼낼 수 있는 사람이에요. 대신 "나는 이런 사람"이라는 한 줄 정의가 잘 안 잡혀서, 스스로를 설명하는 데 시간이 걸리는 편이에요.');
    bal.push(`정리하면 ${who()}의 원국에서 가장 센 건 ${CATS[A.strongCat].ko}, 즉 ${CATS[A.strongCat].power}이에요. 이 힘을 어디에 쓰느냐가 지금 고민의 답과 바로 연결돼요.`);
    return {
      source: 'template',
      headline: headline(A),
      lede: `${R.name ? R.name + '씨' : '이번 호의 주인공'}의 원국을 받아 들었을 때, 제일 먼저 눈에 들어온 건 ${ilju()}라는 두 글자였다. ${iljuK()} 일주, 별명을 붙이자면 ${nick()}. ${p.label === '그 외' ? '자기만의 자리' : p.label + '의 자리'}에서 하루하루를 지나고 있는 지금, ${who()}는 "${w[0]}"을 가장 큰 고민으로 꼽았다. 이번 호는 그 질문에서 출발한다.`,
      profile: st.p,
      quote: st.quote,
      balance: bal,
      feature: [
        WORRY[w[1]],
        `${who()}의 경우, 이 고민에 쓸 수 있는 가장 큰 무기는 ${CATS[A.strongCat].power}이에요. ${STEM_K[R.ds]}${EL_SHORT[R.dayEl]} 일간 특유의 기질과 겹치면서, 남들보다 이 방향으로 움직일 때 힘이 덜 들어요. 반대로 ${EL_K[A.fillEl]}의 기운이 ${A.missing.length ? '비어 있어서' : '가장 약해서'}, 지칠 때 회복하는 속도가 느릴 수 있어요. 결정을 내리기 전에 그 빈자리를 먼저 채워두는 게 이번 호 편집부의 제안이에요.`
      ],
      pick: FILL[A.fillEl]
    };
  }

  /* ---------- AI 해석 ---------- */
  async function requestReading() {
    const key = 'reading:' + JSON.stringify(R.input);
    const cached = store.get(key);
    if (cached) { try { ARTICLE = JSON.parse(cached); aiStatus = 'done'; return; } catch (e) { /* 다시 요청 */ } }
    const A = analyse(), p = persona(), w = worryItem();
    const payload = {
      name: R.name, sex: R.input.x,
      persona: p.label, worry: { label: w[0], tag: w[1], sub: w[2] },
      pillars: R.pillars.map((pl) => pl.s === null ? { label: pl.label, unknown: true } : {
        label: pl.label, stem: STEM_H[pl.s] + '(' + STEM_K[pl.s] + ')', branch: BR_H[pl.b] + '(' + BR_K[pl.b] + ')',
        stemElement: EL_H[STEM_EL[pl.s]], branchElement: EL_H[BR_EL[pl.b]], stemGod: pl.stemGod, branchGod: pl.branchGod
      }),
      dayMaster: `${STEM_H[R.ds]}${EL_H[R.dayEl]} (${STEM_K[R.ds]}${EL_SHORT[R.dayEl]}, ${STEMS[R.ds].meta})`,
      ilju: `${ilju()} (${iljuK()}) 일주, 별명 ${nick()}`,
      elements: EL_H.split('').map((e, i) => `${e} ${R.counts[i]}`).join(', '),
      tenGodGroups: CATS.map((c, i) => `${c.name} ${R.catCount[i]}`).join(', '),
      strongest: CATS[A.strongCat].name,
      weakestElement: EL_H[A.fillEl],
      timeUnknown: R.timeUnknown,
      today: new Date().toISOString().slice(0, 10)
    };
    aiStatus = 'loading'; paintAiState();
    try {
      const res = await fetch('api/reading', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('status ' + res.status);
      const data = await res.json();
      if (!data || !data.article) throw new Error('empty');
      if (key !== 'reading:' + JSON.stringify(R.input)) return; // 그 사이 다른 결과로 바뀜
      ARTICLE = Object.assign(buildTemplate(), data.article, { source: 'ai' });
      store.set(key, JSON.stringify(ARTICLE));
      aiStatus = 'done';
    } catch (e) {
      aiStatus = 'off';
    }
    paintAiState();
    if (!$('s-inside').hidden) renderArticle();
  }
  function paintAiState() {
    const t = { idle: '', loading: 'AI 해석 쓰는 중…', done: 'AI 해석', off: '기본 원고' }[aiStatus];
    $('ai-state').textContent = t;
  }

  /* ---------- 필름 화보 대체 그림 (실제 화보가 들어갈 자리) ---------- */
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function paintScene(c, w, h, el, seed) {
    const r = rng(seed);
    const hz = h * (0.52 + r() * 0.1);
    const g = c.createLinearGradient(0, 0, 0, hz);
    const skies = [['#BFD3D6', '#E9E4D0'], ['#E9845A', '#F6C79A'], ['#C98A4B', '#F1D3A0'], ['#9EA6AC', '#E4E3DD'], ['#0E1730', '#34466F']];
    g.addColorStop(0, skies[el][0]); g.addColorStop(1, skies[el][1]);
    c.fillStyle = g; c.fillRect(0, 0, w, hz + 2);
    const sx = w * (0.25 + r() * 0.5);
    if (el === 1 || el === 2) { c.fillStyle = el === 1 ? '#FFE3B0' : '#FFF0C8'; c.beginPath(); c.arc(sx, hz - h * 0.06, w * (el === 1 ? 0.13 : 0.06), 0, 7); c.fill(); }
    if (el === 4) { for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; c.fillRect(r() * w, r() * hz * 0.9, w / 320, w / 320); } c.fillStyle = '#F2EBD3'; c.beginPath(); c.arc(sx, hz * 0.3, w * 0.05, 0, 7); c.fill(); }
    const u = w / 360;
    if (el === 0) {
      const fg = c.createLinearGradient(0, hz, 0, h); fg.addColorStop(0, '#6E7A3A'); fg.addColorStop(1, '#2F3A1A');
      c.fillStyle = fg; c.fillRect(0, hz, w, h - hz);
      for (let i = 0; i < 26; i++) { const x = r() * w, th = h * (0.18 + r() * 0.35), tw = (10 + r() * 22) * u; c.fillStyle = ['#2E3B1C', '#3D4C24', '#4E5A2A'][i % 3]; c.beginPath(); c.moveTo(x, hz - th); c.lineTo(x - tw, hz + 6 * u); c.lineTo(x + tw, hz + 6 * u); c.fill(); }
      c.lineWidth = u;
      for (let i = 0; i < 300; i++) { c.strokeStyle = `rgba(${150 + r() * 60},${170 + r() * 40},90,.5)`; const x = r() * w, y = hz + r() * (h - hz); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 4 * u, y - (6 + r() * 10) * u); c.stroke(); }
    } else if (el === 2) {
      for (let k = 0; k < 4; k++) {
        const base = hz + (h - hz) * (k / 4), col = ['#D9A35C', '#C88A42', '#B07330', '#8E5A22'][k];
        c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
        for (let x = 0; x <= w; x += 6 * u) c.lineTo(x, base - Math.sin(x / u / (60 + k * 30) + k * 2) * (18 + k * 6) * u - 10 * u);
        c.lineTo(w, h); c.fill();
      }
    } else {
      const seaTop = ['', '#8C3E2A', '', '#C9CCCB', '#101A33'][el], seaBot = ['', '#3E1D18', '', '#7E8485', '#05091A'][el];
      const sg = c.createLinearGradient(0, hz, 0, h); sg.addColorStop(0, seaTop); sg.addColorStop(1, seaBot);
      c.fillStyle = sg; c.fillRect(0, hz, w, h - hz);
      for (let i = 0; i < 90; i++) {
        const y = hz + Math.pow(r(), 1.6) * (h - hz); const len = (10 + r() * 50) * u;
        const x = el === 1 ? sx - 40 * u + (r() - 0.5) * 120 * u * (1 + (y - hz) / h) : r() * w;
        c.strokeStyle = el === 1 ? `rgba(255,214,160,${0.25 + r() * 0.5})` : el === 4 ? `rgba(180,200,240,${0.15 + r() * 0.3})` : `rgba(255,255,255,${0.2 + r() * 0.4})`;
        c.lineWidth = (1 + r()) * u; c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke();
      }
      if (el === 3) { for (let k = 0; k < 3; k++) { const rx = r() * w, rw = w * (0.15 + r() * 0.25), rh = h * (0.06 + r() * 0.12), ry = hz + (h - hz) * (0.3 + k * 0.25); c.fillStyle = ['#2E2E30', '#3B3B3D', '#232325'][k]; c.beginPath(); c.ellipse(rx, ry, rw, rh, 0, Math.PI, 0); c.lineTo(rx + rw, ry + 4 * u); c.lineTo(rx - rw, ry + 4 * u); c.fill(); } }
    }
    const lx = r() < 0.5 ? 0 : w, lg = c.createRadialGradient(lx, h * 0.15, 0, lx, h * 0.15, w * 0.7);
    lg.addColorStop(0, 'rgba(255,120,40,.38)'); lg.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = lg; c.fillRect(0, 0, w, h);
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  }
  function grain(c, pw, ph, seed) {
    const r = rng(seed + 1);
    const img = c.getImageData(0, 0, pw, ph), px = img.data;
    for (let i = 0; i < px.length; i += 4) { const n = (r() - 0.5) * 34; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
    c.putImageData(img, 0, 0);
  }
  function scene(cv, el, seed) {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScene(c, w, h, el, seed);
    c.setTransform(1, 0, 0, 1, 0, 0);
    grain(c, cv.width, cv.height, seed);
  }

  /* ---------- 표지 ---------- */
  function lineupItems(A) {
    const p = persona(), w = worryItem();
    const line = [`${EL_H[R.dayEl]} 일간`];
    if (R.counts[A.maxEl] >= 3) line.push(`${EL_H[A.maxEl]} 과다`);
    if (A.missing.length) line.push(`${A.missing.map((i) => EL_H[i]).join(' ')} 부재`);
    line.push(`${CATS[A.strongCat].name} 강세`, p.label, `${w[0]} 특집`);
    return line;
  }
  const coverSeed = () => R.ds * 97 + R.db * 13 + 7;
  function renderCover() {
    if (!R) return go('who');
    const A = analyse();
    $('lineup').innerHTML = lineupItems(A).map((t) => `<span>${esc(t)}</span>`).join('<span aria-hidden="true">·</span>');
    $('cover-ilju').textContent = ilju();
    $('cover-who').textContent = `${R.name ? R.name + ', ' : ''}${iljuK()} 일주 — ${nick()}`;
    $('cover-meta').textContent = `${R.dateLabel} · ${R.timeLabel} · ${R.calLabel}`;
    $('cover-tag').innerHTML = `ISSUE 01<br>${THEMES[R.dayEl].name} EDITION`;
    $('cover-feature').innerHTML = `<span>COVER STORY</span><b>${esc(headline(A))}</b>`;
    requestAnimationFrame(() => scene($('cv-cover'), R.dayEl, coverSeed()));
  }

  /* ---------- 본문 ---------- */
  function renderInside() {
    if (!R) return go('who');
    const A = analyse(), p = persona(), w = worryItem();
    $('in-top').textContent = `FEATURE — ${ilju()}`;
    $('in-kicker').textContent = `Cover Story · ${p.label} · ${w[0]} 특집`;
    $('in-stand').textContent = `${STEM_H[R.ds]}${EL_H[R.dayEl]} 일간, ${R.counts.map((n, i) => `${EL_H[i]} ${n}`).join(' · ')}. ${who()}의 여덟 글자를 펼쳐 놓고, 편집부가 가장 오래 들여다본 건 ${CATS[A.strongCat].name}의 자리였다.`;

    $('film-1').textContent = `ORBIT 400 · ${String(R.ds + 1).padStart(2, '0')}A`;
    $('cap-1').innerHTML = `<b>${EL_K[R.dayEl]}의 풍경.</b> ${STEM_K[R.ds]}${EL_SHORT[R.dayEl]} 일간의 계절감으로 고른 장면.`;

    $('wonguk').innerHTML = R.pillars.map((pl, i) => {
      if (pl.s === null) return `<div class="col off"><small>${pl.k} ${pl.label}</small><b>·</b><b>·</b><span>시간 모름</span></div>`;
      return `<div class="col${i === 1 ? ' me' : ''}"><small>${pl.k} ${pl.label}</small><em>${pl.stemGod}</em><b>${STEM_H[pl.s]}</b><b>${BR_H[pl.b]}</b><em>${pl.branchGod}</em><span>${EL_H[STEM_EL[pl.s]]} · ${EL_H[BR_EL[pl.b]]}</span></div>`;
    }).join('');
    const sd = R.solarDate;
    const conv = R.input.c === 'lunar' ? ` → 양력 ${sd.year}.${String(sd.month).padStart(2, '0')}.${String(sd.day).padStart(2, '0')}` : '';
    $('in-cap').textContent = [`${R.dateLabel} ${R.timeLabel} ${R.calLabel}${conv}`, '절기 시각 기준 · 서울 기준 자시 23:30', ...R.notes].join(' · ');

    const total = R.counts.reduce((a, b) => a + b, 0);
    $('bars').innerHTML = R.counts.map((n, i) => `<div class="barrow"><b>${EL_H[i]}</b><i style="width:${Math.max(n / total * 100, 1.5)}%;background:${EL_HEX[i]};${n ? '' : 'opacity:.35'}"></i><em>${n}</em><small>${CATS[mod(i - R.dayEl, 5)].name}</small></div>`).join('');

    $('film-2').textContent = `ORBIT 400 · ${String(A.fillEl + 12).padStart(2, '0')}A`;
    $('cap-2').innerHTML = `<b>채워야 할 ${EL_K[A.fillEl]}.</b> 원국에서 가장 부족한 기운을 장면으로 옮겼어요.`;
    $('in-feat-h').textContent = `특집 — ${w[0]}`;
    $('more-list').innerHTML = p.items.filter((_, i) => i !== (S.worry ?? 0)).map((it) => `<li>${esc(it[0])}</li>`).join('') + '<li>궁합</li><li>2027 신년운세</li>';
    $('ask-line').textContent = `"${w[2]}?"처럼 지금 고민을 그대로 물어볼 수 있게 준비하고 있어요. 답은 항상 ${who()}의 원국 근거와 함께 와요.`;
    $('endnote').textContent = '사주 해석은 재미와 자기 성찰을 위한 콘텐츠예요. 중요한 결정은 여러 정보와 함께 판단해 주세요.';
    paintAiState();
    renderArticle();
    requestAnimationFrame(() => {
      scene($('cv-1'), R.dayEl, R.ds * 31 + 3);
      scene($('cv-2'), A.fillEl, R.db * 53 + 11);
    });
  }
  function renderArticle() {
    const a = ARTICLE, w = worryItem(), A = analyse();
    $('in-head').textContent = a.headline;
    $('in-lede').innerHTML = `<p><span class="drop">${STEM_H[R.ds]}</span>${esc(a.lede)}</p>`;
    $('in-profile').innerHTML = (a.profile || []).map((t) => `<p>${esc(t)}</p>`).join('');
    $('in-quote').textContent = `“${a.quote}”`;
    $('in-balance').innerHTML = (a.balance || []).map((t) => `<p>${esc(t)}</p>`).join('');
    $('in-feat').innerHTML = `<h4>${esc(w[0])}<small>${esc(w[1])}</small></h4>` + (a.feature || []).map((t) => `<p>${esc(t)}</p>`).join('');
    const f = a.pick || FILL[A.fillEl];
    $('in-rx').innerHTML = `<small>EDITOR'S PICK — 부족한 ${EL_H[A.fillEl]} 채우기</small><b>${EL_K[A.fillEl]}의 기운을 곁에</b>
      <ul><li><span>COLOR</span><span>${esc(f.color)}</span></li><li><span>PLACE</span><span>${esc(f.place)}</span></li><li><span>DO</span><span>${esc(f.act)}</span></li></ul>`;
  }

  /* ---------- 9:16 공유 이미지 ---------- */
  async function makeStory() {
    const W = 1080, Hh = 1920, t = THEMES[R.dayEl], A = analyse();
    try {
      await Promise.all(['120px Anton', '120px "Black Han Sans"', '30px "IBM Plex Mono"'].map((f) => document.fonts.load(f, '궤도MY')));
    } catch (e) { /* 폰트가 없으면 대체 글꼴로 */ }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const c = cv.getContext('2d');
    const M = 64;
    c.fillStyle = t.bg; c.fillRect(0, 0, W, Hh);
    // 마스트헤드
    c.fillStyle = t.display; c.textBaseline = 'alphabetic';
    c.font = '300px Anton, Impact, sans-serif';
    c.fillText('MY', M - 6, 300);
    c.fillText('ORBIT', M - 6, 560);
    // 라인업
    c.strokeStyle = t.text + '80'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(M, 610); c.lineTo(W - M, 610); c.moveTo(M, 668); c.lineTo(W - M, 668); c.stroke();
    c.fillStyle = t.text;
    const items = lineupItems(A).join(' · ');
    let fs = 30;
    do { c.font = `500 ${fs}px "IBM Plex Mono", monospace`; fs -= 1; } while (c.measureText(items).width > W - M * 2 && fs > 14);
    c.fillText(items, M, 650);
    // 화보
    const px = M, py = 700, pw = W - M * 2, ph = 960;
    c.save(); c.beginPath(); c.rect(px, py, pw, ph); c.clip(); c.translate(px, py);
    paintScene(c, pw, ph, R.dayEl, coverSeed());
    c.restore();
    // 태그
    c.fillStyle = t.display; c.fillRect(px + pw - 260, py + 24, 236, 80);
    c.fillStyle = t.on; c.font = '500 24px "IBM Plex Mono", monospace'; c.textAlign = 'right';
    c.fillText('ISSUE 01', px + pw - 40, py + 58);
    c.fillText(`${t.name} EDITION`, px + pw - 40, py + 90);
    c.textAlign = 'left';
    // 일주 + 별명
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 30;
    c.fillStyle = t.display; c.font = '330px "Black Han Sans", sans-serif';
    c.fillText(ilju(), px + 28, py + ph - 150);
    c.fillStyle = '#fff'; c.font = '56px "Black Han Sans", sans-serif';
    c.fillText(`${R.name ? R.name + ', ' : ''}${nick()}`, px + 32, py + ph - 70);
    c.font = '500 26px "IBM Plex Mono", monospace';
    c.fillText(`${iljuK()} 일주 · ${R.dateLabel}`, px + 34, py + ph - 28);
    c.shadowBlur = 0;
    // 하단
    c.fillStyle = t.text; c.font = '500 28px "IBM Plex Mono", monospace';
    c.fillText('COVER STORY', M, 1730);
    c.font = '64px "Black Han Sans", sans-serif';
    c.fillText(ARTICLE.headline.slice(0, 16), M, 1810);
    c.font = '500 26px "IBM Plex Mono", monospace'; c.textAlign = 'right';
    c.fillText('나의 궤도 · MY ORBIT', W - M, 1870);
    c.textAlign = 'left';
    grain(c, W, Hh, coverSeed());
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }
  $('share').onclick = async () => {
    if (!R) return;
    toast('표지를 만드는 중…');
    const blob = await makeStory();
    if (!blob) { toast('이미지를 만들지 못했어요'); return; }
    const file = new File([blob], 'my-orbit-cover.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '나의 궤도' }); hideToast(); return; } catch (e) { if (e && e.name === 'AbortError') { hideToast(); return; } }
    }
    hideToast();
    const url = URL.createObjectURL(blob);
    $('sheet-img').src = url; $('sheet-dl').href = url;
    $('sheet').hidden = false;
  };
  $('sheet-close').onclick = () => { $('sheet').hidden = true; };

  /* ---------- 메일 ---------- */
  $('mail-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = $('f-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { $('mail-msg').textContent = '메일 주소를 you@example.com 형식으로 적어주세요.'; return; }
    if (!$('f-agree').checked) { $('mail-msg').textContent = '이메일 수집·이용에 동의해 주세요.'; return; }
    $('mail-btn').disabled = true; $('mail-msg').textContent = '보내는 중…';
    try {
      const res = await fetch('api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, monthly: $('f-monthly').checked, issueUrl: location.href, ilju: ilju(), persona: persona().label, worry: worryItem()[0] })
      });
      $('mail-msg').textContent = res.ok
        ? `${v}로 이번 호를 보낼게요${$('f-monthly').checked ? '. 다음 달 호도 알려드릴게요' : ''}.`
        : '메일 발송은 아직 준비 중이에요. 이 페이지 주소를 저장해 두면 언제든 다시 볼 수 있어요.';
    } catch (err) {
      $('mail-msg').textContent = '지금은 보낼 수 없어요. 잠시 후 다시 시도해 주세요.';
    }
    $('mail-btn').disabled = false;
  });

  /* ---------- 기타 ---------- */
  let toastT;
  function toast(msg) { $('toast').textContent = msg; $('toast').hidden = false; clearTimeout(toastT); toastT = setTimeout(hideToast, 2400); }
  function hideToast() { $('toast').hidden = true; }

  $('restart').onclick = () => {
    Object.assign(S, { persona: null, worry: null, unknown: false, leap: false, cal: '양력' });
    ['f-name', 'f-date', 'f-time', 'f-email'].forEach((id) => { $(id).value = ''; });
    $('mail-msg').textContent = '';
    pills('cal', ['양력', '음력'], 'cal', syncLeap); syncLeap(); syncUnknown();
    R = null; ARTICLE = null; setTheme(1);
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* 무시 */ }
    renderWho(); go('who');
  };

  /* ---------- 시작: 주소에 결과가 있으면 바로 표지 ---------- */
  renderWho();
  const m = location.hash.match(/^#r=([\w-]+)$/);
  if (m) {
    try { compute(decodeState(m[1])); go('cover'); } catch (e) { go('who'); }
  }
})();
