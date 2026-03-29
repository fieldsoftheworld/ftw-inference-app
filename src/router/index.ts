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
      path: '/benchmark',
      name: 'benchmark',
      component: () => import('../views/BenchmarkView.vue'),
    },
  ],
})

export default router
