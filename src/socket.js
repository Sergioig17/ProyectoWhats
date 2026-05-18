import { reactive } from "vue";
import { io } from "socket.io-client";

export const state = reactive({
  connected: false,
  historial: [],
  loggeado: false,
  cantidad: 0,
  usuarios: [],
  typing: {}, // { nombre: true/false }
  usuarioActual: {
    nombre: "",
    estado: "",
    imagen: "",
    uid: "",
  },
  salas: [], // lista pública de salas {id,nombre,descripcion,miembros,mensajesCount}
  salaActivaId: "", // roomId activo en UI
  salasHistorial: {}, // { roomId: [mensajes] }
  chatsPrivados: [], // Lista de usuarios con los que hay chat privado
  chatsPrivadosHistorial: {}, // { usuarioUid: [mensajes] }
  typingPrivado: {}, // { usuarioUid: true/false }
  unreadPrivados: {}, // { usuarioUid: number }
  chatPrivadoActivoUid: "",
});

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
export const socket = io(socketUrl);

/*
  Archivo: socket.js
  - Recibe: conexiones socket del servidor y actualiza `state` reactivo.
  - Hace: mantiene estado global de la app (usuarios, salas, historiales, mensajes privados).
  - Emite/Acciones: al conectarse emite `Usuario` con `state.usuarioActual` si existe en localStorage.
  - Observaciones: los listeners aquí actualizan `state` para que los componentes reaccionen automáticamente.
*/

socket.on("connect", () => {
  state.connected = true;
  const guardado = JSON.parse(localStorage.getItem("usuarioActual"));
  if (guardado?.uid) {
    state.usuarioActual = guardado;
    socket.emit("Usuario", state.usuarioActual);
  }
});
socket.on("disconnect", () => {
  state.connected = false;
});
// Flag para evitar que futuras emisiones de 'salas' re-seleccionen 'general'
let salasInitialized = false;
socket.on("historial", (h) => {
  state.historial = h;
});
socket.on("cantidad", (c) => {
  state.cantidad = c;
});
socket.on("usuarios", (u) => {
  state.usuarios = Array.isArray(u) ? u : [];
  state.cantidad = state.usuarios.length;
});
socket.on("salas", (s) => {
  state.salas = Array.isArray(s) ? s : [];
  // Auto-seleccionar 'general' solo la primera vez que llegan las salas.
  if (!salasInitialized) {
    if (!state.salaActivaId) {
      const general = state.salas.find((r) => r.id === "general");
      state.salaActivaId = general ? "general" : state.salas[0]?.id || "";
    }
    salasInitialized = true;
  }
});
socket.on("loggeado", (l) => {
  state.loggeado = l;
});
socket.on("typing", (data) => {
  if (data.typing) {
    state.typing[data.nombre] = true;
  } else {
    delete state.typing[data.nombre];
  }
});

socket.on("mensaje-sala", (data) => {
  const roomId = data.roomId || "general";
  // asegurar historial de sala
  if (!state.salasHistorial[roomId]) state.salasHistorial[roomId] = [];

  // Evitar duplicados: no agregar si el mensaje ya está en el historial
  var yaExiste = false;
  state.salasHistorial[roomId].forEach((mensaje) => {
    if (
      mensaje.timestamp === data.timestamp &&
      mensaje.remitente_uid === data.remitente_uid &&
      mensaje.texto === data.texto
    ) {
      yaExiste = true;
    }
  });
  if (!yaExiste) {
    state.salasHistorial[roomId].push(data);
  }
});

socket.on("mensaje-privado", (data) => {
  const remitenteUid = data.remitente_uid || "";
  const destinatarioUid = data.destinatarioUid || "";
  const usuarioUid =
    remitenteUid === state.usuarioActual.uid ? destinatarioUid : remitenteUid;

  const mensajeNormalizado = {
    ...data,
    remitente_uid: remitenteUid,
    destinatarioUid,
  };

  // Al llegar un privado, aseguramos que exista el chat en la columna izquierda al usuario, si no existe lo agregamos
  if (usuarioUid && !state.chatsPrivados.some((u) => u.uid === usuarioUid)) {
    const usuarioConectado = state.usuarios.find((u) => u.uid === usuarioUid);
    state.chatsPrivados.push(
      usuarioConectado || {
        uid: usuarioUid,
        nombre: data.remitente || "Usuario",
        estado: "",
        imagen: "",
      }
    );
  }

  // Inicializar historial si no existe
  if (!state.chatsPrivadosHistorial[usuarioUid]) {
    state.chatsPrivadosHistorial[usuarioUid] = [];
  }

  // Evitar duplicados: no agregar si el mensaje ya está en el historial
  const yaExiste = state.chatsPrivadosHistorial[usuarioUid].some(
    (msg) =>
      msg.timestamp === mensajeNormalizado.timestamp &&
      msg.remitente_uid === mensajeNormalizado.remitente_uid &&
      msg.texto === mensajeNormalizado.texto
  );

  if (!yaExiste) {
    state.chatsPrivadosHistorial[usuarioUid].push(mensajeNormalizado);
  }

  // Si el mensaje viene de otra persona y ese chat no esta abierto, sumar no leidos
  const esEntrante = remitenteUid && remitenteUid !== state.usuarioActual.uid;
  const chatAbierto = state.chatPrivadoActivoUid === usuarioUid;
  if (esEntrante && !chatAbierto) {
    state.unreadPrivados[usuarioUid] =
      (state.unreadPrivados[usuarioUid] || 0) + 1;
  }
});

socket.on("typing-privado", (data) => {
  if (data.typing) {
    state.typingPrivado[data.remitente] = true;
  } else {
    delete state.typingPrivado[data.remitente];
  }
});

/*
  Listeners (explicación rápida):
  - 'connect': al conectar el cliente, intenta restaurar `usuarioActual` desde localStorage
    y notifica al servidor emitiendo 'Usuario'.
  - 'historial': recibe array `historial` (mensajes de sistema) y lo guarda en `state.historial`.
  - 'cantidad': recibe número de usuarios conectados y lo guarda en `state.cantidad`.
  - 'usuarios': recibe lista pública de usuarios conectados (cada uno con {uid,nombre,estado,imagen,socketId}).
  - 'salas': recibe lista pública de salas; actualiza `state.salas` y, la primera vez, selecciona 'general'.
  - 'mensaje-sala': recibe un mensaje para una sala concreta; lo agrega a `state.salasHistorial[roomId]`.
  - 'mensaje-privado': recibe un mensaje privado y lo añade al historial privado correspondiente;
      actualiza `chatsPrivados` si hace falta y contabiliza no leídos.
  - 'typing' / 'typing-privado': actualizan indicadores de escritura locales.

  Estos comentarios ayudan a entender qué espera cada listener y cómo influyen en el `state`.
*/
