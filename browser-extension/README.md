# Nest Protect for Homey — setup helper

A small Chrome extension that copies the two values the Nest Protect Homey app
needs — the issue token and the cookie — from your signed-in browser, so you
don't have to dig through the developer tools.

## How it works

- When home.nest.com asks Google for a token, the extension notices the request
  and keeps its address (the issue token) in session storage. It only watches;
  it never blocks or changes anything.
- When you press **Copy** on the cookie, it reads the Google cookies your
  browser would send to `accounts.google.com/o/oauth2/iframe`, which is exactly
  what the app imitates.

It asks for access to `google.com` as well as `accounts.google.com` because
Chrome only hands an extension the cookies for domains it has permission for,
and the sign-in cookies live on `.google.com`. Without it, the session cookie
the app depends on is invisible to the extension.

Nothing is sent anywhere. The extension makes no network requests of its own,
the issue token is kept in memory only and forgotten when Chrome closes, and
the cookie is read fresh each time you copy it.

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
