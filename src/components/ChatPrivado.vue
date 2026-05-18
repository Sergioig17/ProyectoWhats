<script setup>
/*
  Componente: ChatPrivado.vue
  - Recibe: props/estado para identificar el usuario remoto con quien chatear.
  - Hace: renderiza la conversación privada, permite enviar mensajes privados mediante socket.
  - Emite/Acciones: usa `socket.emit('mensaje-privado', ...)` para enviar mensajes privados;
    actualiza `state.chatsPrivadosHistorial` localmente cuando llegan mensajes.
*/
import { ref, computed, onMounted, watch } from "vue";
import { socket, state } from "../socket.js";

const props = defineProps({
  usuario: { type: Object, required: true },
  enviar: { type: Function, required: true },
  archivo: { type: Function, required: true },
  cerrar: { type: Function, required: true },
  typing: { type: Function, required: true },
});

const emit = defineEmits(["close"]);

const mensajeInput = ref("");
const historialRef = ref(null);
const typingTimeout = ref(null);
const isTyping = ref(false);
const subiendo = ref(false);

// Obtener el historial de chat privado para este usuario
const historialPrivado = computed(() => {
  return state.chatsPrivadosHistorial?.[props.usuario.uid] || [];
});

function obtenerImagenMensaje(uid) {
  if (uid === state.usuarioActual.uid){
    return state.usuarioActual.imagen;
  }
   return state.usuarios.find((u) => u.uid === uid)?.imagen || "";
}

// Auto-scroll al final cuando hay nuevos mensajes
watch(historialPrivado, () => {
  setTimeout(() => {
    if (historialRef.value) {
      historialRef.value.scrollTop = historialRef.value.scrollHeight;
    }
  }, 0);
});

function enviarLocal() {
  if (!mensajeInput.value.trim()) return;
  props.enviar({ destinatarioUid: props.usuario.uid, texto: mensajeInput.value });
  mensajeInput.value = "";
  emitirTyping(false);
}

function manejarInput() {
  console.log("maneajando");
  if (mensajeInput.value.trim()) {
    emitirTyping(true);
  } else {
    emitirTyping(false);
  }
}

function emitirTyping(activo) {
  if (activo !== isTyping.value) {
    isTyping.value = activo;
    props.typing(activo);
  }

  if (typingTimeout.value) clearTimeout(typingTimeout.value);
  if (activo) {
    typingTimeout.value = setTimeout(() => {
      emitirTyping(false);
    }, 3000);
  }
}

function cerrarChat() {
  props.cerrar();
  emit("close");
}

async function archivoLocal(event) {
  const f = event.target.files?.[0];
  if (!f) 
    return;
  try {
    await props.archivo(f, { destinatarioUid: props.usuario.uid });
  } catch (err) {
    console.error(err);
  } finally {
    event.target.value = null;
  }
}

onMounted(() => {
  socket.emit("chat-privado-abierto", {
    destinatarioUid: props.usuario.uid,
  });
});
</script>

<template>
  <div class="chat-privado-container">
    <header class="chat-privado-header">
      <div class="header-info">
        <div class="avatar-small">
          <img :src="usuario.imagen" :alt="usuario.nombre" />
        </div>
        <div>
          <h2>{{ usuario.nombre }}</h2>
          <p class="estado">{{ usuario.estado || "En línea" }}</p>
        </div>
      </div>
      <button class="close-button" @click="cerrarChat">✕</button>
    </header>

    <div ref="historialRef" class="chat-privado-historial">
      <div v-for="(msg, i) in historialPrivado" :key="i" class="message-row" :class="{ 'message-own': msg.remitente_uid === state.usuarioActual.uid }">
        <div class="avatar-mini">
          <img :src="obtenerImagenMensaje(msg.remitente_uid)" :alt="msg.remitente" />
        </div>
        <div v-if="msg.file" class="file-message" :class="{ 'msg-propio': msg.remitente_uid === state.usuarioActual.uid }">
              <div v-if="msg.file.type && msg.file.type.startsWith('image/')">
                <img :src="msg.file.url" alt="imagen" class="attached-image" />
                <a :href="msg.file.url" :download="msg.file.name" class="download-link">Descargar</a>
              </div>
              <div v-else>
                <a :href="msg.file.url" :download="msg.file.name" class="download-link">Descargar archivo: {{ msg.file.name }}</a>
              </div>
              <div class="file-meta">{{ Math.round((msg.file.size||0)/1024) }} KB</div>
        </div>
        <p v-else class="mensaje-privado" :class="{ 'msg-propio': msg.remitente_uid === state.usuarioActual.uid }">
          <span class="msg-autor">{{ msg.remitente }}</span>
          <span class="msg-texto">{{ msg.texto }}</span>
          <span class="msg-timestamp">{{ msg.timestamp }}</span>
        </p>
      </div>
      <div v-if="historialPrivado.length === 0" class="empty-chat">
        <p>Inicia una conversación con {{ usuario.nombre }}</p>
      </div>
    </div>

    <div class="chat-privado-input">
      <textarea
        v-model="mensajeInput"
        placeholder="Escribe un mensaje privado..."
        @keyup.enter="enviarLocal"
        @keydown="manejarInput"
        class="input-area"
      ></textarea>

      <label class="file-upload" :class="{ uploading: subiendo }">
        <input type="file" @change="archivoLocal" :disabled="subiendo" />
        <div v-if="subiendo" class="uploading-text">
            <i class="fa-solid fa-hourglass"></i>
        </div>
        <div v-else class="upload-btn">
            <i class="fa-solid fa-arrow-up-from-bracket"></i>       
        </div>
      </label>


      <button @click="enviarLocal" class="send-button">Enviar</button>
    </div>
  </div>
