'use strict';

importScripts('shared.js');

// issueToken-adressen kan ikke settes sammen av utvidelsen selv: login_hint er
// en ugjennomsiktig verdi Google gir den innloggede kontoen. Den fanges derfor
// opp når home.nest.com selv ber om den.
//
// Bare lytting, aldri blokkering eller endring av forespørselen.
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!self.NestSetup.isIssueTokenUrl(details.url)) return;
    // Sesjonslager, ikke lokalt lager: verdien forsvinner når nettleseren
    // lukkes og skrives aldri til disk.
    chrome.storage.session.set({ issueToken: details.url, capturedAt: Date.now() });
  },
  { urls: ['https://accounts.google.com/o/oauth2/iframerpc*'] },
);
