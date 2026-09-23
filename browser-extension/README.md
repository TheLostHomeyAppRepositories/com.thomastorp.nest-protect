# Nest Protect for Homey — setup helper

A small Firefox add-on that copies the two values the Nest Protect Homey app
needs — the issue token and the cookie — from your signed-in browser, so you
don't have to dig through the developer tools.

## Install

**From Firefox Add-ons:**
https://addons.mozilla.org/firefox/addon/nest-protect-for-homey/

The listing is in review at Mozilla. Until it is live, see
[Install for testing](#install-for-testing) below.

Then open home.nest.com in Firefox, sign in with Google, wait for your home to
load, and click the add-on's icon. Copy each value into the Nest Protect app
settings in Homey and test the connection. Close the window afterwards, but
don't sign out of Google; signing out ends the session.

## Why Firefox and not Chrome

Chrome and Edge on Windows bind your Google sign-in to the computer's security
chip (Device Bound Session Credentials, on by default since 2026). One of the
cookies, `__Secure-3PSIDTS`, is short-lived and can only be renewed by that
browser, so values copied from Chrome stop working after about two and a half
hours, on the app's third hourly renewal. No app can renew it, and removing the
cookie makes Google reject the session at once. Firefox does not implement
DBSC, so values copied from it keep working.

The same code still builds for Chrome (`manifest.json`), but Chrome is no
longer supported for setup, and the Homey app warns when it is given values
from Chrome or Edge.

## Troubleshooting

- **No values show up:** the page is reusing its own session and never asks
  Google for a token. Click the shield icon at the far left of the address bar,
  choose Clear cookies and site data (this only affects home.nest.com; your
  Google sign-in stays), reload and sign in if asked.
- **The add-on says the cookie is missing:** switch off Enhanced Tracking
  Protection in the same shield panel and reload. It can usually stay on:
  Firefox grants the Google frame access when you click Sign in with Google.

## How it works

When home.nest.com asks Google for a token, the add-on notices that request
and keeps two things from it in session storage: its address (the issue token)
and the Cookie header the browser sent with it. Those are exactly the values
you would otherwise copy out of the developer tools, and exactly the request
the app imitates. The add-on only watches; it never blocks or changes anything.

It deliberately reads the Cookie header rather than building the cookie from
the browser's cookie store. An earlier version did the latter, and Google
answered `USER_LOGGED_OUT`: the Google frame sits inside home.nest.com, so the
browser sends a particular selection of cookies, and the app needs that same
selection.

Nothing is sent anywhere. The add-on makes no network requests of its own, and
the values are kept in memory only and forgotten when the browser closes.

## Building

`node build.js` writes `dist/firefox/` and `dist/chrome/`, each with a zip for
its store. All code is shared; only the manifest differs
(`manifest.firefox.json` and `manifest.json`). Store texts are in `STORE.md`.

## Install for testing

1. Run `node build.js`.
2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and pick `dist/firefox/manifest.json`.
   Temporary add-ons are removed when Firefox closes.

## Security

The cookie is a full Google account session credential. Anyone holding it holds
the account. Only paste it into Homey, keep it out of screenshots and bug
reports, and remove the add-on when you no longer need it.
