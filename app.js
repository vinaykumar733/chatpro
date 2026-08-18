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

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const messagesRef = collection(db, "couple", "main", "messages");

/* ================= ELEMENTS ================= */

const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");

const messages = document.getElementById("messages");
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

  console.log("CHATPRO: login form submitted");

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

    console.log("CHATPRO: Firebase login successful");
    console.log("CHATPRO: UID:", user.uid);

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

  } catch (error) {
    console.error("CHATPRO: send message error", error);
    alert("Message could not be sent. Check Firestore Rules.");
  } finally {
    sendButton.disabled = false;
  }
});

/* ================= MESSAGE LISTENER ================= */

function startMessages(uid) {
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
      messages.innerHTML = "";

      if (snapshot.empty) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = `
          <div class="big-heart">♥</div>
          <h2>Just us</h2>
          <p>Your private conversation starts here.</p>
        `;
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
            } catch (error) {
              console.error(error);
              alert("Could not delete message.");
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
      console.error("CHATPRO: Firestore listener error", error);

      messages.innerHTML = "";

      const errorBox = document.createElement("div");
      errorBox.className = "chat-error";
      errorBox.textContent =
        "Messages cannot load. Your Firestore Rules need to be updated.";
      messages.appendChild(errorBox);
    }
  );
}

/* ================= AUTH STATE ================= */

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Persistence error:", error);
});

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

console.log("CHATPRO: application loaded successfully.");
