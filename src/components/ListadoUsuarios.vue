<script setup>
/*
  Componente: ListadoUsuarios.vue
  - Recibe: usa `state` global desde `socket.js` para obtener `usuarioActual` y `usuarios`.
  - Hace: muestra el avatar y la lista de usuarios conectados (excepto el propio usuario).
  - Emite/Acciones: emite `select-usuario` cuando se selecciona un usuario para abrir chat privado;
    proporciona función `irAEditarPerfil()` que navega a la ruta de edición de perfil.
*/
import { computed } from "vue";
import { state } from "../socket.js";
import { useRouter } from "vue-router";

const router = useRouter();

const usuarios = computed(
  () => state.usuarios.length==1
    ? []
    : state.usuarios.filter((u) =>{
      return u.uid !== state.usuarioActual.uid
    } )
  );
  const emit = defineEmits(["select-usuario"]);
  
  function obtenerImagen(usuario) {
  const imagen = usuario.imagen.trim();
  return imagen || "";
}
function abrirChatPrivado(usuario) {
  emit("select-usuario", usuario);
}

function irAEditarPerfil() {
  router.push("/editar-perfil");
}
function cambiar_estado(){

}
</script>

<template>
  <section class="sidebar-card">
    <div class="sidrebar-user">
      <div class="avatar">
        <img :src="obtenerImagen(state.usuarioActual)" :alt="state.usuarioActual.nombre || 'Usuario'" />
      </div>
      <div class="user-meta">
        <strong>{{ state.usuarioActual.nombre || "Usuario" }}</strong>
        <span @click="cambiar_estado">{{ state.usuarioActual.estado || "En línea" }}</span>
        <button class="btn-editar" @click="irAEditarPerfil">Editar perfil</button>
      </div>
    </div>
    <div class="sidebar-header">
      <div>
        <p class="sidebar-kicker">Sala común</p>
        <h2>Personas conectadas</h2>
      </div>

      <span class="counter">{{ usuarios.length }}</span>
    </div>
    <ul class="user-list">
      <li v-for="usuario in usuarios" :key="usuario.uid" class="user-item" @click="abrirChatPrivado(usuario)">
        <div class="avatar">
          <img :src="obtenerImagen(usuario)" :alt="usuario.nombre || 'Usuario'" />
        </div>
        <div class="user-meta">
          <strong>{{ usuario.nombre || "Usuario" }}</strong>
          <span>{{ usuario.estado || "En línea" }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.sidebar-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  padding: 1.15rem;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, #0f1b22 0%, #111f28 100%);
  color: #e9f0f4;
}

.sidebar-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
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

.counter {
  min-width: 2.1rem;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  background: rgba(126, 190, 167, 0.16);
  color: #a9d9c7;
  text-align: center;
  font-size: 0.88rem;
  font-weight: 700;
}

.empty-state {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(233, 240, 244, 0.7);
}

.user-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  overflow-y: auto;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 0.8rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  transition: transform 160ms ease, background-color 160ms ease;
  cursor: pointer;
}

.user-item:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.07);
}

.avatar {
  width: 2.9rem;
  height: 2.9rem;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #128c7e 0%, #075e54 100%);
  color: #ffffff;
  font-weight: 800;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-meta strong,
.user-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-meta strong {
  font-size: 0.95rem;
  color: #f3f7f8;
}

.user-meta span {
  margin-top: 0.18rem;
  font-size: 0.82rem;
  color: rgba(233, 240, 244, 0.65);
}

/* Estilo del botón Editar perfil en la barra lateral */
.btn-editar {
  margin-top: 0.6rem;
  padding: 0.45rem 0.8rem;
  border-radius: 10px;
  background: rgba(255,255,255,0.08);
  color: #e9f0f4;
  border: 0;
  font-weight: 700;
  cursor: pointer;
  align-self: flex-start;
}
.btn-editar:hover {
  background: rgba(255,255,255,0.12);
}
</style>