'use strict';

(() => {
  const { hasSessionCookie, cookieNames } = self.NestSetup;
  const $ = (id) => document.getElementById(id);
  const api = globalThis.browser || globalThis.chrome;
  const isFirefox = navigator.userAgent.includes('Firefox/');
  const HOSTS = { origins: ['https://accounts.google.com/*', 'https://home.nest.com/*'] };

  // Firefox lar brukeren trekke tilbake nettstedstilgang etter installasjon.
  // Uten den ser utvidelsen aldri forespørselen, og popupen ville stått og
  // ventet for alltid uten å si hvorfor.
  async function hasHostAccess() {
    try {
      return await api.permissions.contains(HOSTS);
    } catch (error) {
      return true;
    }
  }

  // Firefox skiller cookies per nettsted. Er sporingsbeskyttelsen på for
  // home.nest.com, får Google-rammen der ingen innlogging, og forespørselen
  // går uten økt-cookie. Det var nøyaktig det som stoppet første test.
  const FIREFOX_ETP_HINT = ' In Firefox, click the shield in the address bar on home.nest.com, '
    + 'turn Enhanced Tracking Protection off for that site, and reload.';

  // Google roterer delene av cookien i løpet av minutter. En fangst som har
  // ligget en stund kan allerede være foreldet, så alderen vises og brukeren
  // bes laste siden på nytt når den blir gammel.
  const STALE_MS = 5 * 60 * 1000;

  function problem(text) {
    $('problem').textContent = text;
    $('problem').hidden = !text;
  }

  function show(ready) {
    $('waiting').hidden = ready;
    $('ready').hidden = !ready;
  }

  async function captured() {
    return api.storage.session.get(['issueToken', 'cookie', 'capturedAt']);
  }

  async function copy(text, what) {
    await navigator.clipboard.writeText(text);
    $('status').textContent = `${what} copied.`;
  }

  async function render() {
    const { issueToken, cookie, capturedAt } = await captured();
    problem('');

    const access = await hasHostAccess();
    $('grant').hidden = access;
    if (!access) {
      show(false);
      problem('The extension is not allowed to see google.com and home.nest.com yet.');
      return;
    }

    if (!issueToken) {
      show(false);
      return;
    }

    // Tokenet ble fanget, så siden har lastet. Mangler økt-cookien likevel, er
    // det ikke utlogging utvidelsen kan se — derfor listes navnene, aldri
    // verdiene, så feilen forklarer seg selv.
    if (!hasSessionCookie(cookie)) {
      show(false);
      const names = cookieNames(cookie);
      const hint = isFirefox ? FIREFOX_ETP_HINT : '';
      problem(names.length
        ? `The request had no Google session cookie. Cookies sent: ${names.join(', ')}.${hint}`
        : `The request carried no cookies at all. Sign in to Google on home.nest.com and reload the page.${hint}`);
      return;
    }

    show(true);
    const minutes = Math.round((Date.now() - (capturedAt || 0)) / 60000);
    $('age').textContent = Date.now() - capturedAt > STALE_MS
      ? `Captured ${minutes} min ago. Reload the Nest page for fresh values.`
      : `Captured ${minutes < 1 ? 'just now' : `${minutes} min ago`}.`;
  }

  $('open').addEventListener('click', () => api.tabs.create({ url: 'https://home.nest.com/' }));

  // Må kalles direkte fra klikket; Firefox godtar bare tillatelsesforespørsler
  // som følger av en brukerhandling.
  $('grant').addEventListener('click', async () => {
    await api.permissions.request(HOSTS);
    render();
  });

  $('copyToken').addEventListener('click', async () => {
    const { issueToken } = await captured();
    if (issueToken) await copy(issueToken, 'Issue token');
  });

  $('copyCookie').addEventListener('click', async () => {
    const { cookie } = await captured();
    if (hasSessionCookie(cookie)) await copy(cookie, 'Cookie');
  });

  $('clear').addEventListener('click', async () => {
    await api.storage.session.remove(['issueToken', 'cookie', 'capturedAt']);
    await navigator.clipboard.writeText('');
    $('status').textContent = '';
    render();
  });

  // Oppdager en ny fangst når Nest-siden lastes på nytt mens vinduet står åpent.
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && (changes.issueToken || changes.cookie)) render();
  });

  render().catch((error) => problem(`Something went wrong: ${error.message}`));
})();
