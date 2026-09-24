# Chrome Web Store listing

Text for the developer dashboard, kept here so the listing and the code stay in
step. Not part of the extension package.

## Store listing tab

**Name**
Nest Protect for Homey — setup helper

**Summary** (132 characters max)
Copies the issue token and cookie the Nest Protect app for Homey needs from your signed-in browser. Nothing leaves your computer.

**Category**
Tools

**Language**
English

**Description**
Setting up the Nest Protect app for Homey normally means opening the developer tools, finding two network requests, and copying values out of them by hand. This extension does that part for you.

1. Open home.nest.com and sign in with Google.
2. Click the extension icon.
3. Copy the issue token and the cookie into the Nest Protect app settings in Homey, and test the connection.

How it works: when home.nest.com asks Google for a token, the extension notices that one request and keeps its address and the cookie Chrome sent with it. Those are exactly the values you would otherwise copy from the developer tools.

Privacy: the extension makes no network requests of its own, keeps the values in memory only, forgets them when Chrome closes, and never shares anything with anyone. It has no analytics and runs no remote code.

Important: the cookie gives full access to your Google account. Only paste it into Homey.

Not affiliated with Google, Nest, or Athom.

Source code: https://github.com/torp93/homey-nest-protect/tree/main/browser-extension

## Privacy practices tab

**Single purpose**
Copy the issue token and session cookie that the Nest Protect app for Homey needs from the user's own signed-in browser, so the user can paste them into the app.

**Permission justifications**

- `webRequest` — Observes the one token request home.nest.com makes to accounts.google.com/o/oauth2/iframerpc, to read its address and the Cookie header Chrome sends with it. Observation only; no request is blocked or modified.
- `storage` — Holds the two captured values in chrome.storage.session, in memory only, until the user copies them, presses "Forget these values", or closes Chrome.
- Host permission `https://accounts.google.com/*` — Required for webRequest to see the token request, which is sent to accounts.google.com.
- Host permission `https://home.nest.com/*` — The token request is made by the Google sign-in frame embedded in home.nest.com.

**Remote code**
No, I am not using remote code.

**Data usage**
Collected data type: Authentication information. It is read locally and placed on the clipboard only when the user clicks Copy. It is never transmitted.

Certify all three:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**
https://github.com/torp93/homey-nest-protect/blob/main/browser-extension/PRIVACY.md

# addons.mozilla.org listing (Firefox)

Submitted 23 September 2026 as version 0.3.0. Build with `node build.js` and
upload `dist/nest-protect-setup-helper-firefox-<version>.zip`. Platforms:
Firefox only, not Android. Source code submission: No (files are copied
unchanged, nothing is minified or bundled).

**Add-on URL**
nest-protect-for-homey

**Summary** (250 characters max)
Copies the issue token and cookie the Nest Protect app for Homey needs from your signed-in browser. Nothing leaves your computer.

**Description** (updated 24 September 2026)
Setting up the Nest Protect app for Homey normally means opening the developer tools, finding one network request, and copying values out of it by hand. This add-on does that part for you.

1. Open home.nest.com in Firefox, sign in with Google and wait until your home appears.
2. Click the add-on icon. If it asks for access to google.com and home.nest.com, allow it.
3. Copy the issue token and the cookie into the Nest Protect app settings in Homey, then test the connection.
4. Close the window afterwards, but don't sign out of Google. Signing out ends the session.

If the add-on finds nothing, the page is reusing its own session. Click the shield icon at the far left of the address bar, choose Clear cookies and site data (this only affects home.nest.com; your Google sign-in stays), and reload. If it then says the cookie is missing, switch off Enhanced Tracking Protection in the same panel and reload.

Why Firefox: Chrome and Edge tie your Google sign-in to your computer's security chip, so values copied from them stop working after about two and a half hours. Firefox doesn't, so the values keep working.

How it works, privacy, the cookie warning, the non-affiliation line and the
source link follow, as in the Chrome description above with Firefox in place of
Chrome.

**Categories**
My add-on doesn't fit into any of the categories

**Support website**
https://github.com/torp93/homey-nest-protect/issues

**License**
MIT License

**Privacy policy**
The text of PRIVACY.md, with Firefox in place of Chrome.

**Notes to reviewer**
Explain that the add-on serves the open-source Homey app; that background.js
listens with webRequest.onSendHeaders on exactly
https://accounts.google.com/o/oauth2/iframerpc* and acts only on the
issueToken action; that the URL and Cookie header go to storage.session in
memory only and reach the clipboard only on a Copy click; that there are no
network requests, remote code or analytics, hence data_collection_permissions
"none"; why each host permission is needed; and that the code is shared with
the Chrome Web Store version. To test: sign in on home.nest.com with Enhanced
Tracking Protection off for that site, then open the popup.
