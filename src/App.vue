<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style scoped></style>

<style>
/* Global styles to make vueitfy elements look more like the existing elements.
 * In case all UI elements are converted to Vuetify, this should probably be removed.
 */
.v-btn {
  text-transform: none;
  letter-spacing: normal;
}
</style>
