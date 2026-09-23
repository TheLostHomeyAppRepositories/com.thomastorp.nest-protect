'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { parseCurl, hasControlChars } = require('../lib/curl-paste');
const config = require('../lib/protect-config');

// Formen Chrome 152 faktisk gir: `curl --url '…'`, cookien i -b. Verdiene er
// oppdiktede, men strukturen er nøyaktig den brukeren limte inn.
const BASH = "curl --url 'https://accounts.google.com/o/oauth2/iframerpc?action=issueToken"
  + "&response_type=token%20id_token&login_hint=AJDLj6example&client_id=733249279899-x.apps.googleusercontent.com"
  + "&origin=https%3A%2F%2Fhome.nest.com&scope=openid&auto=1&fedcm_enabled=true' \\n"
  + "  -H 'accept: */*' \\n"
  + "  -b 'LSOLH=abc; __Secure-3PSID=g.a000example; __Secure-3PAPISID=xy/z; NID=534=abc; __Secure-3PSIDCC=AKEy' \\n"
  + "  -H 'referer: https://accounts.google.com/o/oauth2/iframe'";

// Eldre Chrome: `curl '…'`, adressen rett etter curl.
const BASH_OLD = "curl 'https://accounts.google.com/o/oauth2/iframerpc?action=issueToken&login_hint=x&client_id=y' "
  + "-H 'cookie: __Secure-3PSID=g.a000example; NID=1'";

// cmd-varianten: doble anførselstegn, ^ som linjeskift og escape.
const CMD = 'curl ^"https://accounts.google.com/o/oauth2/iframerpc?action=issueToken^&login_hint=x^&client_id=y^" ^\n'
  + '  -b ^"__Secure-3PSID=g.a000example; NID=1^"';

test('bash: trekker ut token og cookie', () => {
  const r = parseCurl(BASH);
  assert.ok(r.issueToken.startsWith('https://accounts.google.com/o/oauth2/iframerpc?action=issueToken'));
  assert.ok(r.issueToken.endsWith('fedcm_enabled=true'));
  assert.ok(r.cookie.includes('__Secure-3PSID=g.a000example'));
  // Ingen deler av cURL-en skal ha lekket inn i verdiene.
  assert.ok(!r.issueToken.includes("'"));
  assert.ok(!r.cookie.includes('-H'));
});

test('eldre bash uten --url, cookie i header', () => {
  const r = parseCurl(BASH_OLD);
  assert.equal(r.issueToken, 'https://accounts.google.com/o/oauth2/iframerpc?action=issueToken&login_hint=x&client_id=y');
  assert.ok(r.cookie.startsWith('__Secure-3PSID=g.a000example'));
});

test('cmd-varianten med ^-escape', () => {
  const r = parseCurl(CMD);
  assert.equal(r.issueToken, 'https://accounts.google.com/o/oauth2/iframerpc?action=issueToken&login_hint=x&client_id=y');
  assert.ok(r.cookie.includes('__Secure-3PSID=g.a000example'));
  assert.ok(!r.cookie.includes('^'));
});

test('vanlig tekst gir tomme verdier, ikke feil', () => {
  const r = parseCurl('bare noe rot uten en url');
  assert.equal(r.issueToken, '');
  assert.equal(r.cookie, '');
  assert.deepEqual(parseCurl(undefined), { issueToken: '', cookie: '' });
});

test('kontrolltegn oppdages tegn for tegn', () => {
  assert.equal(hasControlChars('a\nb'), true);
  assert.equal(hasControlChars('ren=verdi; annen=2'), false);
});

// Det avgjørende: det tolkeren gir ut skal appens egen validering godta.
test('resultatet består appens validering', () => {
  const r = parseCurl(BASH);
  assert.deepEqual(config.validate(r), []);
});

// Firefox legger cookien i en header og skriver cURL med ^-escaping i cmd.
// Innstillingssiden og reparasjonsvisningen har egne kopier av parseren; de
// ble tidligere bare testet mot Chromes -b-format og fant ingen cookie her.
test('Firefox «Kopier som cURL» for Windows gir begge verdiene', () => {
  const url = 'https://accounts.google.com/o/oauth2/iframerpc?action=issueToken&login_hint=AAA&client_id=BBB&auto=1';
  const cookie = 'NID=n1; __Secure-3PSID=g.a000y; LSID=s.NO|s.youtube:g.a000z';
  const esc = (s) => s.replace(/[%&|"]/g, (c) => `^${c}`);
  const text = `curl.exe ^"${esc(url)}^" ^\n  --compressed ^\n`
    + `  -H ^"User-Agent: Mozilla/5.0 Firefox/156.0^" ^\n  -H ^"Cookie: ${esc(cookie)}^" ^\n  -H ^"TE: trailers^"`;
  const parsed = parseCurl(text);
  assert.equal(parsed.issueToken, url);
  assert.equal(parsed.cookie, cookie);
});
