import './styles/base.css'

import { createApp } from 'vue'
import App from './App.vue'
import { captureSetup } from './onboarding'

captureSetup(window.location, window.history, window.sessionStorage)

createApp(App).mount('#app')
