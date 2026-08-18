import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/*
 * Firebase web configuration.
 * This is client configuration, not an Admin SDK secret.
 */
const firebaseConfig = {
  apiKey: "AIzaSyB9SXr7eGrGFIBV0F J8qtOGP4UDbYXJ7zU",
  authDomain: "chatpro-27e22.firebaseapp.com",
  projectId: "chatpro-27e22",
  storageBucket: "chatpro-27e22.firebasestorage.app",
  messagingSenderId: "38727605344",
  appId: "1:38727605344:web:ec978b717c4a4b9bb7b705"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ALLOWED_UIDS = new Set([
  "hk9Jmy7qKvdJReYaeRlDvvddVfy1",
  "xH4VGaQARfIe41fZGIsrzF62uj1"
]);

const loginScreen = document.querySelector("#login-screen");
const chatScreen = document.querySelector("#chat-screen");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const logoutBtn = document.querySelector("#logout-btn");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const messagesEl = document.querySelector("#messages");
const emptyState = document.querySelector("#empty-state");

let unsubscribeMessages = null;

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function renderMessage(doc) {
  const data = doc.data();
  const mine = auth.currentUser && data.senderId === auth.currentUser.uid;

  const bubble = document.createElement("article");
  bubble.className = `bubble ${mine ? "sent" : "received"}`;

  const text = document.createElement("div");
  text.textContent = data.text || "";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = formatTime(data.createdAt) + (mine ? "  ✓✓" : "");

  bubble.append(text, meta);
  return bubble;
}

function startMessageListener() {
  if (unsubscribeMessages) unsubscribeMessages();

  const q = query(
    collection(db, "couple", "main", "messages"),
    orderBy("createdAt", "asc")
  );

  unsubscribeMessages = onSnapshot(q, snapshot => {
    messagesEl.innerHTML = "";
    if (snapshot.empty) {
      messagesEl.appendChild(emptyState);
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    snapshot.forEach(doc => {
      messagesEl.appendChild(renderMessage(doc));
    });

    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }, error => {
    console.error(error);
    messagesEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "error";
    p.textContent = "Could not load the private conversation.";
    messagesEl.appendChild(p);
  });
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginError.textContent = "";

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    if (!ALLOWED_UIDS.has(credential.user.uid)) {
      await signOut(auth);
      throw new Error("This account is not authorized for this private chat.");
    }
  } catch (error) {
    console.error(error);
    loginError.textContent = "Login failed. Check your details.";
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

messageForm.addEventListener("submit", async event => {
  event.preventDefault();

  const text = messageInput.value.trim();
  const user = auth.currentUser;

  if (!text || !user || !ALLOWED_UIDS.has(user.uid)) return;

  messageInput.value = "";

  try {
    await addDoc(collection(db, "couple", "main", "messages"), {
      text,
      senderId: user.uid,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error(error);
    loginError.textContent = "Message could not be sent.";
  }
});

onAuthStateChanged(auth, user => {
  if (user && ALLOWED_UIDS.has(user.uid)) {
    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    startMessageListener();
  } else {
    chatScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
  }
});
