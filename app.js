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
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  where,
  Timestamp
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
const sessionRef = db ? doc(db, "couple", "main", "session") : null;
const presenceRef = (uid) => db ? doc(db, "couple", "main", "presence", uid) : null;
const typingRef = (uid) => db ? doc(db, "couple", "main", "typing", uid) : null;

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
const disappearingSetting = document.getElementById("disappearing-setting");
const panicClearButton = document.getElementById("panic-clear-button");
const notificationStatus = document.getElementById("notification-status");
const installButton = document.getElementById("install-button");
const installTitle = document.getElementById("install-title");
const installCopy = document.getElementById("install-copy");
const iosInstallHelp = document.getElementById("ios-install-help");
const emojiButton = document.getElementById("emoji-button");
const emojiPicker = document.getElementById("emoji-picker");

let stopMessages = null;
let stopPresence = null;
let stopTyping = null;
let heartbeatTimer = null;
let expiryTimer = null;
let typingTimer = null;
let currentSessionId = null;
let replyTo = null;
let recording = null;
let activeUid = null;
let audioContext = null;
let audioUnlocked = false;
let deferredInstallPrompt = null;
let messagesHydrated = false;
const notifiedMessageIds = new Set();
const preferences = {
  sound: localStorage.getItem("private.sound") !== "off",
  notifications: localStorage.getItem("private.notifications") !== "off",
  previews: localStorage.getItem("private.previews") !== "off",
  vibration: localStorage.getItem("private.vibration") !== "off"
};
const disappearingOptions = {off: 0, "30s": 30, "5m": 300, "1h": 3600, "24h": 86400};

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
    notificationSetting.checked = preferences.notifications;
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

function otherUid(uid) {
  return uid === MY_UID ? GIRLFRIEND_UID : MY_UID;
}

function sessionMessageRef(id) {
  return doc(db, "couple", "main", "messages", id);
}

function reactionRef(messageId, uid) {
  return doc(db, "couple", "main", "messages", messageId, "reactions", uid);
}

async function ensureSession() {
  if (!sessionRef) return null;
  const snapshot = await getDoc(sessionRef);
  if (snapshot.exists() && snapshot.data().id) return snapshot.data();
  const session = {id: crypto.randomUUID(), createdAt: serverTimestamp(), offlineSince: null};
  await setDoc(sessionRef, session, {merge: true});
  currentSessionId = session.id;
  return session;
}

function presenceIsFresh(data) {
  return data?.heartbeatAt && Date.now() - data.heartbeatAt.toMillis() < 45000;
}

async function writePresence(uid, online) {
  const ref = presenceRef(uid);
  if (!ref) return;
  await setDoc(ref, {online, heartbeatAt: serverTimestamp(), lastSeenAt: serverTimestamp()}, {merge: true});
}

async function monitorEphemeralSession(uid) {
  if (!sessionRef) return;
  const session = await getDoc(sessionRef);
  if (!session.exists()) return;
  const presence = await Promise.all([getDoc(presenceRef(uid)), getDoc(presenceRef(otherUid(uid)))]);
  const bothOffline = presence.every((item) => !presenceIsFresh(item.data()));
  const data = session.data();
  if (!bothOffline) {
    if (data.offlineSince) await updateDoc(sessionRef, {offlineSince: null});
    return;
  }
  if (!data.offlineSince) {
    await updateDoc(sessionRef, {offlineSince: serverTimestamp()});
    return;
  }
  if (Date.now() - data.offlineSince.toMillis() < 60000) return;
  const snapshot = await getDocs(query(messagesRef, where("sessionId", "==", data.id), limit(200)));
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  await updateDoc(sessionRef, {id: crypto.randomUUID(), createdAt: serverTimestamp(), offlineSince: null});
  currentSessionId = null;
}

function startPresence(uid) {
  stopPresence?.();
  stopTyping?.();
  clearInterval(heartbeatTimer);
  clearInterval(expiryTimer);
  writePresence(uid, true).catch((error) => console.error("CHATPRO: presence error", error));
  heartbeatTimer = setInterval(() => {
    writePresence(uid, true).catch(() => {});
    monitorEphemeralSession(uid).catch(() => {});
  }, 15000);
  expiryTimer = setInterval(() => expireMessages(uid).catch(() => {}), 10000);
  const otherPresence = presenceRef(otherUid(uid));
  stopPresence = onSnapshot(otherPresence, (snapshot) => {
    const online = presenceIsFresh(snapshot.data());
    const presence = document.getElementById("presence");
    if (presence) {
      presence.lastChild.textContent = online ? " Online" : " Offline";
      presence.querySelector("i")?.style.setProperty("background", online ? "#34c759" : "#8e8e93");
    }
  });
}

