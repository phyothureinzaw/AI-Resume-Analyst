import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createInterviewPreparation, getInterviewPreparation, interviewPreparationKeys, listInterviewPreparations } from '../api/interview-preparations';

export function useInterviewPreparationList(page: number, pageSize: number, status?: string) {
  return useQuery({ queryKey: interviewPreparationKeys.list(page, pageSize, status), queryFn: ({ signal }) => listInterviewPreparations(page, pageSize, status, signal), placeholderData: (previous) => previous, retry: false });
}

export function useInterviewPreparation(id: string) {
  return useQuery({
    queryKey: interviewPreparationKeys.detail(id),
    queryFn: ({ signal }) => getInterviewPreparation(id, signal),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.preparation.status;
      return status === 'pending' || status === 'processing' ? 2_000 : false;
    }
  });
}

export function useInterviewPreparationCreation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createInterviewPreparation,
    retry: false,
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: interviewPreparationKeys.all });
      void client.invalidateQueries({ queryKey: interviewPreparationKeys.detail(data.preparationId) });
    }
  });
}
