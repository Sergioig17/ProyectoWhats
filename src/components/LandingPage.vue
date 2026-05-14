<script setup>
/*
    Componente: LandingPage.vue
    - Recibe: no requiere props; utiliza `supabase` para autenticación/registro si aplica.
    - Hace: pagina de entrada / login; redirige a `/chat` cuando el usuario inicia sesión.
    - Emite/Acciones: puede emitir eventos de navegación; no interactúa directamente con sockets.
*/
import { ref } from "vue";
import { socket, state } from "../socket.js";
import { defineEmits } from "vue";
import { useRouter } from "vue-router";
import {
    OAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    getAuth,
    signInWithPopup,
    GoogleAuthProvider
} from "firebase/auth";
import icono1 from "../assets/Icono1.jpg";
import icono2 from "../assets/Icono2.jpg";
import icono3 from "../assets/Icono3.jpg";
import icono4 from "../assets/Icono4.jpg";
import checkIcon from "../assets/Check.svg";
import { supabase } from "../supabase.js";

const emit = defineEmits(["nombre"]);
const router = useRouter();
const auth = getAuth();

// Lista de avatares predefinidos + opción de subida personalizada
const avatares = [
    { nombre: "Icono 1", ruta: icono1,  isPersonalizado: false },
    { nombre: "Icono 2", ruta: icono2,  isPersonalizado: false },
    { nombre: "Icono 3", ruta: icono3,  isPersonalizado: false },
    { nombre: "Icono 4", ruta: icono4,  isPersonalizado: false },
    { nombre: "Icono Personalizado", ruta: "personalizado", isPersonalizado: true }
];

// Estado del formulario: campos de texto, foto seleccionada y errores
const entrada = ref({
    nombre: '',
    email: '',
    password: '',
    confirmar: '',
    foto: icono1,
    errores: []
});

// Archivo de imagen que el usuario sube manualmente (File object)
const archivoPersonalizado = ref(null);

// Flag para deshabilitar inputs mientras se sube un archivo
const subiendo = ref(false);

/**
 * Maneja la selección de un archivo de imagen personalizado.
 * Valida que sea JPG o PNG y lo almacena en archivoPersonalizado.
 */
function manejarArchivoPersonalizado(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const tiposPermitidos = ['image/jpeg', 'image/png'];
    if (!tiposPermitidos.includes(archivo.type)) {
        entrada.value.errores = [];
        entrada.value.errores.push({
            codigo: "ARCHIVO_INVALIDO",
            message: "Solo se aceptan archivos JPG o PNG"
        });
        return;
    }

    archivoPersonalizado.value = archivo;
    entrada.value.foto = "personalizado";
    entrada.value.errores = [];
}

/**
 * Sube una imagen al bucket "Perfiles" de Supabase Storage.
 * Puede subir un archivo local (archivoPersonalizado) o descargar
 * y re-subir una foto externa (photoURL) para evitar problemas de CORS/caché.
 */
async function subirArchivoSupabase(idUsuario, ) {
    subiendo.value = true;
    try {
        const nombreArchivo = idUsuario + '_perfil';
        
        // Determinar qué subir: archivo local o URL externa
        let archivoASubir = archivoPersonalizado.value;

        // Borrar el archivo anterior si existe (evita conflictos de nombre)
        await supabase.storage.from('Perfiles').remove([nombreArchivo]);

        const { error } = await supabase.storage
            .from('Perfiles')
            .upload(nombreArchivo, archivoASubir);

        if (error) {
            entrada.value.errores.push({
                codigo: "UPLOAD_ERROR",
                message: `Error al subir archivo: ${error.message}`
            });
            subiendo.value = false;
            return false;
        }

        // Obtener URL pública con cache-buster para evitar que el navegador
        // muestre la imagen anterior cacheada
        const { data: publicUrlData } = supabase.storage
            .from('Perfiles')
            .getPublicUrl(nombreArchivo);

        subiendo.value = false;
        return publicUrlData.publicUrl + "?t=" + Date.now();

    } catch (err) {
        entrada.value.errores.push({
            codigo: "UPLOAD_EXCEPTION",
            message: `Error al procesar archivo: ${err.message}`
        });
        subiendo.value = false;
        return false;
    }
}

/**
 * Registra un nuevo usuario con email y contraseña.
 * Si el usuario subió una imagen personalizada, la sube a Supabase antes de guardar.
 * Al finalizar, guarda el estado global, emite por socket y redirige al chat.
 */
