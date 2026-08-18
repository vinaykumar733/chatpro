# ChatPro — Private Couple Chat

Files:
- index.html
- style.css
- app.js
- firestore.rules

Deployment:
1. Upload all files to the root of the GitHub repository.
2. GitHub → Settings → Pages.
3. Source: Deploy from branch.
4. Branch: main.
5. Folder: / (root).

Firebase:
- Email/password Authentication
- Firestore
- No Firebase Storage
- No Analytics

Important:
- Do not add Firebase Admin SDK credentials.
- Keep Firestore Rules published exactly as configured.
- This first version is text chat only.
- Session presence, typing state, read receipts, replies, reactions, disappearing
	messages, and scoped conversation clearing use Firestore metadata under the
	authorized couple document.
- Voice recording and photo preview are memory-only browser flows. Sending either
	securely requires a short-lived authenticated relay or WebRTC service; Firebase
	Storage is intentionally not enabled and media bytes are never written to
	Firestore, browser storage, or the service-worker cache.
- Real background Web Push requires a server-side sender that authenticates the
	two users, stores subscription endpoints, and signs VAPID requests. No private
	key or insecure sender is included in this GitHub Pages client. The service
	worker handles push events privately by default and supports installed iPhone
	PWAs where Web Push is available.
- The client removes expired messages on its heartbeat. Firestore rules scope all
	reads to the two users and the current session; a hard server-side expiry
	guarantee requires enabling Firestore TTL or a trusted scheduled cleanup
	service, because Firestore rules cannot filter a realtime query by timestamp.
