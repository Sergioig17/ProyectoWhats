import { createApp } from "vue";
import App from "./App.vue";
import "./App.css";
import "./socket.js";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { createRouter, createWebHistory } from "vue-router";
import LandingPage from "./components/LandingPage.vue";
import Layaout from "./components/Layout.vue";
import EditProfile from "./components/EditProfile.vue";

const firebaseConfig = {
  apiKey: process.env.VUE_APP_FIREBASE_API_KEY,

  authDomain: "whatsapproyect-fd254.firebaseapp.com",

  projectId: "whatsapproyect-fd254",

  storageBucket: "whatsapproyect-fd254.firebasestorage.app",

  messagingSenderId: "1052540580125",

  appId: "1:1052540580125:web:f31045da7938a3afe5f1f4",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Hay sesión activa, redirige al chat
    router.push("/chat");
  } else {
    // No hay sesión, redirige al login
    router.push("/");
  }
});
const routes = [
  { path: "/", component: LandingPage, meta: { requiresAuth: false } },
  {
    path: "/chat",
    component: Layaout,
    meta: { requiresAuth: true },
  },
  {
    path: "/editar-perfil",
    component: EditProfile,
    meta: { requiresAuth: true },
  },
];
const router = createRouter({
  routes,
  history: createWebHistory(),
});
createApp(App).use(router).mount("#app");
