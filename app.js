/* =========================================================
   CHATPRO — PRIVATE COUPLE CHAT
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
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


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyB9SXr7eGrGFIBV0FJ8qtOGP4UDbYXJ7zU",
  authDomain: "chatpro-27e22.firebaseapp.com",
  projectId: "chatpro-27e22",
  storageBucket: "chatpro-27e22.firebasestorage.app",
  messagingSenderId: "38727605344",
  appId: "1:38727605344:web:ec978b717c4a4b9bb7b705"
};


/* =========================================================
   YOUR PRIVATE COUPLE IDS
   ========================================================= */

const MY_UID =
  "hk9Jmy7qKVdJReYaeRlDvuddVFy1";

const GIRLFRIEND_UID =
  "xH4VGaqQARfIe41fZGIsrzF62uj1";

const ALLOWED_UIDS = new Set([
  MY_UID,
  GIRLFRIEND_UID
]);


/* =========================================================
   INITIALIZE FIREBASE
   ========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================================
   FIRESTORE MESSAGE LOCATION
   ========================================================= */

const messagesRef = collection(
  db,
  "couple",
  "main",
  "messages"
);


/* =========================================================
   ELEMENTS
   ========================================================= */

const loginScreen =
  document.querySelector("#login-screen");

const chatScreen =
  document.querySelector("#chat-screen");

const loginForm =
  document.querySelector("#login-form");

const emailInput =
  document.querySelector("#email");

const passwordInput =
  document.querySelector("#password");

const loginButton =
  document.querySelector("#login-button");

const loginError =
  document.querySelector("#login-error");

const messagesContainer =
  document.querySelector("#messages") ||
  document.querySelector("#message-list") ||
  document.querySelector("#chat-messages");

const messageForm =
  document.querySelector("#message-form") ||
  document.querySelector("#chat-form");

const messageInput =
  document.querySelector("#message-input") ||
  document.querySelector("#message") ||
  document.querySelector("#chat-input");

const logoutButton =
  document.querySelector("#logout-button") ||
  document.querySelector("#logout");


let unsubscribeMessages = null;


/* =========================================================
   LOGIN ERROR
   ========================================================= */

function showLoginError(message) {

  if (!loginError) return;

  loginError.textContent = message;

  loginError.hidden = !message;
}


/* =========================================================
   LOADING BUTTON
   ========================================================= */

function setLoginLoading(loading) {

  if (!loginButton) return;

  loginButton.disabled = loading;

  loginButton.textContent =
    loading
      ? "Entering privately..."
      : "Enter privately";
}


/* =========================================================
   SHOW LOGIN
   ========================================================= */

function showLogin() {

  if (loginScreen) {
    loginScreen.hidden = false;
  }

  if (chatScreen) {
    chatScreen.hidden = true;
  }
}


/* =========================================================
   SHOW CHAT
   ========================================================= */

function showChat(user) {

  if (loginScreen) {
    loginScreen.hidden = true;
  }

  if (chatScreen) {
    chatScreen.hidden = false;
  }

  const userEmail =
    document.querySelector("#user-email") ||
    document.querySelector("#current-user-email");

  if (userEmail) {
    userEmail.textContent = user.email || "";
  }
}


/* =========================================================
   FIREBASE ERROR MESSAGE
   ========================================================= */

