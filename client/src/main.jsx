import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import {ChatProvider} from "../context/ChatContext.jsx"
import { CallProvider } from '../context/CallContext.jsx'

import { CryptoContextProvider } from '../context/CryptoContext.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <CryptoContextProvider>
        <ChatProvider>
          <CallProvider>
            <App />
          </CallProvider>
        </ChatProvider>
      </CryptoContextProvider>
    </AuthProvider>
  </BrowserRouter>,
)
