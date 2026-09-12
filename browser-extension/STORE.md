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
