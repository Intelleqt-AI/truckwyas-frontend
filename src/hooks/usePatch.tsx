// hooks/usePatch.ts
import { patchData } from '@/lib/Api';
import { useMutation } from '@tanstack/react-query';

export const usePatch = (options = {}) => {
  return useMutation({
    mutationFn: ({ url, data }: { url: string; data: any }) => patchData({ url, data }),
    ...options,
  });
};
