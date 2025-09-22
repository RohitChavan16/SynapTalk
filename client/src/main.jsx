import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import {ChatProvider} from "../context/ChatContext.jsx"
import { CallProvider } from '../context/CallContext.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ChatProvider>
        <CallProvider>
     <App />
     </CallProvider>
     </ChatProvider>
    </AuthProvider>
  </BrowserRouter>,
)
