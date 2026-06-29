import { ToastContainer } from 'react-toastify';

export function Toaster() {
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
      theme="dark"
    />
  );
}
