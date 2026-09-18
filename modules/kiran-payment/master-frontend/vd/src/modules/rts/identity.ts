/**
 * The join between the two directories.
 *
 * The conversation workspace and the finance module each have their own idea
 * of a person — one has chat users, the other has employees with codes, bank
 * records and allowances. They are seeded to describe the same fourteen
 * people, and this is where that correspondence is made explicit rather than
 * assumed.
 *
 * Matching on name is honest about what it is: a demo-grade join. A production
 * system would carry one identity provider and a single id on both sides, and
 * this module is the one place that would have to change.
 */

import type { Employee, Role } from './types';

const normalise = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The employee record for a person named in the chat directory, if there is
 * one. Returns undefined for people who exist in conversations but do not
 * file claims.
 */
export function employeeForName(
  employees: Employee[],
  name: string,
): Employee | undefined {
  const needle = normalise(name);
  return employees.find((employee) => normalise(employee.name) === needle);
}

/**
 * Which reviewing role a person holds, inferred from their designation.
 *
 * The finance module's employee records carry a designation rather than a
 * permission, because that is what an HR system actually stores. This reads
 * the one signal that matters here — whether this person is the HR partner,
 * the accounts controller, or the payments officer — and everything else is
 * an ordinary employee who can file claims but not decide them.
 */
export function reviewRoleFor(employee: Employee | undefined): Role {
  if (!employee) return 'EMPLOYEE';
  const designation = employee.designation.toLowerCase();
  if (designation.includes('hr ')) return 'HR';
  if (designation.includes('payments')) return 'PAYMENTS';
  if (designation.includes('accounts') || designation.includes('financial')) return 'ACCOUNTS';
  return 'EMPLOYEE';
}
