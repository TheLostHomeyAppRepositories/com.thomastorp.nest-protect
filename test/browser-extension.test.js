'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  isIssueTokenUrl, cookieHeader, hasSessionCookie,
} = require('../browser-extension/shared');
const config = require('../lib/protect-config');

const TOKEN = 'https://accounts.google.com/o/oauth2/iframerpc?action=issueToken'
  + '&response_type=token%20id_token&login_hint=AJDLj6example&client_id=733249279899-example.apps.googleusercontent.com'
  + '&origin=https%3A%2F%2Fhome.nest.com&scope=openid%20profile%20email';

test('fanger issueToken-kallet', () => {
  assert.equal(isIssueTokenUrl(TOKEN), true);
});

// Siden gjør flere iframerpc-kall. Et av de andre fanget opp ville gitt brukeren
// en verdi appen avviser — eller verre, en som ser riktig ut og feiler senere.
test('ignorerer andre iframerpc-kall', () => {
  assert.equal(isIssueTokenUrl(TOKEN.replace('action=issueToken', 'action=checkOrigin')), false);
  assert.equal(isIssueTokenUrl(TOKEN.replace(/login_hint=[^&]+&/, '')), false);
  assert.equal(isIssueTokenUrl('https://example.com/o/oauth2/iframerpc?action=issueToken&login_hint=x&client_id=y'), false);
  assert.equal(isIssueTokenUrl(undefined), false);
});

test('cookie-headeren får samme form som nettleseren sender', () => {
  const header = cookieHeader([
    { name: 'SID', value: 'a' },
    { name: '__Secure-3PSID', value: 'b.c=' },
    { name: 'NID', value: '' },
  ]);
  assert.equal(header, 'SID=a; __Secure-3PSID=b.c=; NID=');
  assert.equal(hasSessionCookie(header), true);
});

test('uten økt-cookien sies det fra', () => {
  assert.equal(hasSessionCookie(cookieHeader([{ name: 'SID', value: 'a' }])), false);
  assert.equal(cookieHeader(undefined), '');
});

// Det viktigste: det utvidelsen kopierer skal gå rett gjennom appens egen
// validering. Hvis de to noen gang glir fra hverandre, feiler denne.
test('verdiene består appens egen validering', () => {
  const cookie = cookieHeader([{ name: 'SID', value: 'a' }, { name: '__Secure-3PSID', value: 'b' }]);
  assert.deepEqual(config.validate({ issueToken: TOKEN, cookie }), []);
});
