/**
 * The module's one source of people.
 *
 * `src/modules/rts/identity.ts` is a join between the chat and finance
 * directories, not a directory itself — it holds no names. The three lists that
 * do are the chat seed (14 users), the reimbursement backend (12 employees,
 * only reachable when the Python API is up) and `src/data/people.ts`.
 *
 * This module reads the last of those, for three reasons: it is the list the
 * previous project pages were already built on, so the existing task and member
 * data carries over intact; it needs no backend, which the frontend-only
 * constraint requires; and it already carries the standing score and warning
 * count that Kiran's per-member compliance display needs.
 *
 * Everything else in the module imports people from here, so replacing the
 * source later is a one-file change.
 */

import { mockPeople } from '../../data/people';
import { avatarColorFor } from './constants';
import type { ProjectPerson } from './types';

/** "Anjali Menon" -> "AM". Falls back to the first two letters of one word. */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const PEOPLE: ProjectPerson[] = mockPeople.map((person) => ({
  id: person.id,
  name: person.name,
  initials: person.avatar || initialsFor(person.name),
  department: person.department,
  role: person.role,
  color: avatarColorFor(person.id),
  complianceScore: person.standingScore,
  warningsCount: person.warningsCount,
}));

const PEOPLE_BY_ID: Record<string, ProjectPerson> = PEOPLE.reduce(
  (acc, person) => ({ ...acc, [person.id]: person }),
  {} as Record<string, ProjectPerson>,
);

/** The person with this id, or undefined for an id no longer in the directory. */
export function personById(id: string | null | undefined): ProjectPerson | undefined {
  if (!id) return undefined;
  return PEOPLE_BY_ID[id];
}

/**
 * A display name for an id, never blank.
 *
 * Assignees are stored as ids, and an id that has dropped out of the directory
 * would otherwise render as an empty cell that looks like a bug.
 */
export function personName(id: string | null | undefined): string {
  return personById(id)?.name ?? 'Unassigned';
}

/** Every person in a given department. */
export function peopleInDepartment(department: string): ProjectPerson[] {
  return PEOPLE.filter((person) => person.department === department);
}

/**
 * The persona acting in the demo.
 *
 * There is no authentication here and there will not be — this is the "you" that
 * new work items, comments and activity entries are attributed to. Matches
 * `currentUser` in `src/data/people.ts` so the console tells one story.
 */
export const CURRENT_USER_ID = PEOPLE[0].id;

export const currentUser = (): ProjectPerson => PEOPLE[0];
