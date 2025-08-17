import './assets/main.css'
import 'ol/ol.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify.ts'

const app = createApp(App)

app.use(router)
app.use(vuetify)

app.mount('#app')
