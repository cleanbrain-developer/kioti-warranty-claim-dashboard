// Salesforce custom date fields (__c) carry no real time-of-day — they're stored
// as midnight in the org's local time, not UTC. Formatting them in the viewer's
// browser timezone can shift the displayed day by one. Standard datetime fields
// (CreatedDate, LastModifiedDate) carry a real instant and should use the viewer's
// local timezone instead.

const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Date-only fields (submittedDate, repairDate, failureDate, approvedDate, rejectedDate, ...) */
export function formatDateOnly(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return '—';
  }
}

/** True datetime fields (sfCreatedDate, sfLastModified, ...) */
export function formatDateTimeLocal(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      timeZone: browserTz,
    }).format(d);
  } catch {
    return '—';
  }
}
