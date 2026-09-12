'use strict';

// Trekker issue token og cookie ut av en «Copy as cURL» fra Chrome, slik at
// brukeren kan lime inn én ting i stedet for å plukke to verdier ut av
// DevTools for hånd. Ren tekstbehandling: ingen nettverk, ingen Chrome-API,
// så hele tolkningen kan testes mot ekte innliminger.
//
// Chrome tilbyr to varianter. bash bruker enkle anførselstegn og `\` for
// linjeskift; cmd (Windows) bruker doble anførselstegn og `^` både for
// linjeskift og som escape foran spesialtegn. Begge må forstås.

// Kontrolltegn sjekkes tegn for tegn, ikke med en regex bygget av \u-koder.
// Skrevet som literal ville koden lett fått et ekte kontrolltegn i seg ved en
// uheldig innliming, og da slutter hele filen å laste.
function hasControlChars(value) {
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

// Fjerner det som skiller de to cURL-variantene fra hverandre, så resten av
// tolkningen kan behandle dem likt: linjeskift-fortsettelser (`\` i bash, `^`
// i cmd) blir mellomrom, og en `^` foran et tegn i cmd-varianten faller bort.
function normalise(input) {
  let text = String(input || '');
  text = text.split('^\r\n').join(' ').split('^\n').join(' ');
  text = text.split('\\r\n').join(' ').split('\\n').join(' ');

  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '^' && i + 1 < text.length) {
      out += text[i + 1];
      i += 1;
    } else {
      out += text[i];
    }
  }
  return out;
}

// Adressen tas hvor som helst i teksten, ikke ut fra en fast plass etter
// `curl`. Chrome 152 skriver `curl --url '…'`, eldre utgaver `curl '…'`, og en
// framtidig utgave kan finne på noe tredje. Alle har selve iframerpc-URL-en et
// sted, og det er den vi vil ha.
const ISSUE_TOKEN_MARK = 'https://accounts.google.com/o/oauth2/iframerpc?';

function findIssueToken(text) {
  const start = text.indexOf(ISSUE_TOKEN_MARK);
  if (start < 0) return '';
  let end = start;
  while (end < text.length) {
    const ch = text[end];
    if (ch === "'" || ch === '"' || ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') break;
    end += 1;
  }
  return text.slice(start, end);
}

function quotedAfter(text, from) {
  let i = from;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i += 1;
  const quote = text[i];
  if (quote !== "'" && quote !== '"') return '';
  const close = text.indexOf(quote, i + 1);
  return close < 0 ? '' : text.slice(i + 1, close);
}

// Cookien ligger enten i et `-b`/`--cookie`-argument eller i en
// `-H 'cookie: …'`-header. Chrome bruker det første, men begge sees i praksis,
// så vi tar det vi finner først.
function findCookie(text) {
  const marks = [' -b ', ' --cookie ', '\n-b ', '\n--cookie '];
  for (const mark of marks) {
    const at = text.indexOf(mark);
    if (at >= 0) {
      const value = quotedAfter(text, at + mark.length);
      if (value) return value.trim();
    }
  }

  const lower = text.toLowerCase();
  let at = lower.indexOf('cookie:');
  while (at >= 0) {
    const quote = text[at - 1];
    if (quote === "'" || quote === '"') {
      const close = text.indexOf(quote, at);
      if (close > at) return text.slice(at + 'cookie:'.length, close).trim();
    }
    at = lower.indexOf('cookie:', at + 7);
  }
  return '';
}

// Ett kall for innstillingssiden og reparasjonsvisningen. Et ledende mellomrom
// gjør at ` -b `-mønsteret treffer også når cURL-en starter med argumentet.
function parseCurl(input) {
  const text = ` ${normalise(input)}`;
  return {
    issueToken: findIssueToken(text),
    cookie: findCookie(text),
  };
}

module.exports = { parseCurl, normalise, hasControlChars };
