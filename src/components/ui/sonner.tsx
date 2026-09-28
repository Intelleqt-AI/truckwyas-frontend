import { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';

/* Follow the app theme: toasts must not render dark surfaces in light mode.
   The active theme lives on <html data-theme="...">, toggled by OSLayout. */
function useDocumentTheme(): 'dark' | 'light' {
  const read = () =>
    (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
  const [theme, setTheme] = useState<'dark' | 'light'>(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function Toaster() {
  const theme = useDocumentTheme();
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={3500}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss={false}
      pauseOnHover
      draggable={false}
      theme={theme}
    />
  );
}
