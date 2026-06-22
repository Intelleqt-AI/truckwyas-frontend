import { toast as toastify, Id } from 'react-toastify';

export const toast = {
  success: (message: string): Id => toastify.success(message),
  error:   (message: string): Id => toastify.error(message),
  info:    (message: string): Id => toastify.info(message),
  warning: (message: string): Id => toastify.warning(message),
};
