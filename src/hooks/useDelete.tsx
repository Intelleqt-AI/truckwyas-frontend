// hooks/useDelete.ts
import { deleteData } from '@/lib/Api';
import { useMutation } from '@tanstack/react-query';

export const useDelete = (options = {}) => {
  return useMutation({
    mutationFn: ({ url, data }: { url: string; data?: any }) => deleteData({ url, data }),
    ...options,
  });
};
