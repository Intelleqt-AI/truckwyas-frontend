// hooks/usePost.ts
import { postData } from '@/lib/Api';
import { useMutation } from '@tanstack/react-query';

export const usePost = (options = {}) => {
  return useMutation({
    mutationFn: ({ url, data, config }: { url: string; data: any; config?: any }) => postData({ url, data, config }),
    ...options,
  });
};