function firebaseError(error) {

  console.error("Firebase error:", error);

  switch (error.code) {

    case "auth/invalid-credential":
      return "Email or password is incorrect.";

    case "auth/invalid-login-credentials":
      return "Email or password is incorrect.";

    case "auth/user-not-found":
      return "Account not found.";

    case "auth/wrong-password":
      return "Incorrect password.";

    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";

    case "auth/unauthorized-domain":
      return "This website is not authorized in Firebase.";

    case "auth/api-key-not-valid":
      return "Firebase API key is not valid.";

    case "auth/network-request-failed":
      return "Network error. Check your internet.";

    default:
      return error.message ||
        "Login failed. Please try again.";
  }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login(email, password) {

  showLoginError("");

  setLoginLoading(true);

  try {

    const result =
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

    const user = result.user;


    /* ONLY TWO ACCOUNTS ALLOWED */

    if (!ALLOWED_UIDS.has(user.uid)) {

      await signOut(auth);

      throw new Error(
        "This account is not authorized for this private chat."
      );
    }


    showChat(user);

    startMessageListener(user);


  } catch (error) {

    console.error(
      "Private chat login error:",
      error
    );

    showLoginError(
      firebaseError(error)
    );

    showLogin();


  } finally {

    setLoginLoading(false);

  }
}


/* =========================================================
   LOGIN FORM
   ========================================================= */

/* =========================================================
   LOGIN BUTTON — ROBUST HANDLER
   ========================================================= */

async function handleLogin() {

  const email =
    document.querySelector("#email")?.value?.trim() || "";

  const password =
    document.querySelector("#password")?.value || "";

  const button =
    document.querySelector("#login-button") ||
    document.querySelector("button[type='submit']");

  console.log("LOGIN BUTTON CLICKED");
  console.log("Email:", email);

  if (!email || !password) {

    showLoginError(
      "Please enter your email and password."
    );

    return;
  }

  try {

    if (button) {
      button.disabled = true;
      button.textContent = "Entering privately...";
    }

    showLoginError("");

    const result =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = result.user;

    console.log(
      "Firebase login successful:",
      user.uid
    );

    /* ONLY YOUR TWO ACCOUNTS */

    if (!ALLOWED_UIDS.has(user.uid)) {

      await signOut(auth);

      showLoginError(
        "This account is not authorized for this private chat."
      );

      return;
    }

    showChat(user);

    startMessageListener(user);

  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    showLoginError(
      firebaseError(error)
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = "Enter privately";
    }

  }
}


/* Listen for normal form submit */

document.addEventListener(
  "submit",
  (event) => {

    const form =
      event.target;

    if (
      form.matches("#login-form") ||
      form.querySelector("#email")
    ) {

      event.preventDefault();

      handleLogin();

    }

  }
);


/* Listen for button click */

document.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "#login-button, button[type='submit']"
      );

    if (!button) return;

    const emailField =
      document.querySelector("#email");

    const passwordField =
      document.querySelector("#password");

    if (
      emailField &&
      passwordField
    ) {

      event.preventDefault();

      handleLogin();

    }

  }
);

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   TIME
   ========================================================= */

function formatTime(timestamp) {

  if (!timestamp) {
    return "";
  }

  try {

    const date =
      timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    return date.toLocaleTimeString(
      [],
      {
        hour: "numeric",
        minute: "2-digit"
      }
    );

  } catch {

    return "";

  }
}


/* =========================================================
   DISPLAY MESSAGES
   ========================================================= */

function renderMessages(
  snapshot,
  currentUid
) {

  if (!messagesContainer) {
    return;
  }

  messagesContainer.innerHTML = "";


  if (snapshot.empty) {

    const empty =
      document.createElement("div");

    empty.className =
      "empty-chat";

    empty.textContent =
      "Your private space starts here ❤️";

    messagesContainer.appendChild(empty);

    return;
  }


  snapshot.docs.forEach(
    (messageDoc) => {

      const message =
        messageDoc.data();

      const mine =
        message.senderId === currentUid;


      const row =
        document.createElement("div");

      row.className =
        mine
          ? "message-row mine"
          : "message-row theirs";


      const bubble =
        document.createElement("div");

      bubble.className =
        "message-bubble";


      if (message.text) {

        const text =
          document.createElement("div");

        text.className =
          "message-text";

        text.textContent =
          message.text;

        bubble.appendChild(text);

      }


      const meta =
        document.createElement("div");

      meta.className =
        "message-meta";

      meta.textContent =
        formatTime(message.createdAt);


      if (mine) {

        const deleteButton =
          document.createElement("button");

        deleteButton.type =
          "button";

        deleteButton.className =
          "message-delete";

        deleteButton.textContent =
          "Delete";


        deleteButton.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                "Delete this message?"
              )
            ) {
              return;
            }

            try {

              await deleteDoc(
                doc(
                  db,
                  "couple",
                  "main",
                  "messages",
                  messageDoc.id
                )
              );

            } catch (error) {

              console.error(
                "Delete failed:",
                error
              );

              alert(
                "Could not delete message."
              );

            }

          }
        );


        meta.appendChild(
          deleteButton
        );

      }


      bubble.appendChild(meta);

      row.appendChild(bubble);

      messagesContainer.appendChild(row);

    }
  );


  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;

}


