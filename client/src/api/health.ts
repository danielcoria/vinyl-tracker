import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@vinyl/shared';
import { apiGet } from './client';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/api/health', healthResponseSchema),
  });
}
