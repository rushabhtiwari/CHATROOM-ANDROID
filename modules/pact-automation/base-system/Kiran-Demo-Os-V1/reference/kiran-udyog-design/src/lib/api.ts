import type {
  Employee,
  ReceiptRequest,
  Payout,
  Notification,
  MonthlySpend,
  DepartmentUtilisation,
  Category
} from '@/lib/types';

const API_BASE = 'http://localhost:8000/api';

async function fetchWithRetry<T>(url: string, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json() as T;
      }
    } catch (e) {
      if (i === retries - 1) throw e;
    }
    // Wait before retrying (exponential backoff or fixed)
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Failed to fetch ${url}`);
}

export const api = {
  getEmployees: () => fetchWithRetry<Employee[]>(`${API_BASE}/employees`),
  getRequests: () => fetchWithRetry<ReceiptRequest[]>(`${API_BASE}/requests`),
  getPayouts: () => fetchWithRetry<Payout[]>(`${API_BASE}/payouts`),
  getNotifications: () => fetchWithRetry<Notification[]>(`${API_BASE}/notifications`),
  getMonthlySpend: () => fetchWithRetry<MonthlySpend[]>(`${API_BASE}/monthly-spend`),
  getDepartmentUtilisation: () => fetchWithRetry<DepartmentUtilisation[]>(`${API_BASE}/department-utilisation`),
  getCategorySpend: () => fetchWithRetry<{ category: Category; amount: number; count: number }[]>(`${API_BASE}/category-spend`),
  getPolicyCaps: () => fetchWithRetry<import('@/lib/types').PolicyCap[]>(`${API_BASE}/policy-caps`),
};
