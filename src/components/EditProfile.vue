<script setup>
/*
	Componente: EditProfile.vue
	- Recibe: usa `state.usuarioActual` para mostrar/editar nombre e imagen.
	- Hace: permite seleccionar avatar o subir imagen a Supabase (bucket `Perfiles`),
		actualiza `state.usuarioActual`, guarda en localStorage y notifica al servidor con `Usuario`.
	- Emite/Acciones: llama a `socket.emit('Usuario', actualizado)` para propagar cambios.
*/
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { socket, state } from "../socket.js";
import { supabase } from "../supabase.js";
import icono1 from "../assets/Icono1.jpg";
import icono2 from "../assets/Icono2.jpg";
import icono3 from "../assets/Icono3.jpg";
import icono4 from "../assets/Icono4.jpg";
import checkIcon from "../assets/Check.svg";

const router = useRouter();

const avatares = [icono1, icono2, icono3, icono4];

const form = ref({
	nombre: state.usuarioActual?.nombre || "",
	foto: state.usuarioActual?.imagen || icono1,
});

const archivoPersonalizado = ref(null);
const previewPersonalizado = ref("");
const errores = ref([]);
const guardando = ref(false);

const imagenMostrada = computed(() => {
	if (previewPersonalizado.value) return previewPersonalizado.value;
	return form.value.foto;
});

function manejarArchivoPersonalizado(event) {
	errores.value = [];
	const archivo = event.target.files?.[0];
	if (!archivo) return;

	const tiposPermitidos = ["image/jpeg", "image/png"];
	if (!tiposPermitidos.includes(archivo.type)) {
		errores.value.push("Solo se aceptan archivos JPG o PNG.");
		return;
	}

	archivoPersonalizado.value = archivo;
	previewPersonalizado.value = URL.createObjectURL(archivo);
}

async function subirArchivoSupabase(uid) {
    const nombreArchivo = uid + "_perfil";

    // Intentar borrar primero (si no existe no pasa nada)
    await supabase.storage.from("Perfiles").remove([nombreArchivo]);

    const { data, error } = await supabase.storage
        .from("Perfiles")
        .upload(nombreArchivo, archivoPersonalizado.value);

    if (error) {
        throw new Error(error.message);
    }

    const { data: urlData } = supabase.storage.from("Perfiles").getPublicUrl(nombreArchivo);
    return urlData.publicUrl + "?t=" + Date.now();
}


async function guardarCambios() {
	errores.value = [];
	const nombreLimpio = (form.value.nombre || "").trim();

	if (!nombreLimpio) {
		errores.value.push("El nombre no puede estar vacio.");
		return;
	}

	const uid = state.usuarioActual?.uid;
	if (!uid) {
		errores.value.push("No hay usuario autenticado.");
		return;
	}

	guardando.value = true;
	try {
		let fotoFinal = form.value.foto;
		if (archivoPersonalizado.value) {
			fotoFinal = await subirArchivoSupabase(uid);
		}

		const actualizado = {
			...state.usuarioActual,
			nombre: nombreLimpio,
			imagen: fotoFinal,
		};

		state.usuarioActual = actualizado;
		localStorage.setItem("usuarioActual", JSON.stringify(actualizado));
		socket.emit("Usuario", actualizado);

		router.push("/chat");
	} catch (err) {
		errores.value.push("No se pudo guardar el perfil: " + err.message);
	} finally {
		guardando.value = false;
	}
}

function cancelar() {
	router.push("/chat");
}
</script>