</template>

<style scoped>
.chat-privado-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.chat-privado-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar-small {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.header-info h2 {
  margin: 0;
  font-size: 1rem;
  color: #e9f0f4;
}

.estado {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(233, 240, 244, 0.6);
}

.close-button {
  border: 0;
  background: none;
  color: #e9f0f4;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 150ms ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.chat-privado-historial {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 0.65rem;
}

.message-row.message-own {
  flex-direction: row-reverse;
}

.avatar-mini {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
}

.avatar-mini img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mensaje-privado {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: rgba(126, 190, 167, 0.15);
  color: #e9f0f4;
  max-width: 80%;
  word-wrap: break-word;
}

.mensaje-privado.msg-propio {
  align-self: flex-end;
  background: rgba(37, 211, 102, 0.2);
  color: #25d366;
}


.file-message {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: rgba(126, 190, 167, 0.15);
  color: #e9f0f4;
  max-width: 80%;
  word-wrap: break-word;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.file-message.msg-propio {
  align-self: flex-end;
  background: rgba(37, 211, 102, 0.2);
  color: #25d366;
}
.file-message .attached-image {
  display: block;
  width: 100%;
  max-width: 260px;
  max-height: 220px;
  height: auto;
  object-fit: cover;
  border-radius: 12px;
}

.file-message .download-link {
  color: #dbeefd;
  text-decoration: underline;
  word-break: break-word;
}

.file-message .file-meta {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.msg-autor {
  font-weight: 600;
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.msg-texto {
  display: block;
  line-height: 1.4;
}

.msg-timestamp {
  display: block;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.25rem;
}

.empty-chat {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(233, 240, 244, 0.4);
}

.empty-chat p {
  margin: 0;
}

.chat-privado-input {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.8rem;
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.input-area {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 0.75rem;
  background: rgba(8, 15, 20, 0.78);
  color: #f6fafb;
  font-family: inherit;
  resize: none;
  min-height: 3rem;
  max-height: 6rem;
}

.input-area::placeholder {
  color: rgba(246, 250, 251, 0.48);
}

.send-button {
  border: 0;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  background: #128c7e;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  transition: background 150ms ease;
  align-self: flex-end;
}

.send-button:hover {
  background: #0d6655;
}

.file-upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  overflow: hidden;
}

.file-upload input {
  display: none;
}

.file-upload .upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.file-upload.uploading {
  background: rgba(18, 140, 126, 0.12);
}

.file-upload .uploading-text {
  font-size: 0.8rem;
  color: #dbeefd;
  padding: 0 0.4rem;
}

.chat-privado-historial::-webkit-scrollbar {
  width: 6px;
}

.chat-privado-historial::-webkit-scrollbar-track {
  background: transparent;
}

.chat-privado-historial::-webkit-scrollbar-thumb {
  background: rgba(126, 190, 167, 0.4);
  border-radius: 3px;
}

.chat-privado-historial::-webkit-scrollbar-thumb:hover {
  background: rgba(126, 190, 167, 0.6);
}
</style>
