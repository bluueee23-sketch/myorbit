// 사주 계산 테스트 — npm test
// 만세력 대조 검증(100건)이 끝나면 여기에 케이스를 계속 추가한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// public/ 의 파일은 브라우저용 스크립트라서, CommonJS 처럼 감싸서 불러온다
function load(rel, req) {
  const mod = { exports: {} };
  new Function('module', 'require', readFileSync(new URL(rel, import.meta.url), 'utf8'))(mod, req);
  return mod.exports;
}
const lunar = load('../public/vendor/lunar.js');
const Z = load('../public/saju.js', () => lunar);

const gz = (r) => r.pillars.map((p) => (p.s === null ? '--' : Z.STEM_H[p.s] + Z.BR_H[p.b])).reverse().join(' ');
const calc = (y, m, d, hour, minute, extra = {}) => Z.calculate({ year: y, month: m, day: d, hour, minute, ...extra });

test('기본: 1998-03-14 04:30 양력', () => {
  assert.equal(gz(calc(1998, 3, 14, 4, 30)), '戊寅 乙卯 庚申 戊寅');
});

test('일주 기준점: 2024-01-01 은 甲子일, 2000-01-01 은 戊午일', () => {
  assert.equal(gz(calc(2024, 1, 1, 12, 0)).split(' ')[2], '甲子');
  assert.equal(gz(calc(2000, 1, 1, 12, 0)).split(' ')[2], '戊午');
});

test('입춘 경계: 2024 입춘(한국 17:27) 전후로 년주가 바뀐다', () => {
  assert.equal(gz(calc(2024, 2, 4, 17, 0)).split(' ')[0], '癸卯');
  assert.equal(gz(calc(2024, 2, 4, 17, 40)).split(' ')[0], '甲辰');
});

test('자시: 23:30 전은 같은 날 亥시, 23:30 부터 다음 날 子시', () => {
  assert.equal(gz(calc(2024, 1, 1, 23, 20)), '癸卯 甲子 甲子 乙亥');
  assert.equal(gz(calc(2024, 1, 1, 23, 40)), '癸卯 甲子 乙丑 丙子');
});

test('시주 경계: 17:30 KST 부터 酉시', () => {
  assert.equal(gz(calc(2024, 2, 4, 17, 20)).split(' ')[3].slice(1), '申');
  assert.equal(gz(calc(2024, 2, 4, 17, 35)).split(' ')[3].slice(1), '酉');
});

test('서머타임: 1988-07-01 12:00 은 한 시간 빼서 巳시', () => {
  const r = calc(1988, 7, 1, 12, 0);
  assert.equal(r.offsetMin, 600);
  assert.equal(gz(r).split(' ')[3].slice(1), '巳');
  assert.ok(r.notes.some((n) => n.includes('서머타임')));
});

test('음력 윤달 변환: 1998 윤5월 1일 = 양력 1998-06-24', () => {
  const r = Z.calculate({ year: 1998, month: 5, day: 1, calendar: 'lunar', leap: true, timeUnknown: true });
  assert.deepEqual(r.solarDate, { year: 1998, month: 6, day: 24 });
  assert.equal(r.pillars[0].s, null);
});

test('없는 날짜·없는 윤달은 에러', () => {
  assert.throws(() => calc(1999, 2, 30, 0, 0));
  assert.throws(() => Z.calculate({ year: 1999, month: 5, day: 1, calendar: 'lunar', leap: true, timeUnknown: true }));
});

test('십신: 일간 庚 기준 년간 戊 = 편인', () => {
  const r = calc(1998, 3, 14, 4, 30);
  assert.equal(r.pillars[3].stemGod, '편인');
  assert.equal(r.pillars[1].stemGod, '일간');
});