async function registrarse() {
    entrada.value.errores = [];

    if (entrada.value.password !== entrada.value.confirmar) {
        entrada.value.errores.push({ codigo: "PASS_MISMATCH", message: "Las contraseñas no coinciden" });
        return;
    }
    if (!entrada.value.nombre.trim()) {
        entrada.value.errores.push({ codigo: "NAME_EMPTY", message: "El nombre de usuario no puede estar vacío" });
        return;
    }

    let fotoFinal = entrada.value.foto;

    try {
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            entrada.value.email,
            entrada.value.password
        );

        // Si hay archivo personalizado, subirlo y obtener URL
        if (archivoPersonalizado.value) {
            fotoFinal = await subirArchivoSupabase(userCredential.user.uid);
            if (fotoFinal === false) {
                await auth.signOut();
                return;
            }
        }

        // Guardar usuario en state global y localStorage
        state.usuarioActual = {
            nombre: entrada.value.nombre,
            estado: "Disponible",
            imagen: fotoFinal,
            uid: userCredential.user.uid,
        };
        localStorage.setItem("usuarioActual", JSON.stringify(state.usuarioActual));

        // Notificar al servidor vía socket
        socket.emit("loggeado", true);
        socket.emit("Usuario", state.usuarioActual);

        router.push('/chat');
    } catch (errorcreate) {
        entrada.value.errores.push({
            codigo: errorcreate.code,
            message: errorcreate.message
        });
    }
}

/**
 * Inicia sesión con email y contraseña.
 * Permite cambiar la foto de perfil en el momento del login si se selecciona una imagen.
 * Al finalizar, guarda el estado global, emite por socket y redirige al chat.
 */
async function login() {
    entrada.value.errores = [];

    if (!entrada.value.nombre.trim()) {
        entrada.value.errores.push({ codigo: "NAME_EMPTY", message: "El nombre de usuario no puede estar vacío" });
        return;
    }

    try {
        const signInCredential = await signInWithEmailAndPassword(
            auth,
            entrada.value.email,
            entrada.value.password
        );

        let fotoFinal = entrada.value.foto;

        // Si hay archivo personalizado, subirlo y obtener URL
        if (archivoPersonalizado.value) {
            fotoFinal = await subirArchivoSupabase(signInCredential.user.uid);
            if (fotoFinal === false) {
                await auth.signOut();
                return;
            }
        }

        // Guardar usuario en state global y localStorage
        state.usuarioActual = {
            nombre: entrada.value.nombre,
            estado: "Disponible",
            imagen: fotoFinal,
            uid: signInCredential.user.uid,
        };
        localStorage.setItem("usuarioActual", JSON.stringify(state.usuarioActual));

        // Notificar al servidor vía socket
        socket.emit("loggeado", true);
        socket.emit("Usuario", state.usuarioActual);

        router.push('/chat');
    } catch (errorsign) {
        entrada.value.errores.push({
            codigo: errorsign.code,
            message: errorsign.message
        });
    }
}

/**
 * Inicia sesión con un proveedor OAuth (Google o GitHub) mediante popup.
 * Prioridad de foto:
 *   1. Imagen personalizada subida manualmente
 *   2. Avatar predefinido seleccionado
 *   3. Foto del proveedor (re-subida a Supabase para evitar CORS/caché)
 *   4. Sin foto (string vacío)
 *
 * @param {string} tipoProvider - "google" o "github"
 */
async function logAuth(tipoProvider) {
    let provider;
    switch (tipoProvider) {
        case "google": provider = new GoogleAuthProvider(); break;
        case "github": provider = new OAuthProvider("github.com"); break;
        default: return;
    }

    
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        let fotoFinal = entrada.value.foto;

        if (entrada.value.foto === "personalizado" && archivoPersonalizado.value) {
            // El usuario subió una imagen propia
            fotoFinal = await subirArchivoSupabase(user.uid) || "";
        } 

        // Guardar usuario en state global y localStorage
        state.usuarioActual = {
            nombre: user.displayName || "Usuario",
            estado: "Disponible",
            imagen: fotoFinal,
            uid: user.uid,
        };
        localStorage.setItem("usuarioActual", JSON.stringify(state.usuarioActual));

        // Notificar al servidor vía socket
        socket.emit("loggeado", true);
        socket.emit("Usuario", state.usuarioActual);

        router.push('/chat');
    } catch (err) {
        entrada.value.errores.push({
            codigo: "AUTH_FAILED",
            message: "Error al iniciar sesión"
        });
    }
}
</script>
<template>
    <div class="login-overlay">
        <div class="login-card">
            <div v-if="entrada.errores.length > 0" class="errores-container">
                <p v-for="error in entrada.errores" :key="error.codigo" class="error-message">
                    {{ error.message }}
                </p>
            </div>

            <div class="login-form">
                <input v-model="entrada.nombre" type="text" placeholder="Nombre de usuario" />
                <input v-model="entrada.email" type="email" placeholder="Correo electrónico" />
                <input v-model="entrada.password" type="password" placeholder="Contraseña" @keyup.enter="login" />
                <input v-model="entrada.confirmar" type="password" placeholder="Confirmar contraseña" @keyup.enter="registrarse" />

                <div class="avatar-grid">
                    <button
                        v-for="avatar in avatares.filter(a => !a.isPersonalizado)"
                        :key="avatar.ruta"
                        type="button"
                        class="avatar-option"
                        :class="{ selected: entrada.foto === avatar.ruta }"
                        @click="entrada.foto = avatar.ruta"
                        aria-pressed="false"
                    >
                        <img :src="avatar.ruta" :alt="avatar.nombre" />
                        <span class="avatar-check" aria-hidden="true">{{ entrada.foto === avatar.ruta ? '✓' : '' }}</span>
                    </button>

                    <label
                        v-for="avatar in avatares.filter(a => a.isPersonalizado)"
                        :key="avatar.ruta"
                        class="avatar-option avatar-file-upload"
                        :class="{ selected: entrada.foto === avatar.ruta }"
                    >
                        <input
                            type="file"
                            accept="image/jpeg,image/png"
                            @change="manejarArchivoPersonalizado"
                            style="display: none;"
                            :disabled="subiendo"
                        />
                        <div v-if="archivoPersonalizado" class="file-check">
                            <img :src="checkIcon" alt="Archivo seleccionado" />
                        </div>
                        <div v-else class="file-placeholder" :class="{ selected: entrada.foto === avatar.ruta }">
                            <i class="fa-solid fa-arrow-up-from-bracket"></i>
                        </div>
                        <span class="avatar-check" aria-hidden="true">{{ entrada.foto === avatar.ruta ? '✓' : '' }}</span>
                        <span v-if="subiendo" class="uploading-text">Subiendo...</span>
                    </label>
                </div>

                <div class="form-actions">
                    <button type="button" value="Login" @click="login">Login</button>
                    <button type="button" value="Registrarse" @click="registrarse">Registrarse</button>
                </div>
                <div class="form-logauth">
                    <p>O inicia sesión con:</p>
                    <button @click="logAuth('google')" class="google-btn">
                        <i class="fa-brands fa-google"></i> Google
                    </button>
                    <button @click="logAuth('github')" class="github-btn">
                        <i class="fa-brands fa-github"></i> GitHub
                    </button>   
                </div>
            </div>

            <!-- Explicación movida aquí, dentro de la card -->
            <div class="ExplicacionLogin">
                <h2>Bienvenido a ProyectoWhats</h2>
                <span class="Advertencia">DEBE ELEGIR IMAGEN. SI INICIA SESIÓN CON GOOGLE NO HACE FALTA A NO SER QUE QUIERA CAMBIAR LA FOTO DE PERFIL DE SU GMAIL</span>
            </div>
        </div>
    </div>
