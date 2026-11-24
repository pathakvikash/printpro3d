// Single source of truth for where the business operates. Only what the owner confirmed; address, pin and pickup are owner-pending (context/OWNER-CHECKLIST.md).
export const SERVICE = {
  country: 'India',
  baseCity: 'Patna',
  state: 'Bihar',
  serviceArea: 'India only (for now)',
} as const;

export const BASED_LINE = `Based in ${SERVICE.baseCity}, ${SERVICE.state} · Delivering within India only`;
