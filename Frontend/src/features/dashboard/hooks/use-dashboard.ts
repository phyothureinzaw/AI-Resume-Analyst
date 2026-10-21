import { useQuery } from '@tanstack/react-query';
import { dashboardKeys, getDashboard } from '../api/dashboard';

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: ({ signal }) => getDashboard(signal),
    retry: false,
    refetchInterval: (query) => {
      const statuses = query.state.data?.dashboard.analysisStatuses;
      return statuses && (statuses.pending > 0 || statuses.processing > 0) ? 5_000 : false;
    },
    refetchIntervalInBackground: false
  });
}
