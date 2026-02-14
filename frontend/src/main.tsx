import './i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" toastOptions={{
        className: '!bg-white dark:!bg-slate-800 !text-slate-900 dark:!text-slate-100 !shadow-lg',
        duration: 3000,
      }} />
    </BrowserRouter>
  </React.StrictMode>,
)