<template>
	<div class="edit-shell">
		<section class="edit-card">
			<header class="edit-header">
				<p class="kicker">Perfil</p>
				<h1>Editar perfil</h1>
			</header>

			<div v-if="errores.length" class="errores">
				<p v-for="(error, i) in errores" :key="i">{{ error }}</p>
			</div>

			<div class="preview-box">
				<img :src="imagenMostrada" alt="Avatar actual" />
			</div>

			<label class="field-label" for="nombre">Nombre</label>
			<input id="nombre" v-model="form.nombre" type="text" placeholder="Tu nombre" />

            <div class="avatar-grid">
                <!-- Avatares predefinidos -->
                <button
                    v-for="avatar in avatares"
                    :key="avatar"
                    type="button"
                    class="avatar-option"
                    :class="{ selected: !archivoPersonalizado && form.foto === avatar }"
                    @click="form.foto = avatar; archivoPersonalizado = null; previewPersonalizado = ''"
                >
                    <img :src="avatar" alt="Avatar" />
                    <span class="avatar-check" aria-hidden="true">
                        {{ !archivoPersonalizado && form.foto === avatar ? '✓' : '' }}
                    </span>
                </button>

                <!-- Botón de subida personalizada -->
                <label
                    class="avatar-option avatar-file-upload"
                    :class="{ selected: !!archivoPersonalizado }"
                >
                    <input
                        type="file"
                        accept="image/jpeg,image/png"
                        @change="manejarArchivoPersonalizado"
                        style="display: none;"
                        :disabled="guardando"
                    />
                    <div v-if="archivoPersonalizado" class="file-check">
                        <img :src="checkIcon" alt="Archivo seleccionado" />
                    </div>
                    <div v-else class="file-placeholder">
                        <i class="fa-solid fa-arrow-up-from-bracket"></i>
                    </div>
                    <span class="avatar-check" aria-hidden="true">
                        {{ archivoPersonalizado ? '✓' : '' }}
                    </span>
                    <span v-if="guardando" class="uploading-text">
                        <i class="fa-solid fa-hourglass"></i>
                    </span>
                </label>
            </div>

			<div class="actions">
				<button type="button" class="btn-cancelar" @click="cancelar" :disabled="guardando">Cancelar</button>
				<button type="button" class="btn-guardar" @click="guardarCambios" :disabled="guardando">
					{{ guardando ? "Guardando..." : "Guardar" }}
				</button>
			</div>
		</section>
	</div>
</template>

<style scoped>
.edit-shell {
	min-height: 100vh;
	display: grid;
	place-items: center;
	padding: 1rem;
	background:
		radial-gradient(circle at top left, rgba(18, 140, 126, 0.14), transparent 32%),
		linear-gradient(180deg, #0a1117 0%, #101820 100%);
}

.edit-card {
	width: 100%;
	max-width: 560px;
	border-radius: 18px;
	padding: 1.2rem;
	background: rgba(255, 255, 255, 0.05);
	display: flex;
	flex-direction: column;
	gap: 0.8rem;
}

.edit-header h1,
.kicker {
	margin: 0;
}

.kicker {
	font-size: 0.75rem;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: #7ebea7;
}

.edit-header h1 {
	color: #edf4f7;
	font-size: 1.4rem;
}

.errores p {
	margin: 0;
	color: #ff8a8a;
	font-size: 0.9rem;
}

.preview-box {
	width: 90px;
	height: 90px;
	border-radius: 50%;
	overflow: hidden;
	margin: 0 auto 0.4rem;
	border: 2px solid rgba(255, 255, 255, 0.2);
}

.preview-box img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.field-label {
	margin: 0;
	color: rgba(233, 240, 244, 0.85);
	font-size: 0.9rem;
}

input[type="text"] {
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 12px;
	padding: 0.75rem 0.85rem;
	background: rgba(8, 15, 20, 0.78);
	color: #f6fafb;
}

.avatar-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 0.6rem;
}

.avatar-option {
	border: 0;
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.07);
	padding: 0.35rem;
	cursor: pointer;
}

.avatar-option.selected {
	box-shadow: inset 0 0 0 2px rgba(37, 211, 102, 0.6);
}

.avatar-option img {
	width: 100%;
	aspect-ratio: 1 / 1;
	border-radius: 10px;
	object-fit: cover;
}

.upload-label {
	display: inline-flex;
	align-items: center;
	gap: 0.6rem;
	color: rgba(233, 240, 244, 0.8);
	font-size: 0.88rem;
}

.upload-label input {
	color: rgba(233, 240, 244, 0.8);
}

.actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.6rem;
	margin-top: 0.4rem;
}

.actions button {
	border: 0;
	border-radius: 10px;
	padding: 0.65rem 1rem;
	font-weight: 700;
	cursor: pointer;
}

.btn-cancelar {
	background: rgba(255, 255, 255, 0.12);
	color: #edf4f7;
}

.btn-guardar {
	background: #25d366;
	color: #052b1a;
}
</style>
