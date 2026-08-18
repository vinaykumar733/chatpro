# Private Couple Chat

A small private two-user chat built for GitHub Pages + Firebase Authentication + Firestore.

## Current features

- Two authorized Firebase accounts only
- Email/password login
- Real-time Firestore chat
- Snapchat-inspired visual theme
- WhatsApp-inspired chat bubbles
- No Analytics
- No Firebase Storage
- No permanent photo gallery

## Important

The included Firebase configuration is web-client configuration. Never add Firebase Admin SDK credentials or service-account JSON files to this repository.

The Firestore rules included here are intentionally restricted to the two Firebase UIDs configured for this project.

## GitHub Pages

Upload `index.html`, `style.css`, and `app.js` to a GitHub repository.

Then enable:

Settings → Pages → Deploy from branch → main → / (root)

Before public deployment, test the app locally and verify the Firestore rules.

## Photo plan

Firebase Storage is intentionally not used because this project is staying on the Spark plan.

For temporary photos, the next phase should use browser-side encryption plus a peer-to-peer WebRTC transfer where possible. The photo bytes should not be written to Firestore.
