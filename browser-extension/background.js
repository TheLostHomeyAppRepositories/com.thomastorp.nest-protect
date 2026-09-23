'use strict';

// Chrome kjører dette som en service worker og må hente shared.js selv.
// Firefox har ingen service worker for utvidelser; der står shared.js først i
// manifestets scripts-liste, og importScripts finnes ikke.
if (typeof importScripts === 'function') importScripts('shared.js');

// Firefox har promise-baserte API-er under browser, Chrome under chrome.
const api = globalThis.browser || globalThis.chrome;

// Både adressen og cookien hentes fra én og samme forespørsel: den
// home.nest.com selv gjør for å be Google om et token. Det er den appen
// etterligner, så det er dens verdier som skal med.
//
// onSendHeaders, ikke onBeforeSendHeaders: Chrome legger på Cookie-headeren
// sent, og først her er headerne endelige. Bare lytting — forespørselen
// endres aldri.
function capture(details) {
  if (!self.NestSetup.isIssueTokenUrl(details.url)) return;
  // Sesjonslager: verdiene forsvinner når nettleseren lukkes og skrives
  // aldri til disk.
  api.storage.session.set({
    issueToken: details.url,
    cookie: self.NestSetup.cookieFromHeaders(details.requestHeaders),
    capturedAt: Date.now(),
  });
}

const filter = { urls: ['https://accounts.google.com/o/oauth2/iframerpc*'] };

// Chrome tar bare med Cookie når extraHeaders er oppgitt. Firefox kjenner ikke
// verdien og kaster, men sender Cookie uansett, så der registreres lytteren
// uten den.
try {
  api.webRequest.onSendHeaders.addListener(capture, filter, ['requestHeaders', 'extraHeaders']);
} catch (error) {
  api.webRequest.onSendHeaders.addListener(capture, filter, ['requestHeaders']);
}
