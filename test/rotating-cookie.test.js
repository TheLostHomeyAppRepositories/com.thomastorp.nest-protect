'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { fetchAccessToken } = require('../lib/nest-auth');

// Vakthund mot en feil vi allerede har gjort. I 1.3.5 fjernet vi
// __Secure-3PSIDTS fra krukka, i den tro at den ble foreldet fordi vi ikke
// kan fornye den slik en nettleser gjør. Den er bundet til __Secure-3PSID:
// en økt som ble opprettet med cookien krever den, og uten svarer Google
// USER_LOGGED_OUT med én gang. Rullet tilbake samme dag.
//
// Krukka skal sendes videre nøyaktig slik brukeren ga oss den. Vi legger
// ikke til, og vi fjerner ikke.

const ISSUE_TOKEN = 'https://accounts.google.com/o/oauth2/iframerpc'
  + '?action=issueToken&login_hint=x&client_id=y';

const JAR_WITH_TS = '__Secure-3PSID=a; __Secure-3PAPISID=b; NID=c; '
  + '__Host-3PLSID=d; __Secure-3PSIDCC=e; __Secure-3PSIDTS=f';

function stubFetch({ setCookie = [], body = { access_token: 't' } } = {}) {
  const original = global.fetch;
  const seen = {};
  global.fetch = async (url, options) => {
    seen.cookie = options.headers.cookie;
    return {
      ok: true,
      status: 200,
      headers: { getSetCookie: () => setCookie },
      json: async () => body,
    };
  };
  return { seen, restore: () => { global.fetch = original; } };
}

test('krukka sendes uendret til Google', async () => {
  const { seen, restore } = stubFetch();
  try {
    await fetchAccessToken(ISSUE_TOKEN, JAR_WITH_TS);
    assert.strictEqual(seen.cookie, JAR_WITH_TS);
  } finally { restore(); }
});

test('__Secure-3PSIDTS lagres videre når Google ikke rører den', async () => {
  const { restore } = stubFetch({ setCookie: ['__Secure-3PSIDCC=rotert; Path=/'] });
  try {
    const { cookie } = await fetchAccessToken(ISSUE_TOKEN, JAR_WITH_TS);
    assert.ok(cookie.includes('__Secure-3PSIDTS=f'), cookie);
    assert.ok(cookie.includes('__Secure-3PSIDCC=rotert'), cookie);
  } finally { restore(); }
});

test('en rotert __Secure-3PSIDTS fra Google tas imot', async () => {
  const { restore } = stubFetch({ setCookie: ['__Secure-3PSIDTS=ny; Path=/; Secure'] });
  try {
    const { cookie, rotated } = await fetchAccessToken(ISSUE_TOKEN, JAR_WITH_TS);
    assert.ok(cookie.includes('__Secure-3PSIDTS=ny'), cookie);
    assert.deepStrictEqual(rotated, ['__Secure-3PSIDTS']);
  } finally { restore(); }
});

test('en krukke uten cookien får den ikke oppfunnet', async () => {
  const jar = '__Secure-3PSID=a; NID=c';
  const { seen, restore } = stubFetch();
  try {
    const { cookie } = await fetchAccessToken(ISSUE_TOKEN, jar);
    assert.strictEqual(seen.cookie, jar);
    assert.ok(!cookie.includes('__Secure-3PSIDTS'), cookie);
  } finally { restore(); }
});
