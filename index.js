import express from "express";
import { Server } from "socket.io";
import { createServer } from "node:http";

const app = express();
const port = 3000;
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

/*
  Archivo: index.js (servidor)
  - Recibe: conexiones socket desde el cliente y varios eventos: 'Usuario', 'crear-sala',
    'entrar-sala', 'salir-sala', 'mensaje-sala', 'mensaje-privado', 'typing', etc.
  - Hace: mantiene arrays `usuarios`, `salas` y `historial`; coordina join/leave de rooms,
    reenvía mensajes a las rooms o sockets objetivos y emite estados (`usuarios`, `salas`, `historial`).
  - Emite/Acciones: usa `io.emit` y `io.to(...).emit` para notificar a los clientes sobre cambios.
*/

var historial = [];
var usuarios = [];
const salas = {
  general: {
    id: "general",
    nombre: "General",
    descripcion: "Sala general",
    miembros: [],
    mensajes: [],
  },
};

function emitirEstadoUsuarios() {
  const publico = usuarios.map((u) => {
    return {
      uid: u.uid,
      nombre: u.nombre,
      estado: u.estado,
      imagen: u.imagen,
      socketId: u.socketId || [],
    };
  });
  io.emit("usuarios", publico);
  io.emit("cantidad", publico.length);
  // emitir lista de salas (info pública)
  const salasPublicas = Object.values(salas).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    miembros: s.miembros || [],
    mensajesCount: s.mensajes.length,
  }));
  io.emit("salas", salasPublicas);
}

