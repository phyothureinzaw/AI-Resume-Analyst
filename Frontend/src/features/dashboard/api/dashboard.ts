import { getJson } from '../../../shared/api/client';
import type { DashboardData } from '../types';

export const dashboardKeys = { all: ['dashboard'] as const };
export function getDashboard(signal?: AbortSignal): Promise<{ dashboard: DashboardData }> { return getJson<{ dashboard: DashboardData }>('/dashboard', signal); }
