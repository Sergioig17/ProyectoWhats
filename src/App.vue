<script>
  import { socket, state } from "./socket.js";
</script>
<template>
  <RouterView />
</template>
<style>
.login-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
</style>