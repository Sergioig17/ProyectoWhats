<script setup>
/*
	Componente: ChatActivo.vue
	- Props: `tipo` ('grupal'|'privado'), `sala` o `usuario` según el tipo.
	- Recibe: la información del chat activo y delega a `Sala.vue` o `ChatPrivado.vue`.
	- Hace: render condicional del componente correcto y reenvía eventos `close` al padre.
	- Emite/Acciones: re-emite `close-grupal` y `close-privado` cuando se cierran las vistas.
*/
import ChatPrivado from "./ChatPrivado.vue";
import Sala from "./Sala.vue";
import { socket, state } from "../socket.js";
import { supabase } from "../supabase.js";

const props = defineProps({
	tipo: { type: String, default: "" },
	usuario: { type: Object, default: null },
	sala: { type: Object, default: null },
});

const emit = defineEmits(["close-privado", "close-grupal"]);

// Función común para enviar mensajes (sala o privado)
function enviarComun(carga = {}) {
	try {
		const base = {
			remitente_uid: state.usuarioActual.uid,
			remitente: state.usuarioActual.nombre,
			timestamp: new Date().toLocaleTimeString(),
		};
		if (carga.roomId) {
			const messageData = { ...base, ...carga };
			socket.emit("mensaje-sala", messageData);
			// Optimistic update: agregar mensaje al historial local inmediatamente
			if (!state.salasHistorial[carga.roomId]) {
				state.salasHistorial[carga.roomId] = [];
			}
			state.salasHistorial[carga.roomId].push(messageData);
		} else if (carga.destinatarioUid) {
			const messageData = {
				destinatarioUid: carga.destinatarioUid,
				remitente_uid: base.remitente_uid,
				remitente: base.remitente,
				texto: carga.texto || "",
				timestamp: base.timestamp,
				file: carga.file || null,
			};
			socket.emit("mensaje-privado", messageData);
			// Optimistic update: agregar mensaje al historial privado local inmediatamente
			if (!state.chatsPrivadosHistorial[carga.destinatarioUid]) {
				state.chatsPrivadosHistorial[carga.destinatarioUid] = [];
			}
			state.chatsPrivadosHistorial[carga.destinatarioUid].push(messageData);
		}
	} catch (err) {
		console.error("enviarComun error:", err);
	}
}

// Función común para escribir: decide el evento según el chat activo.
function typingComun(activo, carga = {}) {
	const typing = !!activo;
	if (carga.destinatarioUid) {
		socket.emit("typing-privado", {
			destinatarioUid: carga.destinatarioUid,
			remitente: state.usuarioActual.nombre,
			typing,
		});
		return;
	}

	if (carga.roomId) {
		socket.emit("typing", {
			nombre: state.usuarioActual.nombre,
			typing,
		});
	}
}

function typingPrivado(activo) {
	typingComun(activo, { destinatarioUid: props.usuario?.uid });
}

function typingSala(activo) {
	typingComun(activo, { roomId: props.sala?.id });
}

// Subir archivo y emitir mensaje correspondiente
async function archivoComun(file, datos = {}) {
	if (!file) return;
	try {
		const uid = state.usuarioActual?.uid || "anon";
		const name = uid + "_" + Date.now() + "_" + file.name;
		const { error } = await supabase.storage.from("ArchivosSubidos").upload(name, file);
		if (error){
			console.log("Error subiendo archivo:", error.message || error);	
		};
		const { data: urlData } = supabase.storage.from("ArchivosSubidos").getPublicUrl(name);
		const publicUrl = urlData.publicUrl + "?t=" + Date.now();
		const fileObj = {
			url: publicUrl,
			name: file.name,
			type: file.type,
		};
		if (datos.roomId) {
			enviarComun({ roomId: datos.roomId, texto: "", file: fileObj });
		} else if (datos.destinatarioUid) {
			enviarComun({ destinatarioUid: datos.destinatarioUid, texto: "", file: fileObj });
		}
	} catch (err) {
		console.error("archivoComun error:", err.message || err);
	}
}

function cerrarPrivado() {
	emit("close-privado");
}

function cerrarGrupal() {
	emit("close-grupal");
}
</script>

<template>
	<div class="chat-activo-shell">
		<ChatPrivado
			v-if="tipo === 'privado' && usuario"
			:usuario="usuario"
			:enviar="enviarComun"
			:archivo="archivoComun"
			:cerrar="cerrarPrivado"
			:typing="typingPrivado"
			@close="emit('close-privado')"
		/>

		<Sala
			v-else-if="tipo === 'grupal' && sala"
			:room="sala"
			:enviar="enviarComun"
			:archivo="archivoComun"
			:cerrar="cerrarGrupal"
			:typing="typingSala"
			@close="emit('close-grupal')"
		/>

		<div v-else class="chat-activo-vacio">
			Selecciona un chat para comenzar.
		</div>
	</div>
</template>

<style scoped>
.chat-activo-shell {
	height: 100%;
	min-height: 0;
}

.chat-activo-vacio {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: rgba(233, 240, 244, 0.6);
	border-radius: 16px;
	background: rgba(255, 255, 255, 0.03);
}
</style>