io.on("connection", (socket) => {
  // Emitir estado actual al cliente que se acaba de conectar
  const publico = usuarios.map((u) => {
    return {
      uid: u.uid,
      nombre: u.nombre,
      estado: u.estado,
      imagen: u.imagen,
      socketId: u.socketId || [],
    };
  });
  socket.emit("usuarios", publico);
  socket.emit("cantidad", publico.length);
  socket.emit(
    "salas",
    Object.values(salas).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      descripcion: s.descripcion,
      miembros: s.miembros || [],
      mensajesCount: s.mensajes.length,
    }))
  );
  socket.emit("historial", historial); // Solo al nuevo cliente, no a todos

  /*
      Evento: 'Usuario'
      - Recibe: objeto `usuario` con { uid, nombre, estado, imagen }
      - Hace: registra o actualiza el usuario en el array `usuarios`, une el socket
        a la sala 'general' (si es nuevo), actualiza `salas.general.miembros`, y
        emite actualizaciones de estado (`usuarios`, `historial`, `salas`).
      - Emite: `usuarios`, `cantidad`, `historial`, `salas` según corresponda.
    */
  socket.on("Usuario", (usuario) => {
    console.log("usuario", usuario);
    const nombre = usuario.nombre;
    const estado = usuario.estado;
    const imagen = usuario.imagen;
    const uid = usuario.uid;

    // PRIMERO: Eliminar si ya existe un usuario con el mismo socketId
    const indexSocketDuplicado = usuarios.findIndex((u) =>
      (u.socketId || []).includes(socket.id)
    );
    if (indexSocketDuplicado !== -1) {
      const idsLimpios = (usuarios[indexSocketDuplicado].socketId || []).filter(
        (id) => id !== socket.id
      );
      if (idsLimpios.length === 0) {
        usuarios.splice(indexSocketDuplicado, 1);
      } else {
        usuarios[indexSocketDuplicado].socketId = idsLimpios;
      }
    }

    // SEGUNDO: Buscar si existe por ID
    const existenteIndex = usuarios.findIndex((u) => u.uid === uid);

    if (existenteIndex === -1) {
      // Nuevo usuario
      usuarios.push({
        socketId: [socket.id],
        uid,
        nombre,
        estado,
        imagen,
        rooms: ["general"],
      });
      // unir socket a la sala general
      socket.join("general");
      if (!salas.general.miembros.includes(uid))
        salas.general.miembros.push(uid);
      const avisoSala = {
        nombreUsuario: "Sistema",
        texto: `${nombre} se unió a la sala general.`,
        isSystem: true,
      };
      salas.general.mensajes.push(avisoSala);
      console.log(
        " Estado del array DESPUÉS del push:",
        usuarios.map((u) => u.nombre + u.uid)
      );

      const aviso = {
        nombreUsuario: "Sistema",
        texto: `${nombre} se unió al chat.`,
        isSystem: true,
      };
      historial.push(aviso);
      emitirEstadoUsuarios();
      io.emit("historial", historial);
      io.emit("salas", Object.values(salas));
      console.log(
        "Usuarios actuales:",
        usuarios.map((u) => u)
      );
    } else {
      // Usuario existente: actualizar datos
      const idsActuales = usuarios[existenteIndex].socketId || [];
      if (!idsActuales.includes(socket.id)) {
        idsActuales.push(socket.id);
      }
      usuarios[existenteIndex] = {
        ...usuarios[existenteIndex],
        socketId: idsActuales,
        uid,
        nombre,
        estado,
        imagen,
      };
      // asegurar que el socket se una a las salas que el usuario tenga en su registro
      const roomsToJoin = usuarios[existenteIndex].rooms || ["general"];
      roomsToJoin.forEach((r) => socket.join(r));
      console.log(
        " Estado del array DESPUÉS de actualizar:",
        usuarios.map((u) => u.nombre + u.uid)
      );
      emitirEstadoUsuarios();
    }
  });

  /*
    Evento: 'mensaje'
    - Recibe: `mensaje` (objeto con remitente y texto) para publicar en la sala general.
    - Hace: guarda en `salas.general.mensajes` y reemite como `mensaje-sala` a la room 'general'.
    - Emite: `mensaje-sala` a la room 'general'.
  */
  socket.on("mensaje", (mensaje) => {
    salas.general.mensajes.push(mensaje);
    io.to("general").emit("mensaje-sala", { roomId: "general", ...mensaje });
  });

  /*
    Evento: 'crear-sala'
    - Recibe: `room` con { id?, nombre, descripcion }
    - Hace: crea una nueva entrada en `salas` si no existe y emite la lista pública de salas.
    - Emite: `salas` con Object.values(salas).
  */
  socket.on("crear-sala", (room) => {
    const id =
      room.id ||
      (room.nombre && room.nombre.toLowerCase().replace(/\s+/g, "-")) ||
      `room-${Date.now()}`;
    if (!salas[id]) {
      salas[id] = {
        id,
        nombre: room.nombre || id,
        descripcion: room.descripcion || "",
        miembros: [],
        mensajes: [],
      };
    }
    io.emit("salas", Object.values(salas));
  });

  /*
    Evento: 'lista-salas'
    - Recibe: ninguna carga.
    - Hace: responde al socket que lo solicitó con la lista actual de `salas`.
    - Emite: `salas` sólo al socket solicitante.
  */
  socket.on("lista-salas", () => {
    socket.emit("salas", Object.values(salas));
  });

  /*
    Evento: 'entrar-sala'
    - Recibe: `data` con { roomId, uid }
    - Hace: añade el uid a `salas[roomId].miembros`, hace que el socket se una a la room,
      lleva un registro en `usuarios[].rooms` y emite un mensaje sistema a la sala.
    - Emite: `mensaje-sala` a la room y `salas` a todos los clientes.
  */
  socket.on("entrar-sala", (data) => {
    const roomId = data.roomId;
    const uid = data.uid;
    if (!salas[roomId]) return;
    socket.join(roomId);
    if (!salas[roomId].miembros.includes(uid)) salas[roomId].miembros.push(uid);
    // also track on usuario
    const uidx = usuarios.findIndex((u) => u.uid === uid);
    if (uidx !== -1) {
      usuarios[uidx].rooms = usuarios[uidx].rooms || [];
      if (!usuarios[uidx].rooms.includes(roomId))
        usuarios[uidx].rooms.push(roomId);
    }
    const aviso = {
      nombreUsuario: "Sistema",
      texto: usuarios[uidx].nombre + " entró en la sala",
      isSystem: true,
    };
    salas[roomId].mensajes.push(aviso);
    io.to(roomId).emit("mensaje-sala", { roomId, ...aviso });
    io.emit("salas", Object.values(salas));
  });

  /*
    Evento: 'salir-sala'
    - Recibe: `data` con { roomId, uid }
    - Hace: (no permite salir de 'general') quita el uid de `salas[roomId].miembros`,
      actualiza `usuarios[].rooms`, emite un mensaje sistema a la sala y si la sala
      queda vacía la elimina (excepto 'general').
    - Emite: `mensaje-sala` a la room y `salas` a todos los clientes.
  */
  socket.on("salir-sala", (data) => {
    const roomId = data.roomId;
    const uid = data.uid;
    if (!salas[roomId]) return;
    // No permitir salir de la sala general
    if (roomId === "general") return;

    socket.leave(roomId);
    salas[roomId].miembros = (salas[roomId].miembros || []).filter(
      (x) => x !== uid
    );
    const uidx = usuarios.findIndex((u) => u.uid === uid);
    if (uidx !== -1) {
      usuarios[uidx].rooms = (usuarios[uidx].rooms || []).filter(
        (r) => r !== roomId
      );
    }
    const aviso = {
      nombreUsuario: "Sistema",
      texto: usuarios[uidx].nombre + " salió de la sala",
      isSystem: true,
    };
    salas[roomId].mensajes.push(aviso);
    io.to(roomId).emit("mensaje-sala", { roomId, ...aviso });
    // Si la sala quedó vacía (y no es 'general'), eliminarla
    if ((salas[roomId].miembros || []).length === 0 && roomId !== "general") {
      delete salas[roomId];
    }
    io.emit("salas", Object.values(salas));
  });

  /*
    Evento: 'mensaje-sala'
    - Recibe: `data` con al menos { roomId, remitente_uid, remitente, texto, timestamp }
      y opcionalmente `file` con metadatos de archivo.
    - Hace: guarda el mensaje en `salas[roomId].mensajes` y reemite `mensaje-sala` a la room.
    - Emite: `mensaje-sala` a la room indicada.
  */
  socket.on("mensaje-sala", (data) => {
    const roomId = data.roomId;
    
    if (!salas[roomId]) return;

    salas[roomId].mensajes.push(data);
    io.to(roomId).emit("mensaje-sala", data);
  });

  /*
    Evento: 'mensaje-privado'
    - Recibe: `data` con { remitente_uid, destinatarioUid, remitente, texto, timestamp }
    - Hace: busca sockets asociados a remitente y destinatario y reenvía el evento
      `mensaje-privado` a todos los sockets relevantes (para soportar multi-tabs).
    - Emite: `mensaje-privado` a sockets específicos.
  */
  socket.on("mensaje-privado", (data) => {
    const destinatario = usuarios.find((u) => u.uid === data.destinatarioUid);
    const remitente = usuarios.find((u) => u.uid === data.remitente_uid);

    const socketsDestino = new Set([
      ...(destinatario?.socketId || []),
      ...(remitente?.socketId || []),
      socket.id,
    ]);

    socketsDestino.forEach((sid) => {
      io.to(sid).emit("mensaje-privado", data);
    });
  });

  /*
    Evento: 'typing'
    - Recibe: { nombre, typing }
    - Hace: broadcast de typing a todos los clientes (indica si alguien escribe).
    - Emite: `typing` a todos menos al socket que lo envió.
  */
  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", {
      nombre: data.nombre,
      typing: !!data.typing,
    });
  });

  /*
    Evento: 'typing-privado'
    - Recibe: { remitente, destinatarioUid, typing }
    - Hace: reenvía `typing-privado` únicamente a los sockets del destinatario.
    - Emite: `typing-privado` a sockets del destinatario.
  */
  socket.on("typing-privado", (data) => {
    const destinatario = usuarios.find((u) => u.uid === data.destinatarioUid);
    if (destinatario) {
      (destinatario.socketId || []).forEach((sid) => {
        io.to(sid).emit("typing-privado", {
          remitente: data.remitente,
          typing: !!data.typing,
        });
      });
    }
  });

  /*
    Evento: 'salir'
    - Recibe: ninguna carga; se usa cuando el cliente solicita cerrar sesión.
    - Hace: elimina el socketId del usuario; si ya no quedan sockets para ese uid,
      borra el usuario y actualiza `historial` y `salas` en consecuencia.
    - Emite: `historial`, `salas`, `usuarios` según corresponda.
  */
  socket.on("salir", () => {
    const uidx = usuarios.findIndex((u) =>
      (u.socketId || []).includes(socket.id)
    );
    if (uidx !== -1) {
      const nombre = usuarios[uidx].nombre || "Un usuario";
      const idsRestantes = (usuarios[uidx].socketId || []).filter(
        (id) => id !== socket.id
      );

      if (idsRestantes.length === 0) {
        const uidRemoved = usuarios[uidx].uid;
        usuarios.splice(uidx, 1);
        const aviso = {
          nombreUsuario: "Sistema",
          texto: `${nombre} ha salido del chat.`,
          isSystem: true,
        };
        historial.push(aviso);
        io.emit("historial", historial);
        // quitar de las salas donde estuviera
        Object.values(salas).forEach((s) => {
          s.miembros = (s.miembros || []).filter((m) => m !== uidRemoved);
        });
        io.emit("salas", Object.values(salas));
      } else {
        usuarios[uidx].socketId = idsRestantes;
      }

      emitirEstadoUsuarios();
    }
  });
  /*
    Evento: 'disconnect'
    - Recibe: (evento automático de socket.io cuando la conexión se corta)
    - Hace: similar a 'salir', elimina el socketId; si ya no quedan sockets del usuario,
      borra el usuario y notifica la salida en `historial`.
    - Emite: `historial`, `usuarios` según corresponda.
  */
  socket.on("disconnect", () => {
    const uidx = usuarios.findIndex((u) =>
      (u.socketId || []).includes(socket.id)
    );
    if (uidx !== -1) {
      const nombre = usuarios[uidx].nombre || "Un usuario";
      const idsRestantes = (usuarios[uidx].socketId || []).filter(
        (id) => id !== socket.id
      );

      if (idsRestantes.length === 0) {
        usuarios.splice(uidx, 1);
        const aviso = {
          nombreUsuario: "Sistema",
          texto: `${nombre} se desconectó.`,
          isSystem: true,
        };
        historial.push(aviso);
        io.emit("historial", historial);
      } else {
        usuarios[uidx].socketId = idsRestantes;
      }

      emitirEstadoUsuarios();
    }
  });
});

server.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
