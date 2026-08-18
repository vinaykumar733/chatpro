/* CHATPRO PRIVATE COUPLE CHAT
   Complete Firebase + login + realtime chat.
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.7.1/firebase-firestore.js";

console.log("CHATPRO: app loaded");

/* ================= FIREBASE CONFIG ================= */

const firebaseConfig = {
  apiKey: "AIzaSyB9SXr7eGrGFIBV0FJ8qtOGP4UDbYXJ7zU",
  authDomain: "chatpro-27e22.firebaseapp.com",
  projectId: "chatpro-27e22",
  storageBucket: "chatpro-27e22.firebasestorage.app",
  messagingSenderId: "38727605344",
  appId: "1:38727605344:web:ec978b717c4a4b9bb7b705"
};

/* ================= ONLY THESE TWO USERS ================= */

const MY_UID = "hk9Jmy7qKVdJReYaeRlDvuddVFy1";
const GIRLFRIEND_UID = "xH4VGaqQARfIe41fZGIsrzF62uj1";

const ALLOWED_UIDS = new Set([MY_UID, GIRLFRIEND_UID]);

/* ================= INITIALIZE ================= */

let firebaseApp;
let auth;
let db;

try {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  console.log("CHATPRO: Firebase initialized");
} catch (error) {
  console.error("CHATPRO: Firebase initialization error", error);
}

const messagesRef = db ? collection(db, "couple", "main", "messages") : null;

/* ================= ELEMENTS ================= */

const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");

const messages = document.getElementById("messages");
const chatError = document.getElementById("chat-error");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const logoutButton = document.getElementById("logout-button");

let stopMessages = null;

/* ================= UI ================= */

function showLogin() {
  loginScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
}

function showChat() {
  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  setTimeout(() => messageInput?.focus(), 100);
}

function errorText(text) {
  loginError.textContent = text || "";
}

function showChatError(text) {
  chatError.textContent = text || "";
  chatError.classList.toggle("hidden", !text);
}

function firestoreErrorText(error, action) {
  console.error(`CHATPRO: Firestore ${action} error`, error.code, error);

  switch (error.code) {
    case "permission-denied":
      return "Firestore denied this request. Confirm the published rules and your authorized UID.";
    case "unavailable":
      return "Firestore is temporarily unavailable. Check your network and try again.";
    case "failed-precondition":
      return "Firestore could not load messages. Check the database configuration.";
    default:
      return `Messages could not ${action === "listener" ? "load" : "be sent"} (${error.code || "unknown error"}).`;
  }
}

function setLoginLoading(value) {
  loginButton.disabled = value;
  loginButton.textContent = value ? "Entering privately..." : "Enter privately";
}

/* ================= AUTH ERRORS ================= */

function readableAuthError(error) {
  console.error("Firebase authentication error:", error);

  switch (error.code) {
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/invalid-login-credentials":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "Account not found.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    case "auth/unauthorized-domain":
      return "This website domain is not authorized in Firebase.";
    case "auth/api-key-not-valid":
      return "Firebase API key is not valid.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    default:
      return error.message || "Login failed.";
  }
}

/* ================= LOGIN ================= */

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  console.log("CHATPRO: login submitted");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorText("");

  if (!email || !password) {
    errorText("Please enter your email and password.");
    return;
  }

  setLoginLoading(true);

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);

    const user = result.user;

    console.log("CHATPRO: Firebase authentication successful");
    console.log("CHATPRO: authenticated UID =", user.uid);
    console.log("CHATPRO: allowed UID match =", ALLOWED_UIDS.has(user.uid));

    if (!ALLOWED_UIDS.has(user.uid)) {
      await signOut(auth);
      errorText("This account is not authorized for this private chat.");
      return;
    }

    showChat();
    startMessages(user.uid);

  } catch (error) {
    errorText(readableAuthError(error));
  } finally {
    setLoginLoading(false);
  }
});

loginButton.addEventListener("click", () => {
  console.log("CHATPRO: login button clicked");
});

/* ================= LOGOUT ================= */

