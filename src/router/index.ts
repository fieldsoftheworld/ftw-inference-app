import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'map',
      component: () => import('../views/MapView.vue'),
    },
    {
      path: '/maplibre',
      name: 'maplibre',
      component: () => import('../views/MapLibreGlobalView.vue'),
    },
  ],
})

export default router
