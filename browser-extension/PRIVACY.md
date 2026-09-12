# Privacy policy — Nest Protect for Homey setup helper

Last updated: 12 September 2026

This Chrome extension exists for one purpose: to let you copy the two values the
Nest Protect app for Homey needs, the issue token and the cookie, from your own
signed-in browser, so you don't have to find them in the developer tools.

## What the extension reads

When you open home.nest.com, the page asks Google for a token. The extension
observes that single request, to `accounts.google.com/o/oauth2/iframerpc`, and
reads two things from it:

- the request address, which contains an opaque Google account identifier
  (`login_hint`) and is what the Homey app calls the issue token
- the Cookie header Chrome sends with that request, which contains your Google
  session cookies

It reads nothing else: no other requests, no page content, no browsing history.

## Where it is kept

Both values are held in Chrome's session storage, which lives in memory only.
They are never written to disk, and they are erased when you close Chrome or
press "Forget these values" in the extension.

## What it does with them

Nothing, unless you press a Copy button. Then it places that one value on your
clipboard so you can paste it into the Homey app yourself.

The extension makes no network requests of its own. It does not send, sell, or
share any data with the developer or anyone else, contains no analytics or
tracking, and runs no remotely hosted code.

## Your responsibility

The cookie is a full Google account session credential. Anyone holding it holds
your account. Only paste it into the Homey app, and keep it out of screenshots,
messages, and bug reports.

## Contact

Questions or concerns: https://github.com/torp93/homey-nest-protect/issues
