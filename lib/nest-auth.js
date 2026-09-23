'use strict';

// Innlogging mot det gamle Nest-API-et. Google fjernet API-nøkler, så eneste
// vei inn er en øktcookie fra en innlogget nettleser pluss den issueToken-URL-en
// home.nest.com selv kaller. Begge må brukeren hente ut manuelt fra DevTools.
//
// Kjeden er tre steg, og hvert av dem kan feile på sin egen måte:
//   1. issueToken + cookie  ->  Google access token   (60 min)
//   2. access token         ->  Nest JWT              (60 min)
//   3. JWT                  ->  økt mot home.nest.com
//
// Bygget etter iMicknl/ha-nest-protect (MIT), som igjen bygger på
// chrisjshull/homebridge-nest. Endepunktene er udokumenterte og kan forsvinne
// uten varsel.

const NEST_AUTH_URL_JWT = 'https://nestauthproxyservice-pa.googleapis.com/v1/issue_jwt';
const NEST_HOST = 'https://home.nest.com';

// Øktnøkkelen hele innloggingen hviler på. Overlever ikke den en sammenslåing,
// er den nye krukka ubrukelig.
const REQUIRED_COOKIE = '__Secure-3PSID';

// Cookien som dreper økten hvis vi tar den med. En nettleser fornyer
// __Secure-3PSIDTS mot accounts.google.com/RotateCookies omtrent hvert
// kvarter. Vi kaller aldri det endepunktet, så vår kopi blir foreldet, og
// Google svarer USER_LOGGED_OUT — målt til tredje fornyelse, rundt to og en
// halv time, hos to uavhengige brukere. En krukke uten den blir ikke utsatt
// for den kontrollen og lever videre; det er derfor økter som aldri fikk
// cookien har stått i dagevis. Så den fjernes både fra det brukeren limer
// inn og fra det Google prøver å sette.
const ROTATING_COOKIE = '__Secure-3PSIDTS';

// Google avviser forespørsler uten en nettleseraktig User-Agent på issueToken.
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Tokenet varer en time. Vi fornyer med god margin, ikke fordi det haster, men
// fordi en subscribe-forbindelse kan stå åpen i ti minutter og ikke bør ryke
// midt i en alarm.
const TOKEN_LIFETIME_MS = 3600 * 1000;
const RENEW_MARGIN_MS = 10 * 60 * 1000;

class NestAuthError extends Error {
  constructor(message, {
    status = null, step = null, retryable = true, code = null,
  } = {}) {
    super(message);
    this.name = 'NestAuthError';
    this.status = status;
    this.step = step;
    // Googles egen feilkode (f.eks. USER_LOGGED_OUT), for den som vil skille
    // «økten er over» fra alt annet uten å tolke fritekst.
    this.code = code;
    // Et utløpt eller trukket samtykke løser seg ikke ved å prøve igjen. Da
    // skal appen si fra til brukeren i stedet for å hamre på Google, slik den
    // gamle appen gjorde i mars: 20 sekunders retry i timevis.
    this.retryable = retryable;
  }
}

// 401 og 403 betyr at cookien ikke lenger gjelder. Alt annet kan være
// forbigående: nettverk, rate limiting, en dårlig dag hos Google.
function classify(status) {
  return status !== 401 && status !== 403;
}

// Hvorfor et kall feilet, uten å ta med feilteksten. Alle tre stegene under
// sender legitimasjon i headere, og undici siterer headerverdien ordrett i
// meldingen sin ved ugyldig verdi — «Headers.append: "<hele cookien>" is an
// invalid header value». Den teksten havner i apploggen, i status().lastError
// og dermed i innstillingssiden. Koden og navnet er nok til å feilsøke
// ENOTFOUND, ECONNRESET, TimeoutError og AbortError, og bærer aldri en verdi.
function networkReason(error) {
  if (!error) return 'unknown';
  const cause = error.cause && (error.cause.code || error.cause.name);
  return String(error.code || cause || error.name || 'network error');
}

async function postForm(url, form, headers, timeoutMs) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// Steg 1. Cookien byttes mot et Google access token. Svaret setter også nye
// cookieverdier, og de må tas vare på: Google roterer __Secure-3PSIDCC ved hver
// henting, og en klient som fortsetter med den gamle blir logget ut etter noen
// runder.
// Levetiden Google oppgir, klemt fast til noe fornuftig. En manglende, negativ
// eller absurd verdi ville ellers gjort tokenet "utløpt" med en gang, og appen
// ville autentisert på nytt ved hvert eneste kall.
function tokenLifetimeMs(expiresIn) {
  const seconds = Number(expiresIn);
  if (!Number.isFinite(seconds) || seconds <= 0) return TOKEN_LIFETIME_MS;
  return Math.min(seconds, 24 * 3600) * 1000;
}

