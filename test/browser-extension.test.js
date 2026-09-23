'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  isIssueTokenUrl, cookieFromHeaders, hasSessionCookie, cookieNames,
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

// Headeren tas uendret. Å bygge den på nytt av chrome.cookies ga
// USER_LOGGED_OUT, fordi nettleseren bare sender et utvalg i en innebygd side.
test('cookien tas nøyaktig slik den ble sendt', () => {
  const sent = 'SSID=a; __Secure-3PSID=b.c=; __Secure-3PSIDTS=sidts-x';
  const headers = [
    { name: 'User-Agent', value: 'Chrome' },
    { name: 'Cookie', value: sent },
  ];
  assert.equal(cookieFromHeaders(headers), sent);
  assert.equal(cookieFromHeaders([{ name: 'cookie', value: sent }]), sent);
});

test('ingen cookie-header gir tom verdi, ikke en feil', () => {
  assert.equal(cookieFromHeaders([{ name: 'Accept', value: '*/*' }]), '');
  assert.equal(cookieFromHeaders(undefined), '');
});

test('økt-cookien oppdages, og bare navn listes', () => {
  assert.equal(hasSessionCookie('SSID=a; __Secure-3PSID=b'), true);
  assert.equal(hasSessionCookie('SSID=a'), false);
  assert.deepEqual(cookieNames('SSID=a; __Secure-3PSID=b=c; NID='), ['SSID', '__Secure-3PSID', 'NID']);
  assert.deepEqual(cookieNames(''), []);
});

// Det viktigste: det utvidelsen kopierer skal gå rett gjennom appens egen
// validering. Hvis de to noen gang glir fra hverandre, feiler denne.
test('verdiene består appens egen validering', () => {
  const cookie = cookieFromHeaders([{ name: 'Cookie', value: 'SSID=a; __Secure-3PSID=b' }]);
  assert.deepEqual(config.validate({ issueToken: TOKEN, cookie }), []);
});

// Firefox og Chrome deler all kode; bare manifestet skiller seg. Glipper de
// fra hverandre, virker utvidelsen i den ene nettleseren og ikke den andre,
// uten at noe feiler før en bruker prøver.
const chromeManifest = require('../browser-extension/manifest.json');
const firefoxManifest = require('../browser-extension/manifest.firefox.json');

test('Firefox-manifestet har samme tillatelser som Chrome', () => {
  assert.deepEqual(firefoxManifest.permissions, chromeManifest.permissions);
  assert.deepEqual(firefoxManifest.host_permissions, chromeManifest.host_permissions);
  assert.deepEqual(firefoxManifest.action, chromeManifest.action);
});

// Firefox har ingen service worker for utvidelser, og der finnes ikke
// importScripts. shared.js må derfor lastes før bakgrunnsskriptet.
test('Firefox laster shared.js før bakgrunnsskriptet', () => {
  assert.deepEqual(firefoxManifest.background, { scripts: ['shared.js', 'background.js'] });
});

// Uten id og erklæring om datainnsamling signerer ikke addons.mozilla.org.
test('Firefox-manifestet kan signeres av addons.mozilla.org', () => {
  const gecko = firefoxManifest.browser_specific_settings.gecko;
  assert.match(gecko.id, /^[^@\s]+@[^@\s]+$/);
  assert.deepEqual(gecko.data_collection_permissions, { required: ['none'] });
});
