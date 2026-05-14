<script setup>
/*
  Componente: Layout.vue
  - Recibe: estado global `state` y `socket` para acciones de sesión y salas.
  - Hace: administra la estructura principal de chat: lista de salas, creación de salas,
    selección de sala o chat privado y navegación (login/logout).
  - Emite/Acciones: cuando crea sala emite `crear-sala`; al seleccionar sala cambia la vista
    (nota: ya no emite `entrar-sala` al seleccionar, se hace al pulsar Entrar en `Sala.vue`).
*/
import { computed, ref } from "vue";
import { socket, state } from "../socket.js";
import { getAuth, signOut } from "firebase/auth";
import { supabase } from "../supabase.js";
import { useRouter } from "vue-router";
import ListadoUsuarios from "./ListadoUsuarios.vue";
import ListaDeChats from "./ListaDeChats.vue";
import ChatActivo from "./ChatActivo.vue";

const router = useRouter();
const auth = getAuth();
const chatPrivadoActivo = ref(null);
const nuevoNombreSala = ref("");

const tipoChatActivo = computed(() => {
  if (chatPrivadoActivo.value) return "privado";
  if (state.salaActivaId) return "grupal";
  return "";
});

const salaActiva = computed(() => {
  return state.salas.find((r) => r.id === state.salaActivaId) || null;
});

async function deslog() {
  const userId = state.usuarioActual?.uid;
  if (userId) {
    const nombre = userId + "_perfil";
    try {
      await supabase.storage.from("Perfiles").remove([nombre]);
    } catch (e) {
      console.log("Error al eliminar avatar en Supabase:", e);
    }
  }

  socket.emit("salir");
  try {
    localStorage.removeItem("usuarioActual");
    await signOut(auth);
    router.push("/");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

function abrirChatPrivado(usuario) {
  if (!state.chatsPrivados.find((u) => u.uid === usuario.uid)) {
    state.chatsPrivados.push(usuario);
  }

  if (!state.chatsPrivadosHistorial[usuario.uid]) {
    state.chatsPrivadosHistorial[usuario.uid] = [];
  }

  state.unreadPrivados[usuario.uid] = 0;
  state.chatPrivadoActivoUid = usuario.uid;
  chatPrivadoActivo.value = usuario;
}

function cerrarChatPrivado() {
  state.chatPrivadoActivoUid = "";
  chatPrivadoActivo.value = null;
}

function crearSala() {
  const nombre = (nuevoNombreSala.value || "").trim();
  if (!nombre) return;

  const id = nombre.toLowerCase().replace(/\s+/g, "-");
  socket.emit("crear-sala", { id, nombre });
  state.salaActivaId = id;
  nuevoNombreSala.value = "";

  state.chatPrivadoActivoUid = "";
  chatPrivadoActivo.value = null;
  socket.emit("entrar-sala", { roomId: id, uid: state.usuarioActual.uid });
}

function seleccionarSala(sala) {
  state.salaActivaId = sala.id;
  state.chatPrivadoActivoUid = "";
  chatPrivadoActivo.value = null;
}

function cerrarSala() {
  state.salaActivaId = "";
}
</script>

<template>
  <div class="chat-shell">
    <aside class="chats-list-sidebar">
      <ListaDeChats @select-chat="abrirChatPrivado" @select-sala="seleccionarSala" />
    </aside>

    <section v-if="tipoChatActivo" class="chat-main">
      <ChatActivo
        :tipo="tipoChatActivo"
        :usuario="chatPrivadoActivo"
        :sala="salaActiva"
        @close-privado="cerrarChatPrivado"
        @close-grupal="cerrarSala"
      />
    </section>

    <section v-else class="chat-main">
      <header class="chat-header">
        <div>
          <p class="chat-kicker">Salas</p>
          <h1>Grupos</h1>
          <p class="chat-status">Conectados ahora: {{ state.cantidad }}</p>
        </div>
        <input class="logout-button" type="button" value="Cerrar sesión" @click="deslog" />
      </header>

      <div class="salas-list">
        <div class="crear-sala">
          <input v-model="nuevoNombreSala" placeholder="Nueva sala (nombre)" />
          <button @click="crearSala">Crear</button>
        </div>
        <ul>
          <li v-for="s in state.salas" :key="s.id" @click="seleccionarSala(s)">
            <strong>{{ s.nombre }}</strong>
            <div class="small">{{ s.descripcion }}</div>
          </li>
        </ul>
      </div>
    </section>

    <aside class="chat-sidebar">
      <ListadoUsuarios @select-usuario="abrirChatPrivado" />
    </aside>
  </div>
</template>

<style scoped>
.chat-shell {
  height: 100vh;
  display: flex;
  background:
    radial-gradient(circle at top left, rgba(18, 140, 126, 0.14), transparent 32%),
    linear-gradient(180deg, #0a1117 0%, #101820 100%);
  overflow: hidden;
}

.chats-list-sidebar {
  min-width: 0;
  min-height: 0;
  flex: 0 0 260px;
  overflow: hidden;
  order: 0;
}

.chat-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 1.1rem;
  gap: 1rem;
  flex: 1;
  order: 1;
}

.chat-sidebar {
  min-width: 0;
  min-height: 0;
  order: 2;
  flex: 0 0 320px;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(14px);
  color: #edf4f7;
}

.chat-kicker {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7ebea7;
}

.chat-header h1 {
  margin: 0;
  font-size: 1.55rem;
  line-height: 1.1;
}

.chat-status {
  margin: 0.35rem 0 0;
  color: rgba(237, 244, 247, 0.72);
}

.logout-button {
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1rem;
  background: #25d366;
  color: #06311d;
  font-weight: 800;
  cursor: pointer;
}

.salas-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.salas-list .crear-sala {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.8rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}

.salas-list .crear-sala input {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  background: rgba(8, 15, 20, 0.78);
  color: #f6fafb;
}

.salas-list .crear-sala input::placeholder {
  color: rgba(246, 250, 251, 0.48);
}

.salas-list .crear-sala button {
  border: 0;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  background: #25d366;
  color: #000;
  font-weight: 700;
  cursor: pointer;
}

.salas-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 60vh;
  overflow: auto;
}

.salas-list li {
  padding: 0.75rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.15s ease;
}

.salas-list li strong {
  display: block;
  font-size: 0.95rem;
  color: #e9f0f4;
}

.salas-list li .small {
  font-size: 0.8rem;
  color: rgba(233, 240, 244, 0.6);
  margin-top: 0.2rem;
}

@media (max-width: 920px) {
  .chat-shell {
    flex-direction: column;
  }

  .chat-sidebar {
    order: 2;
    flex: 1;
  }
}
</style>