</template>


<style scoped>
.avatar-grid {
    width: min(100%, 28rem);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
    margin: 0.5rem 0 0.25rem;
}

.avatar-option {
    flex: 0 0 calc(20% - 0.75rem);
    min-width: 60px;
    max-width: 90px;
    border: 0;
    padding: 0.55rem 0.4rem 0.45rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    cursor: pointer;
    transition: transform 150ms ease, background-color 150ms ease, box-shadow 150ms ease;
}

.avatar-option:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.12);
}

.avatar-option.selected {
    background: rgba(18, 140, 126, 0.22);
    box-shadow: inset 0 0 0 2px rgba(37, 211, 102, 0.55);
}

.avatar-option img {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 14px;
    object-fit: cover;
    display: block;
}

.avatar-check {
    min-height: 1rem;
    font-size: 1rem;
    line-height: 1;
    font-weight: 800;
    color: #25d366;
}

@media (max-width: 720px) {
    .avatar-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

/* Landing page layout corrections */
.login-card{width:100%;max-width:560px;padding:1.15rem;border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01));box-shadow:0 10px 30px rgba(2,6,23,0.45);display:flex;flex-direction:column;gap:0.75rem}
.login-form{display:flex;flex-direction:column;gap:0.6rem;width:100%}
.login-form input{width:100%}
.form-actions{display:flex;justify-content:center;margin-top:0.6rem}
.ExplicacionLogin {
    width: 100%;
    padding: 0.75rem 0 0.25rem;
    text-align: center;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.ExplicacionLogin h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
}

.ExplicacionLogin p {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    color: rgba(237, 244, 247, 0.6);
    line-height: 1.5;
}

.Advertencia {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.78rem;
    color: #ff4336;
    font-weight: 600;
    line-height: 1.4;
}

.errores-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: rgba(255, 67, 54, 0.1);
    border: 1px solid rgba(255, 67, 54, 0.3);
    border-radius: 8px;
    margin-bottom: 0.5rem;
}

.error-message {
    margin: 0;
    color: #ff4336;
    font-size: 0.9rem;
    line-height: 1.4;
}

.avatar-file-upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    position: relative;
    cursor: pointer;
}

.avatar-file-upload:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.12);
}

.file-preview {
    width: 100%;
    height: 100%;
    border-radius: 14px;
    overflow: hidden;
}

.file-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.file-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1 / 1;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.1);
    font-size: 2rem;
}

.file-check {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1 / 1;
    border-radius: 14px;
    background: rgba(37, 211, 102, 0.2);
}

.file-check img {
    width: 60%;
    height: 60%;
    object-fit: contain;
}

.uploading-text {
    position: absolute;
    bottom: 0.5rem;
    font-size: 0.7rem;
    color: #25d366;
    font-weight: 600;
}

.avatar-grid{grid-template-columns:repeat(4, minmax(0, 1fr));}

@media (max-width:480px){
  .avatar-grid{grid-template-columns:repeat(2, minmax(0,1fr));}
}
</style>