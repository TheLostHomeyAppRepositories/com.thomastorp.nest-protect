'use strict';

(() => {
  const { COOKIE_URL, cookieHeader, hasSessionCookie } = self.NestSetup;
  const $ = (id) => document.getElementById(id);

  // Hentes på nytt ved hvert klikk, ikke når vinduet åpnes. Google roterer
  // cookien fortløpende, og en verdi som har ligget i et åpent vindu en stund
  // kan allerede være foreldet.
  async function currentCookie() {
    const cookies = await chrome.cookies.getAll({ url: COOKIE_URL });
    return cookieHeader(cookies);
  }

  function problem(text) {
    $('problem').textContent = text;
    $('problem').hidden = !text;
  }

  async function copy(text, what) {
    await navigator.clipboard.writeText(text);
    $('status').textContent = `${what} copied.`;
  }

  async function render() {
    const { issueToken } = await chrome.storage.session.get('issueToken');
    const cookie = await currentCookie();

    problem('');
    if (!issueToken) {
      $('waiting').hidden = false;
      $('ready').hidden = true;
      return;
    }

    // Tokenet uten cookie er ubrukelig, og da er det utlogging som er
    // problemet — ikke at siden ikke har lastet.
    if (!hasSessionCookie(cookie)) {
      $('waiting').hidden = false;
      $('ready').hidden = true;
      problem('You don\'t seem to be signed in to Google in this browser. Sign in on home.nest.com and try again.');
      return;
    }

    $('waiting').hidden = true;
    $('ready').hidden = false;
  }

  $('open').addEventListener('click', () => chrome.tabs.create({ url: 'https://home.nest.com/' }));

  $('copyToken').addEventListener('click', async () => {
    const { issueToken } = await chrome.storage.session.get('issueToken');
    if (issueToken) await copy(issueToken, 'Issue token');
  });

  $('copyCookie').addEventListener('click', async () => {
    const cookie = await currentCookie();
    if (!hasSessionCookie(cookie)) {
      problem('The Google session cookie is missing. Sign in on home.nest.com and try again.');
      return;
    }
    await copy(cookie, 'Cookie');
  });

  $('clear').addEventListener('click', async () => {
    await chrome.storage.session.remove(['issueToken', 'capturedAt']);
    await navigator.clipboard.writeText('');
    $('status').textContent = '';
    render();
  });

  // Oppdager det når Nest-siden laster ferdig mens vinduet står åpent.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.issueToken) render();
  });

  render().catch((error) => problem(`Something went wrong: ${error.message}`));
})();
