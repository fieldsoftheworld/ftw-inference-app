import './assets/main.css'
import 'ol/ol.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import VuetifyNotifier from 'vuetify-notifier'

createApp(App)
  .use(router)
  .use(vuetify)
  .use(VuetifyNotifier, {
    toast: {
      location: 'bottom',
      timeout: 20000,
      max: 2,
      width: 500,
    },
  })
  .mount('#app')
