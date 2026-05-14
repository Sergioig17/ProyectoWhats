<script setup>
/*
  Componente: ListaDeChats.vue
  - Recibe: `state.salas`, `state.chatsPrivados` desde `socket.js`.
  - Hace: lista las salas y chats privados en la barra lateral; calcula no leídos.
  - Emite: `select-sala` al seleccionar una sala (solo cambia vista); `select-chat` para chats privados.
*/
import { computed } from "vue";
import { state } from "../socket.js";

const emit = defineEmits(["select-chat", "select-sala"]);

const chatsPrivados = computed(() => {
  return state.chatsPrivados || [];
});

const salas = computed(() => {
  return state.salas || [];
});

const filteredSalas = computed(() => {
  const uid = state.usuarioActual?.uid;
  if (!Array.isArray(salas.value)) return [];
  return salas.value.filter((s) => {
    if (s.id === "general") return true;
    if (!uid) return false;
    return (s.miembros || []).includes(uid);
  });
});

function seleccionarChat(usuario) {
  emit("select-chat", usuario);
}

function seleccionarSala(sala) {
  emit("select-sala", sala);
}

function obtenerNoLeidos(uid) {
  return state.unreadPrivados?.[uid] || 0;
}
</script>

<template>
  <section class="chats-sidebar">
    <div class="sidebar-header">
      <div>
        <p class="sidebar-kicker">Conversaciones</p>
        <h2>Chats</h2>
      </div>
    </div>

    <div class="chats-container">
      <!-- Salas -->
      <div class="section-salas">
        <p class="section-title">Salas</p>
        <ul v-if="filteredSalas.length > 0" class="salas-list">
          <li v-for="sala in filteredSalas" :key="sala.id" class="chat-item sala-item" @click="seleccionarSala(sala)">
            <div class="sala-icon">#</div>
            <div class="chat-meta">
              <strong>{{ sala.nombre }}</strong>
              <span>{{ sala.miembros?.length || 0 }} miembros</span>
            </div>
          </li>
        </ul>
        <div v-else class="empty-section">
          <p>Sin salas</p>
        </div>
      </div>

      <!-- Chats Privados -->
      <div class="section-privados">
        <p class="section-title">Privados</p>
        <ul v-if="chatsPrivados.length > 0" class="chats-list">
          <li v-for="usuario in chatsPrivados" :key="usuario.uid" class="chat-item" @click="seleccionarChat(usuario)">
            <div class="avatar">
              <img :src="usuario.imagen" :alt="usuario.nombre" />
            </div>
            <div class="chat-meta">
              <strong>{{ usuario.nombre }}</strong>
              <span>{{ usuario.estado || "En línea" }}</span>
            </div>
            <span v-if="obtenerNoLeidos(usuario.uid) > 0" class="chat-badge">
              {{ obtenerNoLeidos(usuario.uid) }}
            </span>
          </li>
        </ul>
        <div v-else class="empty-section">
          <p>Sin chats privados</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chats-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
  padding: 1.15rem;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, #0f1b22 0%, #111f28 100%);
  color: #e9f0f4;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-header div {
  flex: 1;
}

.sidebar-kicker {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7ebea7;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.2;
}

.chats-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-salas,
.section-privados {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-title {
  margin: 0;
  padding: 0 0.5rem;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
  color: #7ebea7;
}

.salas-list,
.chats-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease;
}

.chat-item:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateX(4px);
}

.sala-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: #128c7e;
  color: #fff;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.chat-meta strong {
  font-size: 0.95rem;
  color: #e9f0f4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-meta span {
  font-size: 0.8rem;
  color: rgba(233, 240, 244, 0.6);
}

.chat-badge {
  min-width: 1.2rem;
  height: 1.2rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: #e53935;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.empty-section {
  padding: 0.5rem;
  text-align: center;
  color: rgba(233, 240, 244, 0.5);
  font-size: 0.85rem;
}

.empty-section p {
  margin: 0;
}

/* Scrollbar personalizada */
.chats-container::-webkit-scrollbar {
  display: none;
}

.chats-container::-webkit-scrollbar-track {
 display: none;

}

.chats-container::-webkit-scrollbar-thumb {
  display: none;

}

.chats-container::-webkit-scrollbar-thumb:hover {
  display: none;

}
</style>
