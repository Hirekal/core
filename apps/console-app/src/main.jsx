import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider, initTheme } from './context/ThemeContext.jsx';
import { JobProvider } from './context/JobContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import App from './App';
import './index.css';

initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <JobProvider>
              <App />
            </JobProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
