'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { authenticate } = require('../lib/nest-auth');

// Rapportert av en bruker (USER_LOGGED_OUT etter en time): Google roterer
// __Secure-3PSIDCC ved steg 1, men den roterte cookien ble tidligere bare
// lagret hvis steg 2 (JWT) og steg 3 (session) også lyktes. Feilet et av dem,
// gikk rotasjonen tapt, og neste fornyelse brukte den utdaterte cookien til
// Google logget klienten ut. Samme feil som ha-nest-protect #555/#568.

const ISSUE_TOKEN = 'https://accounts.google.com/o/oauth2/iframerpc'
  + '?action=issueToken&login_hint=x&client_id=y';
const OLD_COOKIE = '__Secure-3PSID=abc';

// Stubber fetch per steg ut fra URL. rotate=true lar steg 1 sette en ny
// __Secure-3PSIDCC; jwtOk=false lar steg 2 feile etter at steg 1 lyktes.
function stubChain({ rotate = true, jwtOk = true } = {}) {
  const original = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('iframerpc')) {
      return {
        ok: true,
        status: 200,
        headers: { getSetCookie: () => (rotate ? ['__Secure-3PSIDCC=NEW; Path=/; Secure'] : []) },
        json: async () => ({ access_token: 't', expires_in: 3600 }),
      };
    }
    if (u.includes('issue_jwt')) {
      return {
        ok: jwtOk,
        status: jwtOk ? 200 : 500,
        headers: { getSetCookie: () => [] },
        json: async () => ({ jwt: 'J' }),
      };
    }
    // /session
    return {
      ok: true,
      status: 200,
      headers: { getSetCookie: () => [] },
      json: async () => ({ userid: 'u', urls: { transport_url: 'https://transport' } }),
    };
  };
  return () => { global.fetch = original; };
}

test('rotert cookie lagres selv om JWT-steget feiler etterpå', async () => {
  const restore = stubChain({ rotate: true, jwtOk: false });
  let saved = null;
  try {
    await assert.rejects(
      authenticate(ISSUE_TOKEN, OLD_COOKIE, { onCookie: async (c) => { saved = c; } }),
      /Nest authentication service/,
    );
  } finally { restore(); }
  // Det avgjørende: cookien ble lagret FØR feilen, ikke tapt med den.
  assert.ok(saved, 'onCookie ble kalt');
  assert.ok(saved.includes('__Secure-3PSIDCC=NEW'), 'fikk den roterte verdien');
  assert.ok(saved.includes('__Secure-3PSID=abc'), 'beholdt den opprinnelige økt-cookien');
});

test('rotert cookie lagres også ved full suksess', async () => {
  const restore = stubChain({ rotate: true, jwtOk: true });
  let saved = null;
  try {
    const res = await authenticate(ISSUE_TOKEN, OLD_COOKIE, { onCookie: async (c) => { saved = c; } });
    assert.ok(res.cookie.includes('__Secure-3PSIDCC=NEW'));
  } finally { restore(); }
  assert.ok(saved && saved.includes('__Secure-3PSIDCC=NEW'));
});

test('ingen rotasjon → onCookie kalles ikke', async () => {
  const restore = stubChain({ rotate: false, jwtOk: true });
  let called = false;
  try {
    await authenticate(ISSUE_TOKEN, OLD_COOKIE, { onCookie: async () => { called = true; } });
  } finally { restore(); }
  assert.equal(called, false);
});

// --- 1.3.4: instrumentering og tydelig USER_LOGGED_OUT ---

const { changedCookieNames, fetchAccessToken } = require('../lib/nest-auth');

test('changedCookieNames gir bare navn, sortert, aldri verdier', () => {
  const before = '__Secure-3PSID=a; __Secure-3PSIDCC=old; NID=1';
  const after = '__Secure-3PSID=a; __Secure-3PSIDCC=new; NID=1; __Secure-3PSIDTS=ts';
  assert.deepEqual(changedCookieNames(before, after), ['__Secure-3PSIDCC', '__Secure-3PSIDTS']);
  assert.deepEqual(changedCookieNames(before, before), []);
  // fjernet teller også som endret
  assert.deepEqual(changedCookieNames(before, '__Secure-3PSID=a; NID=1'), ['__Secure-3PSIDCC']);
});

test('fetchAccessToken rapporterer hvilke cookies som roterte', async () => {
  const restore = stubChain({ rotate: true, jwtOk: true });
  try {
    const token = await fetchAccessToken(ISSUE_TOKEN, OLD_COOKIE);
    assert.deepEqual(token.rotated, ['__Secure-3PSIDCC']);
    assert.equal(token.setCookieCount, 1);
  } finally { restore(); }
});

test('onExchange kalles også når Google ikke roterte noe', async () => {
  const restore = stubChain({ rotate: false, jwtOk: true });
  const seen = [];
  try {
    await authenticate(ISSUE_TOKEN, OLD_COOKIE, {
      onExchange: async (info) => { seen.push(info); },
      onCookie: async () => { throw new Error('skal ikke kalles uten endring'); },
    });
  } finally { restore(); }
  assert.equal(seen.length, 1);
  assert.equal(seen[0].changed, false);
  assert.deepEqual(seen[0].rotated, []);
  assert.equal(seen[0].setCookieCount, 0);
});

test('USER_LOGGED_OUT forklarer at brukeren må reparere', async () => {
  const original = global.fetch;
  global.fetch = async () => ({
    ok: true, status: 200,
    headers: { getSetCookie: () => [] },
    json: async () => ({ error: 'USER_LOGGED_OUT' }),
  });
  try {
    await assert.rejects(
      fetchAccessToken(ISSUE_TOKEN, OLD_COOKIE),
      (err) => err.code === 'USER_LOGGED_OUT'
        && err.retryable === false
        && /Repair/.test(err.message)
        && /USER_LOGGED_OUT/.test(err.message),
    );
  } finally { global.fetch = original; }
});
