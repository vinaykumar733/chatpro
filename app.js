/* CHATPRO PRIVATE COUPLE CHAT
   Complete Firebase + login + realtime chat.
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

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
  deleteDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

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
const passwordToggle = document.getElementById("password-toggle");

const messages = document.getElementById("messages");
const chatError = document.getElementById("chat-error");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const logoutButton = document.getElementById("logout-button");
const settingsButton = document.getElementById("settings-button");
const settingsPanel = document.getElementById("settings-panel");
const soundSetting = document.getElementById("sound-setting");
const notificationSetting = document.getElementById("notification-setting");
const previewSetting = document.getElementById("preview-setting");
const vibrationSetting = document.getElementById("vibration-setting");
const notificationStatus = document.getElementById("notification-status");
const installButton = document.getElementById("install-button");
const installTitle = document.getElementById("install-title");
const installCopy = document.getElementById("install-copy");
const iosInstallHelp = document.getElementById("ios-install-help");
const emojiButton = document.getElementById("emoji-button");
const emojiPicker = document.getElementById("emoji-picker");

let stopMessages = null;
let audioContext = null;
let audioUnlocked = false;
let deferredInstallPrompt = null;
let messagesHydrated = false;
const notifiedMessageIds = new Set();
const preferences = {
  sound: localStorage.getItem("private.sound") !== "off",
  previews: localStorage.getItem("private.previews") !== "off",
  vibration: localStorage.getItem("private.vibration") !== "off"
};

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
  loginButton.classList.toggle("loading", value);
}

function unlockAudio() {
  if (audioUnlocked) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  audioContext.resume().then(() => {
    audioUnlocked = true;
  }).catch(() => {});
}

function playMessageTone() {
  if (!preferences.sound || !audioUnlocked || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, now);
  oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.11);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.24);
  if (preferences.vibration && navigator.vibrate) navigator.vibrate(35);
}

function showToast(preview) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  const title = document.createElement("strong");
  title.textContent = "New message";
  const body = document.createElement("span");
  body.textContent = preferences.previews ? preview : "New message";
  toast.append(title, body);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function updateNotificationStatus() {
  if (!("Notification" in window)) {
    notificationStatus.textContent = "Notifications are not supported in this browser.";
    notificationSetting.checked = false;
    notificationSetting.disabled = true;
    return;
  }
  if (Notification.permission === "granted") {
    notificationStatus.textContent = "Notifications enabled.";
    notificationSetting.checked = true;
  } else if (Notification.permission === "denied") {
    notificationStatus.textContent = "Notifications blocked — open browser settings to enable them.";
    notificationSetting.checked = false;
  } else {
    notificationStatus.textContent = "Allow notifications to receive alerts for new messages.";
    notificationSetting.checked = false;
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) return updateNotificationStatus();
  const permission = await Notification.requestPermission();
  updateNotificationStatus();
  if (permission === "granted") registerServiceWorker();
}

function isIosSafari() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function updateInstallOption() {
  if (isStandalone()) {
    installButton.classList.add("hidden");
    iosInstallHelp.classList.add("hidden");
  } else if (isIosSafari()) {
    installButton.classList.add("hidden");
    iosInstallHelp.classList.remove("hidden");
  } else if (deferredInstallPrompt) {
    installTitle.textContent = "Install PRIVATE";
    installCopy.textContent = "Add a private space to your home screen.";
    installButton.classList.remove("hidden");
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./service-worker.js", {scope: "./"});
  } catch (error) {
    console.error("PRIVATE: service worker registration failed", error);
  }
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

passwordToggle.addEventListener("click", () => {
  const visible = passwordInput.type === "text";
  passwordInput.type = visible ? "password" : "text";
  passwordToggle.textContent = visible ? "Show" : "Hide";
  passwordToggle.setAttribute("aria-label", visible ? "Show password" : "Hide password");
});

document.addEventListener("pointerdown", unlockAudio, {once: true});
settingsButton.addEventListener("click", () => {
  settingsPanel.classList.remove("hidden");
  updateNotificationStatus();
  updateInstallOption();
});
document.querySelectorAll("[data-close-settings]").forEach((element) => {
  element.addEventListener("click", () => settingsPanel.classList.add("hidden"));
});

soundSetting.checked = preferences.sound;
previewSetting.checked = preferences.previews;
vibrationSetting.checked = preferences.vibration;
soundSetting.addEventListener("change", () => {
  preferences.sound = soundSetting.checked;
  localStorage.setItem("private.sound", preferences.sound ? "on" : "off");
});
previewSetting.addEventListener("change", () => {
  preferences.previews = previewSetting.checked;
  localStorage.setItem("private.previews", preferences.previews ? "on" : "off");
});
vibrationSetting.addEventListener("change", () => {
  preferences.vibration = vibrationSetting.checked;
  localStorage.setItem("private.vibration", preferences.vibration ? "on" : "off");
});
notificationSetting.addEventListener("change", () => {
  if (notificationSetting.checked) enableNotifications();
  else notificationSetting.checked = typeof Notification !== "undefined" && Notification.permission === "granted";
});

emojiButton.addEventListener("click", () => {
  emojiPicker.classList.toggle("hidden");
  messageInput.focus();
});
emojiPicker.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value += button.dataset.emoji;
    messageInput.focus();
  });
});
document.getElementById("plus-button").addEventListener("click", () => messageInput.focus());
document.getElementById("mic-button").addEventListener("click", () => showChatError("Voice messages are not enabled for this private chat."));
document.getElementById("call-button").addEventListener("click", () => showChatError("Calls are not enabled for this private chat."));

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallOption();
});
installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallOption();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallOption();
});
window.addEventListener("load", () => {
  registerServiceWorker();
  updateInstallOption();
  updateNotificationStatus();
});

/* ================= LOGOUT ================= */

async function clearMessages() {
  if (!messagesRef) return;

  const snapshot = await getDocs(messagesRef);
  await Promise.all(snapshot.docs.map((messageDoc) => deleteDoc(messageDoc.ref)));
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  try {
    await clearMessages();
    await signOut(auth);
    passwordInput.value = "";
    messageInput.value = "";
    errorText("");
    showLogin();
  } catch (error) {
    showChatError("Messages could not be cleared. Please try again.");
  } finally {
    logoutButton.disabled = false;
  }
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

  messagesHydrated = false;
  notifiedMessageIds.clear();

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
        messagesHydrated = true;
        return;
      }

      snapshot.forEach((messageDoc) => {
        const data = messageDoc.data();
        const mine = data.senderId === uid;

        if (!mine && messagesHydrated && !notifiedMessageIds.has(messageDoc.id)) {
          notifiedMessageIds.add(messageDoc.id);
          const preview = data.text || "New message";
          playMessageTone();
          showToast(preview);
          if (document.hidden && Notification.permission === "granted") {
            navigator.serviceWorker?.ready.then((registration) => registration.showNotification("New message", {
              body: preferences.previews ? preview : "New message",
              tag: `private-message-${messageDoc.id}`,
              icon: "./icons/icon-192.svg",
              badge: "./icons/icon-192.svg",
              data: {url: window.location.href}
            })).catch(() => {});
          }
        }

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
          const deliveryStatus = document.createElement("span");
          deliveryStatus.className = "message-status";
          deliveryStatus.textContent = "✓✓";
          deliveryStatus.setAttribute("aria-label", "Message sent");
          meta.appendChild(deliveryStatus);

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
      messagesHydrated = true;
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
