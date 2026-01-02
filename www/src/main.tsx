import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import App from './App.tsx'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import 'leaflet/dist/leaflet.css'
import './index.css'

// Initialize i18n
import './i18n'

const theme = createTheme({
  primaryColor: 'orange',
  colors: {
    dark: [
      '#C9C9C9',
      '#b8b8b8',
      '#828282',
      '#696969',
      '#424242',
      '#3b3b3b',
      '#2e2e2e',
      '#1d1d1d',
      '#141414',
      '#0a0a0a',
    ],
  },
  fontFamily: '"JetBrains Mono", "Fira Code", Monaco, Consolas, monospace',
  headings: {
    fontFamily: '"Space Grotesk", "Outfit", sans-serif',
    fontWeight: '700',
  },
  defaultRadius: 'md',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </StrictMode>,
)
