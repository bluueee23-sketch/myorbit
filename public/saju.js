/*
 * 나의 궤도 — 사주(원국) 계산
 *
 * 기준
 * - 입력 시각은 "태어난 곳(한국)의 그때 시계 시각"으로 받는다.
 * - Asia/Seoul 시간대 기록(Intl)을 써서 실제 순간(UTC)으로 바꾼다.
 *   → 서머타임(1948~51, 1955~60, 1987~88)과 표준시 UTC+8:30 시기(1954~61)가 자동 반영된다.
 * - 년주·월주: 입춘·12절기의 "정확한 시각"과 비교한다 (lunar.js 절기표, 베이징 시각 = UTC+8).
 * - 일주·시주: 서울 평균태양시(UTC+8:30 ≈ 동경 127.5°)로 본다.
 *   → 현재 시계(KST) 기준으로 자시는 23:30~01:30, 23:30부터 다음 날 일주(야자시 없음).
 * - 시간을 모르면 정오로 계산하고 시주는 비운다.
 *
 * 브라우저에서는 vendor/lunar.js 가 전역(Solar, Lunar)에 붙고, Node 에서는 require 로 불러온다.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./vendor/lunar.js'));
  } else {
    root.OrbitSaju = factory({ Solar: root.Solar, Lunar: root.Lunar, LunarMonth: root.LunarMonth });
  }
})(typeof self !== 'undefined' ? self : this, function (lib) {
  const { Solar, Lunar, LunarMonth } = lib;

  const STEM_H = '甲乙丙丁戊己庚辛壬癸';
  const STEM_K = '갑을병정무기경신임계';
  const BR_H = '子丑寅卯辰巳午未申酉戌亥';
  const BR_K = '자축인묘진사오미신유술해';
  const STEM_EL = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  const BR_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  // 지지의 본기(정기) 천간 — 십신 계산용
  const BR_MAIN = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];
  const EL_H = '木火土金水';
  const TEN_GODS = [['비견', '겁재'], ['식신', '상관'], ['편재', '정재'], ['편관', '정관'], ['편인', '정인']];
  const CAT_NAMES = ['비겁', '식상', '재성', '관성', '인성'];

  const mod = (a, n) => ((a % n) + n) % n;
  const H = 3600000;

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
  });
  function seoulParts(ms) {
    const o = {};
    fmt.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = +p.value; });
    return o;
  }
  /** 서울 시계 시각 → 실제 순간(UTC ms)과 그때의 UTC 오프셋(분) */
  function seoulWallToUtc(y, m, d, h, mi) {
    const wall = Date.UTC(y, m - 1, d, h, mi);
    let guess = wall - 9 * H;
    for (let i = 0; i < 4; i++) {
      const p = seoulParts(guess);
      const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess;
      const next = wall - offset;
      if (next === guess) break;
      guess = next;
    }
    const p = seoulParts(guess);
    const offsetMin = Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - guess) / 60000);
    return { utc: guess, offsetMin };
  }
  function solarAt(ms) {
    const t = new Date(ms);
    return Solar.fromYmdHms(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds());
  }
  function gzIndex(gz) {
    return { s: STEM_H.indexOf(gz[0]), b: BR_H.indexOf(gz[1]) };
  }
  function tenGod(dayStem, stem) {
    const rel = mod(STEM_EL[stem] - STEM_EL[dayStem], 5);
    return TEN_GODS[rel][(dayStem % 2) === (stem % 2) ? 0 : 1];
  }

  /**
   * @param {object} input
   *   year, month, day       — 입력한 날짜 (calendar 에 따라 양력/음력)
   *   calendar               — 'solar' | 'lunar'
   *   leap                   — 음력 윤달 여부
   *   hour, minute           — 시계 시각 (timeUnknown 이면 무시)
   *   timeUnknown            — 태어난 시간을 모름
   */
  function calculate(input) {
    let { year, month, day } = input;
    const lunarInput = input.calendar === 'lunar';
    if (lunarInput) {
      let l = null;
      try {
        const lm = LunarMonth.fromYm(year, input.leap ? -month : month);
        if (lm && day >= 1 && day <= lm.getDayCount()) l = Lunar.fromYmd(year, input.leap ? -month : month, day);
      } catch (e) { l = null; }
      if (!l) throw new Error(input.leap ? '그 해에는 해당 윤달이 없어요.' : '음력 날짜를 다시 확인해 주세요.');
      const s = l.getSolar();
      year = s.getYear(); month = s.getMonth(); day = s.getDay();
    } else {
      const real = new Date(Date.UTC(year, month - 1, day));
      if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) {
        throw new Error('없는 날짜예요. 다시 확인해 주세요.');
      }
    }

    const unknown = !!input.timeUnknown;
    const hh = unknown ? 12 : input.hour, mm = unknown ? 0 : input.minute;
    const { utc, offsetMin } = seoulWallToUtc(year, month, day, hh, mm);

    // 년·월: 실제 순간을 베이징 시각으로 바꿔 절기 시각과 비교
    const ecJie = solarAt(utc + 8 * H).getLunar().getEightChar();
    // 일·시: 서울 평균태양시(UTC+8:30), 23시(=KST 23:30)부터 다음 날
    const ecLocal = solarAt(utc + 8.5 * H).getLunar().getEightChar();
    ecLocal.setSect(1);

    const y = gzIndex(ecJie.getYear());
    const mo = gzIndex(ecJie.getMonth());
    const d = gzIndex(ecLocal.getDay());
    const t = unknown ? { s: null, b: null } : gzIndex(ecLocal.getTime());

    const pillars = [
      { k: '時', label: '시주', s: t.s, b: t.b },
      { k: '日', label: '일주', s: d.s, b: d.b },
      { k: '月', label: '월주', s: mo.s, b: mo.b },
      { k: '年', label: '년주', s: y.s, b: y.b }
    ].map((p, i) => {
      if (p.s === null) return p;
      return Object.assign(p, {
        stemGod: i === 1 ? '일간' : tenGod(d.s, p.s),
        branchGod: tenGod(d.s, BR_MAIN[p.b])
      });
    });

    const counts = [0, 0, 0, 0, 0];
    pillars.forEach((p) => { if (p.s !== null) { counts[STEM_EL[p.s]]++; counts[BR_EL[p.b]]++; } });
    const dayEl = STEM_EL[d.s];
    const catCount = [0, 0, 0, 0, 0];
    counts.forEach((n, el) => { catCount[mod(el - dayEl, 5)] += n; });

    const notes = [];
    // 표준 UTC+9 = 540분, 서머타임 600분 / 1954~61 표준 UTC+8:30 = 510분, 그 시기 서머타임 570분
    if (!unknown && (offsetMin === 600 || offsetMin === 570)) notes.push('서머타임 기간이라 1시간을 빼서 계산했어요.');
    if (offsetMin === 510 || offsetMin === 570) notes.push('당시 한국 표준시(UTC+8:30) 기준으로 계산했어요.');

    return {
      solarDate: { year, month, day },
      pillars, counts, catCount,
      ds: d.s, db: d.b, dayEl,
      offsetMin, notes, timeUnknown: unknown
    };
  }

  return { calculate, STEM_H, STEM_K, BR_H, BR_K, STEM_EL, BR_EL, EL_H, CAT_NAMES, mod };
});
