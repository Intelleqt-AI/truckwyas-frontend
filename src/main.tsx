import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const VITE_API = import.meta.env.VITE_API_URL;

async function boot() {
  // Always get a fresh token before rendering anything
  try {
    const res = await fetch(`${VITE_API}api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const data = await res.json();
    if (data?.token) localStorage.setItem('access', data.token);
  } catch {
    // Backend down — render anyway, pages show their own errors
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

boot();
