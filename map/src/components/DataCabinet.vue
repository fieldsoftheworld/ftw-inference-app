<script setup lang="ts">
// Component logic will go here
</script>

<template>
  <div class="data-cabinet">
    <div class="data-cabinet-content">
      <h1>FTW Inference</h1>
    </div>
  </div>
</template>

<style scoped>
.data-cabinet {
  position: absolute;
  top: 1%;
  right: 1%;
  width: 30vw;
  min-width: 18.75rem;
  height: 95vh;
  border-radius: 20%;
  background-color: rgba(0,0,0,0.8);
  box-shadow: -0.125rem 0 0.5rem rgba(255,255,255, 0.1);
  z-index: 1000;
  border-radius: 0.625rem;
  overflow: hidden;
}

.data-cabinet-content {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;

  h1 {
    color: #FFF;
    font-size: 1.25rem;
    text-decoration: underline;
    font-weight: bold;
    text-align: center;
    margin-bottom: 0.5rem;
  }
}
</style>
