import type { Employee } from '@/lib/types';
import { cx, initials } from '@/lib/format';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-caption',
  sm: 'h-8 w-8 text-caption',
  md: 'h-10 w-10 text-body-s',
  lg: 'h-14 w-14 text-lead',
};

/**
 * The brand navy ramp plus the one accent — no status inks. A tile hashes to a colour, and
 * the moment that colour can be green or amber it reads as a state: a solid green square
 * sits in the same row as a green "Disbursed" stamp and stops meaning "this is Priya". So
 * the ramp here is navy-on-navy with orange, all of it from tailwind.config.js. Chosen by
 * hashing the name, so a person keeps the same tile on every screen and across re-renders.
 */
const AVATAR_PALETTE = [
  'bg-darkey-bluey text-white',
  'bg-orangy text-rich-black',
  'bg-rich-black text-white',
  'bg-navy-600 text-white',
  'bg-navy-500 text-white',
  'bg-navy-700 text-white',
];

function paletteFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/**
 * A hard-edged square tile, not a circle. Radius 0 is the brand's loudest signature and a
 * square initial block reads like a stencilled crate mark — which is the register this
 * plant works in. Initials stay in the sans face; only figures go mono.
 */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cx('shrink-0 object-cover', SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center',
        'font-sans font-semibold uppercase leading-none',
        SIZE_CLASSES[size],
        paletteFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function EmployeeChip({
  employee,
  size = 'sm',
  showDept = false,
  showCode = false,
}: {
  employee: Employee;
  size?: 'sm' | 'md';
  showDept?: boolean;
  showCode?: boolean;
}) {
  const code = showCode ? employee.employeeCode : null;
  const dept = showDept ? employee.department : null;

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={employee.name} src={employee.avatarUrl} size={size === 'md' ? 'md' : 'sm'} />
      <div className="min-w-0">
        <p
          className={cx(
            'truncate font-semibold text-rich-black',
            size === 'md' ? 'text-body' : 'text-body-s',
          )}
        >
          {employee.name}
        </p>
        {code || dept ? (
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {/* The employee code is an identifier, so it is set on the docket face. */}
            {code ? <span className="ku-docket shrink-0">{code}</span> : null}
            {code && dept ? (
              <span aria-hidden="true" className="h-2.5 w-px shrink-0 bg-hairline-strong" />
            ) : null}
            {dept ? <span className="truncate text-caption text-meta">{dept}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
