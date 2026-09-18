/**
 * Leave and attendance for the HR workspace.
 *
 * The people are the live employee directory from the API, the same
 * records the claim screens use, so HR never sees a second list of staff.
 * Leave requests are kept in this browser: there is no leave service behind
 * the console yet, and the record here is what that service would own.
 *
 * Dates are written relative to today so the screens read as current whenever
 * the console is opened.
 */

import { useCallback, useEffect, useState } from 'react';

export type LeaveType = 'Casual' | 'Sick' | 'Earned' | 'Comp Off';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  from: string; // ISO date
  to: string; // ISO date
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedBy?: string;
}

/** Annual entitlement per leave type, in days. */
export const LEAVE_ENTITLEMENT: Record<LeaveType, number> = {
  Casual: 8,
  Sick: 10,
  Earned: 18,
  'Comp Off': 4,
};

const isoDay = (offset: number): string => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const todayIso = (): string => isoDay(0);

const seed = (): LeaveRequest[] => [
  { id: 'LV-2041', employeeId: 'EMP-07', type: 'Casual', from: isoDay(3), to: isoDay(4), days: 2, reason: 'Family function in Nagpur', status: 'Pending' },
  { id: 'LV-2040', employeeId: 'EMP-02', type: 'Earned', from: isoDay(10), to: isoDay(14), days: 5, reason: 'Annual leave, handover with Tanvi Malhotra', status: 'Pending' },
  { id: 'LV-2039', employeeId: 'EMP-09', type: 'Sick', from: isoDay(0), to: isoDay(1), days: 2, reason: 'Viral fever, doctor advised rest', status: 'Pending' },
  { id: 'LV-2038', employeeId: 'EMP-06', type: 'Casual', from: isoDay(0), to: isoDay(0), days: 1, reason: 'Personal work', status: 'Approved', decidedBy: 'Meera Nair' },
  { id: 'LV-2037', employeeId: 'EMP-11', type: 'Earned', from: isoDay(-1), to: isoDay(2), days: 4, reason: 'Travelling to Kochi', status: 'Approved', decidedBy: 'Meera Nair' },
  { id: 'LV-2036', employeeId: 'EMP-03', type: 'Comp Off', from: isoDay(-6), to: isoDay(-6), days: 1, reason: 'Worked the Sunday shutdown shift', status: 'Approved', decidedBy: 'Tanvi Malhotra' },
  { id: 'LV-2035', employeeId: 'EMP-08', type: 'Casual', from: isoDay(-9), to: isoDay(-8), days: 2, reason: 'Exhibition travel overlap', status: 'Rejected', decidedBy: 'Meera Nair' },
  { id: 'LV-2034', employeeId: 'EMP-01', type: 'Sick', from: isoDay(-14), to: isoDay(-13), days: 2, reason: 'Migraine', status: 'Approved', decidedBy: 'Tanvi Malhotra' },
];

const STORAGE_KEY = 'kiran_hr_leave_v1';

interface Stored {
  /** The day the relative dates were generated; a new day re-seeds them. */
  day: string;
  requests: LeaveRequest[];
}

const load = (): LeaveRequest[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Stored;
      if (stored.day === todayIso() && Array.isArray(stored.requests)) return stored.requests;
    }
  } catch {
    /* unreadable storage falls through to the seed */
  }
  return seed();
};

const save = (requests: LeaveRequest[]) => {
  try {
    const stored: Stored = { day: todayIso(), requests };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* a full or blocked store only costs persistence across reloads */
  }
};

export function useLeave() {
  const [requests, setRequests] = useState<LeaveRequest[]>(load);

  // Another HR tab deciding a request should be visible here too.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setRequests(load());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const decide = useCallback((id: string, status: 'Approved' | 'Rejected', decidedBy: string) => {
    setRequests((current) => {
      const next = current.map((request) =>
        request.id === id ? { ...request, status, decidedBy } : request,
      );
      save(next);
      return next;
    });
  }, []);

  return { requests, decide };
}

/** Whether an approved leave covers the given ISO day. */
export const onLeaveOn = (requests: LeaveRequest[], employeeId: string, day: string): boolean =>
  requests.some(
    (request) =>
      request.employeeId === employeeId &&
      request.status === 'Approved' &&
      request.from <= day &&
      day <= request.to,
  );

export type AttendanceStatus = 'Present' | 'Remote' | 'On Leave' | 'Late';

export interface AttendanceRow {
  employeeId: string;
  status: AttendanceStatus;
  checkIn: string | null;
  /** Days present out of working days so far this month. */
  presentDays: number;
  workingDays: number;
}

/**
 * Today's register. Leave comes from the leave record above; the swipe times
 * are fixed per person so the page is stable between visits.
 */
export function attendanceFor(employeeIds: string[], leave: LeaveRequest[]): AttendanceRow[] {
  const day = todayIso();
  const workingDays = Math.max(1, Math.min(22, Math.round(new Date().getDate() * (5 / 7))));

  return employeeIds.map((employeeId, index) => {
    const away = onLeaveOn(leave, employeeId, day);
    const minutes = 5 + ((index * 17) % 50); // 09:05 to 09:54
    const late = minutes > 45;
    const remote = index % 5 === 3;
    const missed = (index * 3) % 4; // 0 to 3 days missed this month

    return {
      employeeId,
      status: away ? 'On Leave' : late ? 'Late' : remote ? 'Remote' : 'Present',
      checkIn: away ? null : `09:${String(minutes).padStart(2, '0')}`,
      presentDays: Math.max(0, workingDays - missed - (away ? 1 : 0)),
      workingDays,
    };
  });
}
