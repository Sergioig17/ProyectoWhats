<script setup>
/*
  Componente: Sala.vue
  - Props: `room` (objeto sala {id,nombre,descripcion,miembros,...}).
  - Recibe: usa `state` global para `usuarioActual` y `salasHistorial`.
  - Hace: muestra historial de la sala, permite enviar mensajes y subir archivos a Supabase;
    controla entrar/salir/cerrar vista.
  - Emite/Acciones: emite eventos socket `entrar-sala`, `salir-sala`, `mensaje-sala`.
*/
import { ref, watch, computed } from "vue";
import { socket, state } from "../socket.js";

const props = defineProps({
  room: { type: Object, required: true },
  enviar: { type: Function, required: true },
  archivo: { type: Function, required: true },
  cerrar: { type: Function, required: true },
  typing: { type: Function, required: true },
});
const emit = defineEmits(["close"]);
const mensaje = ref("");
const historialRef = ref(null);
const subiendo = ref(false);
const typingTimeout = ref(null);
const isTyping = ref(false);

// La sala se considera activa si el usuario ya figura como miembro.
const estaEnSala = computed(() => {
  return (props.room.miembros || []).includes(state.usuarioActual.uid);
});

function obtenerImagenMensaje(uid) {
  if (uid === state.usuarioActual.uid) {
    return state.usuarioActual.imagen;
  }
  return state.usuarios.find((u) => u.uid === uid)?.imagen || "";
}

// Mantiene el historial visible al final cuando llegan nuevos mensajes.
watch(
  () => state.salasHistorial[props.room.id]?.length,
  () => {
    setTimeout(() => {
      if (historialRef.value) {
        historialRef.value.scrollTop = historialRef.value.scrollHeight;
      }
    }, 0);
  }
);

function entrar() {
  socket.emit("entrar-sala", { roomId: props.room.id, uid: state.usuarioActual.uid });
  state.salaActivaId = props.room.id;
}

function salir() {
  socket.emit("salir-sala", { roomId: props.room.id, uid: state.usuarioActual.uid });
  if (state.salaActivaId === props.room.id) {
    state.salaActivaId = "";
    emit('close');
  }
}

function cerrar() {
  state.salaActivaId = "";
  emitirTyping(false);
  props.cerrar();
}

function enviarLocal() {
  if (!mensaje.value.trim()) return;
  // El envío real vive en ChatActivo; aquí solo se arma el historial.
  props.enviar({ roomId: props.room.id, texto: mensaje.value });
  mensaje.value = "";
  emitirTyping(false);
}

function manejarInput() {
  if (mensaje.value.trim()) {
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

async function archivoLocal(event) {
  const f = event.target.files?.[0];
  if (!f) return;
  try {
    subiendo.value = true;
    await props.archivo(f, { roomId: props.room.id });
  } catch (err) {
    console.error(err);
  }
  subiendo.value = false;
  event.target.value = null;
}
</script>

<template>
  <div class="sala-shell">
    <header class="sala-header">
      <div>
        <p class="sidebar-kicker">Sala</p>
        <h2>{{ room.nombre }}</h2>
        <p class="small">{{ room.descripcion }}</p>
      </div>
      <div class="sala-controls">
        <div class="sala-control-left"></div>
        <div class="sala-control-right">
          <button v-if="!estaEnSala" @click="entrar" class="btn-entrar">Entrar</button>
          <button v-else-if="estaEnSala && props.room.id !== 'general'" @click="salir" class="btn-salir">Salir</button>
          <button @click="cerrar" class="btn-cerrar">✕</button>
        </div>
      </div>
    </header>

    <div class="sala-history" ref="historialRef">
      <div v-for="(m, i) in state.salasHistorial[room.id] || []" :key="i" :class="{ 'message-system': m.isSystem, 'message-own': m.remitente_uid === state.usuarioActual.uid }" class="message-row">
        <div v-if="m.isSystem" class="system-text">{{ m.texto }}</div>
        <template v-else>
          <div class="avatar-mini">
            <img :src="obtenerImagenMensaje(m.remitente_uid)" :alt="m.remitente || m.nombreUsuario" />
          </div>
          <p class="mensaje-sala" :class="{ 'msg-propio': m.remitente_uid === state.usuarioActual.uid }">
            <strong>{{ m.remitente || m.nombreUsuario }}:</strong>
            <div v-if="m.file" class="file-message">
              <div v-if="m.file.type && m.file.type.startsWith('image/')">
                <img :src="m.file.url" alt="imagen" class="attached-image" />
                <a :href="m.file.url" :download="m.file.name" class="download-link">Descargar</a>
              </div>
              <div v-else>
                <a :href="m.file.url" :download="m.file.name" class="download-link">Descargar archivo: {{ m.file.name }}</a>
              </div>
              <div class="file-meta">{{ Math.round((m.file.size||0)/1024) }} KB</div>
            </div>
            <div v-if="m.texto" class="text-part">{{ m.texto }}</div>
          </p>
        </template>
      </div>
    </div>

    <div class="sala-composer">
      <input class="mensaje-input" v-model="mensaje" @keyup.enter="enviarLocal" @input="manejarInput" placeholder="Escribe en la sala..." />
      <button class="btn-enviar" @click="enviarLocal">Enviar</button>
      <label class="file-upload" :class="{ uploading: subiendo }">
        <input type="file" @change="archivoLocal" :disabled="subiendo" />
        <div v-if="subiendo" class="uploading-text">
            <i class="fa-solid fa-hourglass"></i>
        </div>
        <div v-else class="upload-btn">
            <i class="fa-solid fa-arrow-up-from-bracket"></i>       
        </div>
      </label>
    </div>
  </div>
</template>

<style scoped>
.sala-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 0.6rem;
}

.sala-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.05);
}

