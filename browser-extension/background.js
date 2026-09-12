'use strict';

importScripts('shared.js');

// Både adressen og cookien hentes fra én og samme forespørsel: den
// home.nest.com selv gjør for å be Google om et token. Det er den appen
// etterligner, så det er dens verdier som skal med.
//
// onSendHeaders, ikke onBeforeSendHeaders: Chrome legger på Cookie-headeren
// sent, og først her er headerne endelige. extraHeaders må til for at Cookie
// i det hele tatt tas med. Bare lytting — forespørselen endres aldri.
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!self.NestSetup.isIssueTokenUrl(details.url)) return;
    // Sesjonslager: verdiene forsvinner når nettleseren lukkes og skrives
    // aldri til disk.
    chrome.storage.session.set({
      issueToken: details.url,
      cookie: self.NestSetup.cookieFromHeaders(details.requestHeaders),
      capturedAt: Date.now(),
    });
  },
  { urls: ['https://accounts.google.com/o/oauth2/iframerpc*'] },
  ['requestHeaders', 'extraHeaders'],
);