async function expireMessages(uid) {
  if (!messagesRef || !currentSessionId) return;
  const snapshot = await getDocs(query(messagesRef, where("sessionId", "==", currentSessionId), limit(200)));
  const now = Date.now();
  await Promise.all(snapshot.docs.filter((item) => item.data().expiresAt?.toMillis() <= now).map((item) => deleteDoc(item.ref)));
}

function stopPresenceFor(uid) {
  stopPresence?.();
  stopPresence = null;
  stopTyping?.();
  stopTyping = null;
  clearInterval(heartbeatTimer);
  clearInterval(expiryTimer);
  clearTimeout(typingTimer);
  writePresence(uid, false).catch(() => {});
  setDoc(typingRef(uid), {typing: false, updatedAt: serverTimestamp()}, {merge: true}).catch(() => {});
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
disappearingSetting.value = localStorage.getItem("private.disappearing") || "off";
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
disappearingSetting.addEventListener("change", () => {
  localStorage.setItem("private.disappearing", disappearingSetting.value);
});
panicClearButton.addEventListener("click", async () => {
  if (!auth.currentUser || !confirm("Delete this private conversation?")) return;
  try {
    const snapshot = await getDocs(query(messagesRef, where("sessionId", "==", currentSessionId), limit(200)));
    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
    showChatError("");
  } catch (error) {
    showChatError(firestoreErrorText(error, "delete"));
  }
});
notificationSetting.addEventListener("change", () => {
  preferences.notifications = notificationSetting.checked;
  localStorage.setItem("private.notifications", preferences.notifications ? "on" : "off");
  if (notificationSetting.checked) enableNotifications();
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
document.getElementById("plus-button").addEventListener("click", () => {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    showChatError("Photo preview is ready, but secure temporary transfer needs a private backend.");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  });
  picker.click();
});

const micButton = document.getElementById("mic-button");
let recordingStartedAt = 0;
let recordingReleased = false;
async function beginRecording(event) {
  event.preventDefault();
  if (recording) return;
  recordingReleased = false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.addEventListener("dataavailable", (item) => chunks.push(item.data));
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, {type: recorder.mimeType});
      recording = null;
      const seconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
      if (confirm(`Send ${seconds}s voice message?`)) showChatError("Voice transfer needs a private backend and was not sent.");
      void blob;
    });
    recorder.start();
    recording = recorder;
    recordingStartedAt = Date.now();
    if (recordingReleased) endRecording();
    showChatError("Recording... release the microphone to finish.");
  } catch {
    showChatError("Microphone access was not granted.");
  }
}
function endRecording() {
  recordingReleased = true;
  if (recording?.state === "recording") recording.stop();
}
micButton.addEventListener("pointerdown", beginRecording);
micButton.addEventListener("pointerup", endRecording);
micButton.addEventListener("pointercancel", endRecording);
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

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  try {
    stopPresenceFor(auth.currentUser.uid);
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

function updateTyping(uid) {
  clearTimeout(typingTimer);
  setDoc(typingRef(uid), {typing: true, updatedAt: serverTimestamp()}, {merge: true}).catch(() => {});
  typingTimer = setTimeout(() => {
    setDoc(typingRef(uid), {typing: false, updatedAt: serverTimestamp()}, {merge: true}).catch(() => {});
  }, 1800);
}

function showReply(messageId, text, senderId) {
  replyTo = {messageId, text: text.slice(0, 160), senderId};
  document.getElementById("reply-copy").textContent = `Replying to: ${replyTo.text}`;
  document.getElementById("reply-bar").classList.remove("hidden");
  messageInput.focus();
}

document.getElementById("cancel-reply").addEventListener("click", () => {
  replyTo = null;
  document.getElementById("reply-bar").classList.add("hidden");
});

messageInput.addEventListener("input", () => {
  const user = auth.currentUser;
  if (user && messageInput.value.trim()) updateTyping(user.uid);
});

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
    const seconds = disappearingOptions[disappearingSetting.value] || 0;
    const message = {
      senderId: user.uid,
      text: text,
      createdAt: serverTimestamp(),
      sessionId: currentSessionId,
      ...(seconds ? {expiresAt: Timestamp.fromMillis(Date.now() + seconds * 1000)} : {}),
      ...(replyTo ? {replyTo: {messageId: replyTo.messageId, text: replyTo.text, senderId: replyTo.senderId}} : {})
    };
    await addDoc(messagesRef, message);

    messageInput.value = "";
    replyTo = null;
    document.getElementById("reply-bar").classList.add("hidden");
    setDoc(typingRef(user.uid), {typing: false, updatedAt: serverTimestamp()}, {merge: true}).catch(() => {});
    messageInput.focus();
    showChatError("");

  } catch (error) {
    showChatError(firestoreErrorText(error, "send"));
  } finally {
    sendButton.disabled = false;
  }
});