.sala-header > div {
    flex: 1;
}

.sala-header h2 {
    margin: 0;
}

.sala-header .sidebar-kicker {
    margin: 0 0 0.25rem;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #7ebea7;
}

.sala-header .small {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: rgba(237, 244, 247, 0.6);
}

.sala-controls {
    display: flex;
    align-items: center;
    width: 100%;
}

.sala-controls .sala-control-left {
    flex: 1;
}

.sala-control-right {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
}

.sala-controls button {
    border: 0;
    border-radius: 8px;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    font-weight: 600;
    transition: 0.15s;
}

.btn-entrar {
    background: #25d366;
    color: #000;
}

.btn-entrar:hover {
    opacity: 0.9;
}

.btn-salir {
    background: #e53935;
    color: #fff;
}

.btn-salir:hover {
    opacity: 0.9;
}

.btn-cerrar {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 1.2rem;
    padding: 0.4rem 0.6rem;
}

.btn-cerrar:hover {
    background: rgba(255, 255, 255, 0.15);
}

.sala-history {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0.8rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    display: flex;
    flex-direction: column;
}

.sala-history p {
    margin: 0 0 0.5rem 0;
    padding: 0.6rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
}

.message-system {
    color: #7ebea7;
    font-style: italic;
}

.sala-composer {
    display: flex;
    gap: 0.5rem;
    padding: 0.6rem;
    align-items: center;
}

.mensaje-input {
    flex: 1;
    padding: 0.8rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(8, 15, 20, 0.78);
    color: #f6fafb;
}

.mensaje-input::placeholder,
.sala-composer input::placeholder {
    color: rgba(246, 250, 251, 0.48);
}

.btn-enviar {
    border: 0;
    border-radius: 8px;
    padding: 0.5rem 0.85rem;
    background: #128c7e;
    color: #fff;
    font-weight: 700;
    cursor: pointer;
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

.attached-image {
    max-width: 320px;
    max-height: 240px;
    border-radius: 8px;
    display: block;
    margin-top: 0.5rem;
}

.download-link {
    display: inline-block;
    margin-top: 0.4rem;
    color: #dbeefd;
    text-decoration: underline;
}

.file-meta {
    font-size: 0.75rem;
    color: rgba(233, 240, 244, 0.6);
    margin-top: 0.2rem;
}

.message-row {
    margin-bottom: 0.6rem;
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

.mensaje-sala {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: rgba(126, 190, 167, 0.15);
  color: #e9f0f4;
  max-width: 80%;
  word-wrap: break-word;
}

.mensaje-sala.msg-propio {
  align-self: flex-end;
  background: rgba(37, 211, 102, 0.2);
  color: #25d366;
}

.mensaje-sala.msg-propio .file-meta,
.mensaje-sala.msg-propio .download-link {
  color: #25d366;
}

.system-text {
    color: #7ebea7;
    font-style: italic;
}

.text-part {
    margin-top: 0.25rem;
}
</style>
