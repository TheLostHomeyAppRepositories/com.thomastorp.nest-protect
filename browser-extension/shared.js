'use strict';

// Felles for bakgrunnsskriptet, popup-vinduet og testene. Ingen Chrome-API-er
// her, bare tolking og formatering, slik at det som bestemmer om verdiene er
// riktige kan testes uten en nettleser.

// Samme krav som appen selv stiller i lib/protect-config.js. Utvidelsen skal
// aldri gi brukeren noe appen kommer til å avvise.
const ISSUE_TOKEN_PREFIX = 'https://accounts.google.com/o/oauth2/iframerpc';
const REQUIRED_COOKIE = '__Secure-3PSID';

// Adressen cookien må gjelde for. Det er denne forespørselen appen etterligner,
// så det er cookiene nettleseren ville sendt hit som skal med — verken flere
// eller færre.
const COOKIE_URL = 'https://accounts.google.com/o/oauth2/iframe';

function isIssueTokenUrl(url) {
  const text = String(url || '');
  if (!text.startsWith(ISSUE_TOKEN_PREFIX)) return false;
  // Siden gjør flere iframerpc-kall. Bare issueToken er det appen kan bruke,
  // og uten login_hint vet Google ikke hvilken konto det gjelder.
  return text.includes('action=issueToken')
    && text.includes('login_hint=')
    && text.includes('client_id=');
}

// Fra chrome.cookies-objekter til én Cookie-header, i samme form som
// nettleseren sender og som appen forventer å få limt inn.
function cookieHeader(cookies) {
  return (cookies || [])
    .filter((c) => c && c.name && typeof c.value === 'string')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

function hasSessionCookie(header) {
  return String(header || '').includes(`${REQUIRED_COOKIE}=`);
}

const shared = {
  ISSUE_TOKEN_PREFIX, REQUIRED_COOKIE, COOKIE_URL, isIssueTokenUrl, cookieHeader, hasSessionCookie,
};

if (typeof module !== 'undefined' && module.exports) module.exports = shared;
else self.NestSetup = shared;
