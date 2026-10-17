import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// 1. Importamos el RatesProvider desde tu carpeta context
import { RatesProvider } from './context/RatesContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 2. Envolvemos la app con el proveedor de tasas */}
    <RatesProvider>
      <App />
    </RatesProvider>
  </StrictMode>,
)