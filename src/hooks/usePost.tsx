// hooks/usePost.ts
import { postData } from '@/lib/Api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const usePost = (options: any = {}) => {
  const { invalidate, onSuccess, ...rest } = options;
  const queryClient = useQueryClient();

  return useMutation<any, Error, { url: string; data?: any; config?: any }>({
    mutationFn: ({ url, data, config }) => postData({ url, data, config }),
    onSuccess: (...args) => {
      if (invalidate) {
        const keys = Array.isArray(invalidate) ? invalidate : [invalidate];
        keys.forEach((key: any) =>
          queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
        );
      }
      onSuccess?.(...args);
    },
    ...rest,
  });
};
