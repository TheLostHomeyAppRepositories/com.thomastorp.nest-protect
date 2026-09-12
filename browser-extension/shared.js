'use strict';

// Felles for bakgrunnsskriptet, popup-vinduet og testene. Ingen Chrome-API-er
// her, bare tolking, slik at det som avgjør om verdiene er riktige kan testes
// uten en nettleser.

// Samme krav som appen selv stiller i lib/protect-config.js. Utvidelsen skal
// aldri gi brukeren noe appen kommer til å avvise.
const ISSUE_TOKEN_PREFIX = 'https://accounts.google.com/o/oauth2/iframerpc';
const REQUIRED_COOKIE = '__Secure-3PSID';

function isIssueTokenUrl(url) {
  const text = String(url || '');
  if (!text.startsWith(ISSUE_TOKEN_PREFIX)) return false;
  // Siden gjør flere iframerpc-kall. Bare issueToken er det appen kan bruke,
  // og uten login_hint vet Google ikke hvilken konto det gjelder.
  return text.includes('action=issueToken')
    && text.includes('login_hint=')
    && text.includes('client_id=');
}

// Cookie-headeren slik Chrome faktisk sendte den på issueToken-forespørselen.
//
// Første utgave satte den sammen selv med chrome.cookies, av alle cookiene som
// gjaldt for adressen. Google svarte USER_LOGGED_OUT. Google-siden ligger
// innebygd i home.nest.com, og da sender Chrome bare et utvalg av cookiene —
// det er det utvalget appen etterligner, og det er det den manuelle metoden
// kopierer. Å lese headeren i stedet for å gjette på den gir nøyaktig samme
// verdi som DevTools.
function cookieFromHeaders(requestHeaders) {
  const header = (requestHeaders || [])
    .find((h) => h && String(h.name).toLowerCase() === 'cookie');
  return header && typeof header.value === 'string' ? header.value : '';
}

function hasSessionCookie(header) {
  return String(header || '').includes(`${REQUIRED_COOKIE}=`);
}

// Bare navnene, til feilmeldinger. Verdiene skal aldri vises.
function cookieNames(header) {
  return String(header || '')
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean);
}

const shared = {
  ISSUE_TOKEN_PREFIX, REQUIRED_COOKIE, isIssueTokenUrl, cookieFromHeaders, hasSessionCookie, cookieNames,
};

if (typeof module !== 'undefined' && module.exports) module.exports = shared;
else self.NestSetup = shared;