logoutButton.addEventListener("click", async () => {
  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  await signOut(auth);
  passwordInput.value = "";
  errorText("");
  showLogin();
});

/* ================= SEND MESSAGE ================= */

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;
  const text = messageInput.value.trim();

  if (!user || !ALLOWED_UIDS.has(user.uid)) {
    errorText("You are not authorized.");
    return;
  }

  if (!text) return;

  if (text.length > 4000) {
    alert("Message is limited to 4000 characters.");
    return;
  }

  const sendButton = document.getElementById("send-button");
  sendButton.disabled = true;

  try {
    await addDoc(messagesRef, {
      senderId: user.uid,
      text: text,
      createdAt: serverTimestamp()
    });

    messageInput.value = "";
    messageInput.focus();
    showChatError("");

  } catch (error) {
    showChatError(firestoreErrorText(error, "send"));
  } finally {
    sendButton.disabled = false;
  }
});

/* ================= MESSAGE LISTENER ================= */

function startMessages(uid) {
  console.log("CHATPRO: starting Firestore listener");

  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc"),
    limit(200)
  );

  stopMessages = onSnapshot(
    messagesQuery,
    (snapshot) => {
      messages.replaceChildren();

      if (snapshot.empty) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        const heart = document.createElement("div");
        heart.className = "big-heart";
        heart.textContent = "♥";
        const heading = document.createElement("h2");
        heading.textContent = "Just us";
        const description = document.createElement("p");
        description.textContent = "Your private conversation starts here.";
        empty.append(heart, heading, description);
        messages.appendChild(empty);
        return;
      }

      snapshot.forEach((messageDoc) => {
        const data = messageDoc.data();
        const mine = data.senderId === uid;

        const row = document.createElement("div");
        row.className = mine ? "message-row mine" : "message-row theirs";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        const text = document.createElement("div");
        text.className = "message-text";
        text.textContent = data.text || "";

        const meta = document.createElement("div");
        meta.className = "message-meta";

        let time = "";

        if (data.createdAt) {
          const date = data.createdAt.toDate();
          time = date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
          });
        }

        meta.appendChild(document.createTextNode(time));

        if (mine) {
          const deleteButton = document.createElement("button");
          deleteButton.className = "message-delete";
          deleteButton.type = "button";
          deleteButton.textContent = "Delete";

          deleteButton.addEventListener("click", async () => {
            if (!confirm("Delete this message?")) return;

            try {
              await deleteDoc(
                doc(db, "couple", "main", "messages", messageDoc.id)
              );
              showChatError("");
            } catch (error) {
              showChatError(firestoreErrorText(error, "delete"));
            }
          });

          meta.appendChild(deleteButton);
        }

        bubble.appendChild(text);
        bubble.appendChild(meta);
        row.appendChild(bubble);
        messages.appendChild(row);
      });

      messages.scrollTop = messages.scrollHeight;
    },
    (error) => {
      const message = firestoreErrorText(error, "listener");

      messages.replaceChildren();

      const errorBox = document.createElement("div");
      errorBox.className = "chat-error";
      errorBox.textContent = message;
      messages.appendChild(errorBox);
    }
  );
}

/* ================= AUTH STATE ================= */

if (auth) {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("CHATPRO: auth persistence error", error.code, error);
  });
}

if (auth) {
  onAuthStateChanged(auth, (user) => {
    console.log("CHATPRO: auth state changed", user?.uid || "signed out");

    if (!user) {
      if (stopMessages) {
        stopMessages();
        stopMessages = null;
      }

      showLogin();
      return;
    }

    console.log("CHATPRO: authenticated UID =", user.uid);

    if (!ALLOWED_UIDS.has(user.uid)) {
      console.warn("CHATPRO: unauthorized account", user.uid);
      signOut(auth);
      errorText("This account is not authorized for this private chat.");
      showLogin();
      return;
    }

    showChat();
    startMessages(user.uid);
  });
} else {
  errorText("Firebase could not initialize. Check the configuration and reload.");
}