/* =========================================================
   REAL-TIME MESSAGE LISTENER
   ========================================================= */

function startMessageListener(user) {

  if (
    !user ||
    !ALLOWED_UIDS.has(user.uid)
  ) {
    return;
  }


  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages = null;

  }


  const messagesQuery =
    query(
      messagesRef,
      orderBy(
        "createdAt",
        "asc"
      ),
      limit(200)
    );


  unsubscribeMessages =
    onSnapshot(
      messagesQuery,

      (snapshot) => {

        renderMessages(
          snapshot,
          user.uid
        );

      },

      (error) => {

        console.error(
          "Firestore listener error:",
          error
        );

        if (messagesContainer) {

          messagesContainer.innerHTML = "";

          const errorElement =
            document.createElement("div");

          errorElement.className =
            "chat-error";

          errorElement.textContent =
            "Unable to load messages. Check Firestore Rules.";

          messagesContainer.appendChild(
            errorElement
          );

        }

      }
    );

}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage(text) {

  const user =
    auth.currentUser;


  if (
    !user ||
    !ALLOWED_UIDS.has(user.uid)
  ) {

    throw new Error(
      "Unauthorized user."
    );

  }


  const cleanText =
    text.trim();


  if (!cleanText) {
    return;
  }


  if (cleanText.length > 4000) {

    throw new Error(
      "Message is too long."
    );

  }


  await addDoc(
    messagesRef,
    {
      senderId: user.uid,

      text: cleanText,

      createdAt:
        serverTimestamp()
    }
  );

}


/* =========================================================
   SEND MESSAGE FORM
   ========================================================= */

if (messageForm) {

  messageForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const text =
        messageInput?.value || "";


      try {

        await sendMessage(text);


        if (messageInput) {

          messageInput.value = "";

          messageInput.focus();

        }

      } catch (error) {

        console.error(
          "Send message failed:",
          error
        );

        alert(
          error.message ||
          "Could not send message."
        );

      }

    }
  );

}


/* =========================================================
   LOGOUT
   ========================================================= */

if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    async () => {

      try {

        if (unsubscribeMessages) {

          unsubscribeMessages();

          unsubscribeMessages = null;

        }


        await signOut(auth);

        showLogin();


        if (passwordInput) {

          passwordInput.value = "";

        }

      } catch (error) {

        console.error(
          "Logout failed:",
          error
        );

      }

    }
  );

}


/* =========================================================
   AUTH PERSISTENCE
   ========================================================= */

setPersistence(
  auth,
  browserLocalPersistence
).catch(
  (error) => {
    console.error(
      "Persistence error:",
      error
    );
  }
);


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
  auth,
  (user) => {

    if (!user) {

      showLogin();

      if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;

      }

      return;
    }


    if (
      !ALLOWED_UIDS.has(user.uid)
    ) {

      console.warn(
        "Unauthorized account:",
        user.uid
      );

      signOut(auth);

      showLoginError(
        "This account is not authorized for this private chat."
      );

      return;
    }


    showChat(user);

    startMessageListener(user);

  }
);


console.log(
  "ChatPro initialized successfully."
);

console.log(
  "Private couple access control enabled."
);
