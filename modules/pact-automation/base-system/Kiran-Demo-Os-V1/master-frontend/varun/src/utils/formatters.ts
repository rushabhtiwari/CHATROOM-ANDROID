/**
 * Indian numbering system currency formatter
 * Example: 1245600 -> ₹12,45,600
 */
export function formatINR(amount: number | undefined | null, includeSymbol = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return includeSymbol ? '₹0' : '0';
  }
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const parts = absAmount.toFixed(0).split('.');
  let lastThree = parts[0].substring(parts[0].length - 3);
  const otherNumbers = parts[0].substring(0, parts[0].length - 3);
  
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  
  const res = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const prefix = includeSymbol ? (isNegative ? '-₹' : '₹') : (isNegative ? '-' : '');
  return `${prefix}${res}`;
}

/**
 * Format numbers in Lakhs and Crores for summary KPIs
 * Example: 14500000 -> ₹1.45 Cr, 450000 -> ₹4.50 L
 */
export function formatINRLakhCrore(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 10000000) {
    return `${sign}₹${(absAmount / 10000000).toFixed(2)} Cr`;
  }
  if (absAmount >= 100000) {
    return `${sign}₹${(absAmount / 100000).toFixed(2)} L`;
  }
  return formatINR(amount);
}

/**
 * Format date in DD MMM YYYY (e.g. 19 Aug 2026)
 */
export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(d.getTime())) return String(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return String(dateString);
  }
}

/**
 * Format date and time in IST
 * Example: 19 Aug 2026, 04:30 PM IST
 */
export function formatDateTimeIST(dateString: string | Date | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(d.getTime())) return String(dateString);
    const dateFormatted = formatDate(d);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' should be '12'
    const formattedHours = String(hours).padStart(2, '0');
    return `${dateFormatted}, ${formattedHours}:${minutes} ${ampm} IST`;
  } catch {
    return String(dateString);
  }
}

/**
 * Get Confidence Color Class
 * >=95 green, 80-94 amber, <80 red
 */
export function getConfidenceColor(confidence: number): {
  text: string;
  bg: string;
  border: string;
  dot: string;
} {
  // A stamp's outline and its letters are the same ink (§8.2): a border that
  // *is* the component must clear 3:1, so these never carry an alpha.
  if (confidence >= 95) {
    return {
      text: 'text-st-green-ink',
      bg: 'bg-st-green-bg',
      border: 'border-st-green-ink',
      dot: 'bg-st-green-ink',
    };
  }
  if (confidence >= 80) {
    return {
      text: 'text-st-amber-ink',
      bg: 'bg-st-amber-bg',
      border: 'border-st-amber-ink',
      dot: 'bg-st-amber-ink',
    };
  }
  return {
    text: 'text-st-red-ink',
    bg: 'bg-st-red-bg',
    border: 'border-st-red-ink',
    dot: 'bg-st-red-ink',
  };
}

/**
 * Get Department Strand Color
 */
export function getDepartmentColor(dept: string): {
  color: string;
  bg: string;
  border: string;
} {
  switch (dept?.toLowerCase()) {
    case 'sales':
    case 'dispatch':
    case 'revenue':
      return { color: 'text-strand-red', bg: 'bg-strand-red', border: 'border-strand-red' };
    case 'purchase':
    case 'stores':
    case 'planning':
    case 'production':
    case 'operations':
      return { color: 'text-strand-amber', bg: 'bg-strand-amber', border: 'border-strand-amber' };
    case 'accounts':
    case 'finance':
      return { color: 'text-strand-green', bg: 'bg-strand-green', border: 'border-strand-green' };
    case 'projects':
    case 'admin':
    case 'quality':
    case 'crm':
    case 'hr':
    case 'intelligence':
    case 'system':
    default:
      return { color: 'text-strand-teal', bg: 'bg-strand-teal', border: 'border-strand-teal' };
  }
}
