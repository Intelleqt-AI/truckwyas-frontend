import { fetchData } from '@/lib/Api';
import { useQuery } from '@tanstack/react-query';

const useFetch = <T = any>(url: string, options: any = {}) => {
  const { data, isLoading, error, isError, refetch, isPending } = useQuery<T>({
    queryKey: [url],
    queryFn: () => fetchData(url),
    enabled: options.enabled !== false,
    ...options,
  });

  return {
    data,
    isLoading,
    error,
    isError,
    refetch,
    isPending,
  };
};

export default useFetch;