/* ================= MESSAGE LISTENER ================= */

async function startMessages(uid) {
  console.log("CHATPRO: starting Firestore listener");

  if (stopMessages) {
    stopMessages();
    stopMessages = null;
  }

  messagesHydrated = false;
  notifiedMessageIds.clear();
  const session = await ensureSession();
  currentSessionId = session?.id || currentSessionId;
  startPresence(uid);
  stopTyping = onSnapshot(typingRef(otherUid(uid)), (snapshot) => {
    const data = snapshot.data();
    const typing = data?.typing && data.updatedAt && Date.now() - data.updatedAt.toMillis() < 5000;
    const presence = document.getElementById("presence");
    if (presence && typing) presence.lastChild.textContent = " Typing...";
  });

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
        if (data.sessionId && data.sessionId !== currentSessionId) return;
        if (data.expiresAt?.toMillis() <= Date.now()) return;
        const mine = data.senderId === uid;

        if (!mine && messagesHydrated && !notifiedMessageIds.has(messageDoc.id)) {
          notifiedMessageIds.add(messageDoc.id);
          const preview = data.text || "New message";
          playMessageTone();
          showToast(preview);
          if (preferences.notifications && document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
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

        if (data.replyTo) {
          const reply = document.createElement("div");
          reply.className = "message-reply";
          reply.textContent = `↪ ${data.replyTo.text}`;
          bubble.appendChild(reply);
        }

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
          const read = data.readBy?.includes(otherUid(uid));
          const delivered = data.deliveredTo?.includes(otherUid(uid));
          deliveryStatus.textContent = read ? "✓✓ Read" : delivered ? "✓✓ Delivered" : "✓ Sent";
          deliveryStatus.setAttribute("aria-label", read ? "Message read" : delivered ? "Message delivered" : "Message sent");
          meta.appendChild(deliveryStatus);

          const deleteButton = document.createElement("button");
          deleteButton.className = "message-delete";
          deleteButton.type = "button";
          deleteButton.textContent = "Delete";

          deleteButton.addEventListener("click", async () => {
            if (!confirm("Delete this message?")) return;

            try {
              await deleteDoc(sessionMessageRef(messageDoc.id));
              showChatError("");
            } catch (error) {
              showChatError(firestoreErrorText(error, "delete"));
            }
          });

          meta.appendChild(deleteButton);
        }

        const actions = document.createElement("div");
        actions.className = "message-actions hidden";
        [["Reply", () => showReply(messageDoc.id, data.text || "", data.senderId)], ["Copy", () => navigator.clipboard?.writeText(data.text || "")], ["Delete", () => deleteDoc(sessionMessageRef(messageDoc.id))]].forEach(([label, action]) => {
          const actionButton = document.createElement("button");
          actionButton.type = "button";
          actionButton.textContent = label;
          actionButton.addEventListener("click", async () => {
            try { await action(); actions.classList.add("hidden"); } catch (error) { showChatError(firestoreErrorText(error, "delete")); }
          });
          actions.appendChild(actionButton);
        });
        ["❤️", "😂", "👍", "😮", "😢", "🔥"].forEach((emoji) => {
          const reactionButton = document.createElement("button");
          reactionButton.type = "button";
          reactionButton.textContent = emoji;
          reactionButton.setAttribute("aria-label", `React ${emoji}`);
          reactionButton.addEventListener("click", async () => {
            const reaction = reactionRef(messageDoc.id, uid);
            const existing = await getDoc(reaction);
            if (existing.exists() && existing.data().emoji === emoji) await deleteDoc(reaction);
            else await setDoc(reaction, {emoji, createdAt: serverTimestamp()});
          });
          actions.appendChild(reactionButton);
        });
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          actions.classList.toggle("hidden");
        });

        bubble.appendChild(text);
        bubble.appendChild(meta);
        bubble.appendChild(actions);
        row.appendChild(bubble);
        messages.appendChild(row);

        if (!mine && !data.deliveredTo?.includes(uid)) updateDoc(sessionMessageRef(messageDoc.id), {deliveredTo: arrayUnion(uid)}).catch(() => {});
        if (!mine && !document.hidden && !data.readBy?.includes(uid)) updateDoc(sessionMessageRef(messageDoc.id), {readBy: arrayUnion(uid)}).catch(() => {});
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
      if (activeUid) stopPresenceFor(activeUid);
      activeUid = null;

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
    activeUid = user.uid;
    startMessages(user.uid);
  });
} else {
  errorText("Firebase could not initialize. Check the configuration and reload.");
}