async function fetchAccessToken(issueToken, cookie, { timeoutMs = 15000 } = {}) {
  // Krukka vi faktisk sender. Alt under regnes mot denne, slik at en lagret
  // cookie med __Secure-3PSIDTS blir renset ved første fornyelse i stedet for
  // å ligge igjen til neste utlogging.
  const sentCookie = stripRotatingCookie(cookie);

  let response;
  try {
    response = await fetch(issueToken, {
      headers: {
        'User-Agent': USER_AGENT,
        'Sec-Fetch-Mode': 'cors',
        'X-Requested-With': 'XmlHttpRequest',
        Referer: 'https://accounts.google.com/o/oauth2/iframe',
        cookie: sentCookie,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new NestAuthError(`Could not reach Google (${networkReason(error)})`, { step: 'token' });
  }

  if (!response.ok) {
    throw new NestAuthError(
      `Google rejected the issue token (HTTP ${response.status})`,
      { status: response.status, step: 'token', retryable: classify(response.status) },
    );
  }

  const body = await response.json().catch(() => ({}));

  // Google svarer 200 med en feilkropp når samtykket er trukket. Å stole på
  // statuskoden alene ville gitt en tom økt som ser vellykket ut.
  if (!body.access_token) {
    const code = body.error ? String(body.error) : null;
    // USER_LOGGED_OUT betyr at Google har avsluttet selve økten — passordbytte,
    // utlogging et annet sted, eller Googles egen grense. Ingen fornyelse
    // hjelper; bare ferske verdier gjør det. Så meldingen sier det rett ut, i
    // stedet for å la brukeren stirre på en kode.
    const message = code === 'USER_LOGGED_OUT'
      ? 'Google says this session is signed out (USER_LOGGED_OUT). Open Repair on one of '
        + 'the devices and paste a fresh issue token and cookie.'
      : `Google returned no access token${code ? `: ${code}` : ''}`;
    throw new NestAuthError(message, { step: 'token', retryable: false, code });
  }

  // getSetCookie finnes fra Node 19.7. Guarden er ikke for dagens Homey, men
  // for at et bytte av kjøretid skal gi en app uten cookie-rotasjon i stedet
  // for en app som kaster på hver eneste innlogging og aldri kommer opp.
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  // Google setter gjerne __Secure-3PSIDTS på nytt i svaret. Den skal ikke
  // inn igjen, ellers ville krukka vært foreldet på nytt om en time.
  const merged = stripRotatingCookie(mergeCookies(sentCookie, setCookies));
  // Den sammenslåtte krukka skrives over brukerens eneste kopi. Mistet den
  // øktnøkkelen underveis, er den gamle verdien bedre enn den nye — ellers
  // ville én rar respons fra Google gjort at brukeren måtte hente alt på
  // nytt fra DevTools.
  const finalCookie = merged.includes(`${REQUIRED_COOKIE}=`) ? merged : sentCookie;

  return {
    accessToken: body.access_token,
    cookie: finalCookie,
    // Hvilke cookies Google faktisk byttet ut, kun navn. Det er dette som lar
    // en diagnoserapport vise om rotasjonen skjedde fram til en utlogging —
    // uten det er hver USER_LOGGED_OUT en gjetning.
    rotated: changedCookieNames(cookie, finalCookie),
    setCookieCount: setCookies.length,
    expiresAt: Date.now() + tokenLifetimeMs(body.expires_in),
  };
}

// Cookie-streng til navn→verdi. Delt av sammenslåingen og av diffen under.
function cookieJar(cookie) {
  const jar = new Map();
  for (const part of String(cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    jar.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  return jar;
}

// Krukka uten cookien Google måler ferskheten på. Se ROTATING_COOKIE.
function stripRotatingCookie(cookie) {
  const jar = cookieJar(cookie);
  if (!jar.delete(ROTATING_COOKIE)) return String(cookie || '');
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

// Navnene som ble lagt til, endret eller fjernet mellom to krukker. Aldri
// verdier: dette havner i logger og feilrapporter.
function changedCookieNames(before, after) {
  const a = cookieJar(before);
  const b = cookieJar(after);
  const names = new Set([...a.keys(), ...b.keys()]);
  return [...names].filter((name) => a.get(name) !== b.get(name)).sort();
}

// Set-Cookie fra Google inneholder bare de verdiene som er endret. Resten av
// den opprinnelige strengen må bli stående, ellers mister vi __Secure-3PSID.
function mergeCookies(cookie, setCookieHeaders = []) {
  const jar = cookieJar(cookie);

  for (const header of setCookieHeaders) {
    // Første segment er selve verdien; resten er Path, Domain, Expires og
    // andre attributter vi ikke sender tilbake.
    const [pair] = String(header).split(';');
    const index = pair.indexOf('=');
    if (index === -1) continue;

    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    // Google sletter en cookie ved å sette den tom. Da skal den ut av krukka,
    // ikke stå igjen som «navn=».
    if (value === '' || value === '""') jar.delete(name);
    else jar.set(name, value);
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

// Steg 2. Access tokenet byttes mot et Nest-JWT. Det er dette som brukes som
// Basic-auth mot selve API-et.
async function fetchJwt(accessToken, { timeoutMs = 15000 } = {}) {
  let response;
  try {
    response = await postForm(NEST_AUTH_URL_JWT, {
      embed_google_oauth_access_token: true,
      expire_after: '3600s',
      google_oauth_access_token: accessToken,
      policy_id: 'authproxy-oauth-policy',
    }, {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': USER_AGENT,
      Referer: NEST_HOST,
    }, timeoutMs);
  } catch (error) {
    throw new NestAuthError(`Could not reach the Nest authentication service (${networkReason(error)})`, { step: 'jwt' });
  }

  if (!response.ok) {
    throw new NestAuthError(
      `The Nest authentication service rejected the token (HTTP ${response.status})`,
      { status: response.status, step: 'jwt', retryable: classify(response.status) },
    );
  }

  const body = await response.json().catch(() => ({}));
  if (!body.jwt) throw new NestAuthError('The Nest authentication service returned no token', { step: 'jwt' });

  return { jwt: body.jwt, claims: body.claims || null };
}

// Steg 3. Økten forteller hvilken bruker JWT-et tilhører. Bruker-id-en trengs
// i alle senere kall, og den er ikke den samme som Google-kontoen din.
async function fetchSession(jwt, { timeoutMs = 15000 } = {}) {
  let response;
  try {
    response = await fetch(`${NEST_HOST}/session`, {
      headers: {
        Authorization: `Basic ${jwt}`,
        'User-Agent': USER_AGENT,
        cookie: `user_token=${jwt}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new NestAuthError(`Could not reach Nest (${networkReason(error)})`, { step: 'session' });
  }

  if (!response.ok) {
    throw new NestAuthError(
      `Nest rejected the session (HTTP ${response.status})`,
      { status: response.status, step: 'session', retryable: classify(response.status) },
    );
  }

  const body = await response.json().catch(() => ({}));
  if (!body.userid) throw new NestAuthError('The Nest session is missing a user id', { step: 'session' });

  return {
    userId: String(body.userid),
    // Nest oppgir sin egen utløpstid. Den er som regel en time, men vi stoler
    // på serveren framfor å regne selv.
    expiresAt: body.expires_in ? Date.parse(body.expires_in) : Date.now() + TOKEN_LIFETIME_MS,
    transportUrl: (body.urls && body.urls.transport_url) || null,
  };
}

// Hele kjeden. Returnerer alt et API-kall trenger, pluss den oppdaterte
// cookien som må lagres tilbake til innstillingene.
async function authenticate(issueToken, cookie, options = {}) {
  const token = await fetchAccessToken(issueToken, cookie, options);

  // Den roterte cookien lagres HER, i det øyeblikket Google ga den — ikke
  // etter at hele kjeden er ferdig. Google roterer __Secure-3PSIDCC ved hver
  // token-henting og ugyldiggjør til slutt den forrige. Kaster fetchJwt eller
  // fetchSession under, ville den som kaller ellers aldri sett den nye cookien,
  // og neste fornyelse ville brukt den gamle — som Google svarer USER_LOGGED_OUT
  // på etter en rotasjon eller to. Meldt av en bruker; samme rettelse som
  // ha-nest-protect #555/#568.
  const changed = token.cookie !== cookie;
  // Rapporteres hver gang, også når Google ikke roterte noe: en rekke runder
  // uten rotasjon rett før en utlogging er selve sporet vi leter etter.
  if (options.onExchange) {
    await options.onExchange({ changed, rotated: token.rotated, setCookieCount: token.setCookieCount });
  }
  if (options.onCookie && changed) {
    await options.onCookie(token.cookie, { rotated: token.rotated });
  }

  const { jwt } = await fetchJwt(token.accessToken, options);
  const session = await fetchSession(jwt, options);

  return {
    jwt,
    userId: session.userId,
    transportUrl: session.transportUrl,
    cookie: token.cookie,
    expiresAt: Math.min(token.expiresAt, session.expiresAt),
  };
}

// Når det er på tide å fornye. Egen funksjon fordi den testes uten nettverk.
function needsRenewal(expiresAt, now = Date.now(), marginMs = RENEW_MARGIN_MS) {
  if (!expiresAt) return true;
  return expiresAt - now <= marginMs;
}

module.exports = {
  NestAuthError,
  NEST_HOST,
  USER_AGENT,
  RENEW_MARGIN_MS,
  authenticate,
  fetchAccessToken,
  fetchJwt,
  fetchSession,
  mergeCookies,
  changedCookieNames,
  stripRotatingCookie,
  ROTATING_COOKIE,
  needsRenewal,
};
