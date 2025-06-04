import './assets/main.css'
import 'ol/ol.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

console.log('Environment variables:', {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
})

app.mount('#app')
