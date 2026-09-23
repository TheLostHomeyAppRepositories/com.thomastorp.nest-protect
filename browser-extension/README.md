# Nest Protect for Homey — setup helper

A small Chrome extension that copies the two values the Nest Protect Homey app
needs — the issue token and the cookie — from your signed-in browser, so you
don't have to dig through the developer tools.

## Install

**From the Chrome Web Store (one click):**
https://chromewebstore.google.com/detail/jbheemaebmbbjnaflanegabohniepcbp

A newly published listing can take a few days to show up in Web Store *search*,
so use the direct link above until then. To install manually instead, see
[Install for testing](#install-for-testing) below.

## Firefox

The same helper is built for Firefox from this folder. `node build.js` writes
`dist/firefox/` and a zip for addons.mozilla.org; only the manifest differs
(`manifest.firefox.json`). The listing is in review.

Enhanced Tracking Protection can usually stay on: Firefox grants the Google
frame access when you click Sign in with Google. If the request still carries no
session cookie, click the shield in the address bar and switch protection off
for home.nest.com. The popup says so when it happens.

To try it before it is listed: open `about:debugging#/runtime/this-firefox`,
choose **Load Temporary Add-on**, and pick `dist/firefox/manifest.json`.

## How it works

When home.nest.com asks Google for a token, the extension notices that request
and keeps two things from it in session storage: its address (the issue token)
and the Cookie header Chrome sent with it. Those are exactly the values you
would otherwise copy out of the developer tools, and exactly the request the
app imitates. The extension only watches; it never blocks or changes anything.

It deliberately does not build the cookie from Chrome's cookie store. An
earlier version did, and Google answered `USER_LOGGED_OUT`: the Google frame
sits inside home.nest.com, so Chrome sends only some of the cookies, and the
app needs that same selection.

Nothing is sent anywhere. The extension makes no network requests of its own,
and the values are kept in memory only and forgotten when Chrome closes. Google
rotates parts of the cookie within minutes, so paste the values into Homey and
test the connection straight away.

## Install for testing

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `browser-extension` folder.
3. Open home.nest.com, sign in, wait for your home to load, then click the
   extension icon.
4. Copy each value into the Nest Protect app settings in Homey and test the
   connection.

## Security

The cookie is a full Google account session credential. Anyone holding it holds
the account. Only paste it into Homey, keep it out of screenshots and bug
reports, and remove the extension when you no longer need it.
