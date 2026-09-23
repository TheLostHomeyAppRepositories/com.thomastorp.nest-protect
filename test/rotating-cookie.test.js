'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { fetchAccessToken, stripRotatingCookie } = require('../lib/nest-auth');

// __Secure-3PSIDTS fornyes normalt av nettleseren hvert kvarter. Vi kan ikke
// fornye den, og Google avslutter økten når vår kopi blir for gammel. To
// brukere mistet forbindelsen på tredje fornyelse, rundt to og en halv time
// etter at de limte inn. Testene her holder cookien ute av alle tre veiene
// den kan komme inn: det brukeren limer inn, det vi sender, og det Google
// setter i svaret.

const ISSUE_TOKEN = 'https://accounts.google.com/o/oauth2/iframerpc'
  + '?action=issueToken&login_hint=x&client_id=y';

const FULL_JAR = '__Secure-3PSID=a; __Secure-3PAPISID=b; NID=c; '
  + '__Host-3PLSID=d; __Secure-3PSIDCC=e; __Secure-3PSIDTS=f';

// Fanger cookien vi faktisk sendte, og lar svaret settes per test.
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

test('stripRotatingCookie fjerner bare __Secure-3PSIDTS', () => {
  assert.strictEqual(
    stripRotatingCookie(FULL_JAR),
    '__Secure-3PSID=a; __Secure-3PAPISID=b; NID=c; __Host-3PLSID=d; __Secure-3PSIDCC=e',
  );
});

test('en krukke uten cookien står urørt', () => {
  const jar = '__Secure-3PSID=a; NID=c';
  assert.strictEqual(stripRotatingCookie(jar), jar);
});

test('tom og ugyldig inndata gir tom streng, ikke krasj', () => {
  for (const value of ['', null, undefined]) {
    assert.strictEqual(stripRotatingCookie(value), '');
  }
});

test('cookien sendes aldri til Google', async () => {
  const { seen, restore } = stubFetch();
  try {
    await fetchAccessToken(ISSUE_TOKEN, FULL_JAR);
    assert.ok(!seen.cookie.includes('__Secure-3PSIDTS'), seen.cookie);
    assert.ok(seen.cookie.includes('__Secure-3PSID='));
  } finally { restore(); }
});

test('den lagrede krukka blir renset ved første fornyelse', async () => {
  const { restore } = stubFetch();
  try {
    const { cookie, rotated } = await fetchAccessToken(ISSUE_TOKEN, FULL_JAR);
    assert.ok(!cookie.includes('__Secure-3PSIDTS'), cookie);
    // Fjerningen skal være synlig i loggen, ellers er en stille endring av
    // brukerens eneste kopi umulig å spore i en diagnoserapport.
    assert.deepStrictEqual(rotated, ['__Secure-3PSIDTS']);
  } finally { restore(); }
});

test('Google får ikke satt cookien tilbake i svaret', async () => {
  const { restore } = stubFetch({
    setCookie: [
      '__Secure-3PSIDTS=ny; Path=/; Secure; HttpOnly',
      '__Secure-3PSIDCC=rotert; Path=/; Secure',
    ],
  });
  try {
    const { cookie } = await fetchAccessToken(ISSUE_TOKEN, FULL_JAR);
    assert.ok(!cookie.includes('__Secure-3PSIDTS'), cookie);
    // Resten av rotasjonen skal fortsatt virke.
    assert.ok(cookie.includes('__Secure-3PSIDCC=rotert'), cookie);
  } finally { restore(); }
});

test('øktnøkkelen overlever, ellers ville krukka vært ubrukelig', async () => {
  const { restore } = stubFetch({ setCookie: ['__Secure-3PSIDTS=ny; Path=/'] });
  try {
    const { cookie } = await fetchAccessToken(ISSUE_TOKEN, FULL_JAR);
    assert.ok(cookie.includes('__Secure-3PSID=a'), cookie);
  } finally { restore(); }
});
