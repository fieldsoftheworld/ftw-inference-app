<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
  <v-notifier-container />
</template>

<style>
#notifier > div {
  position: absolute;
  width: 400px !important;
}
</style>
