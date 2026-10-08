/** Expense (and supplier) categories, as the API accepts them. */
export const EXPENSE_CATEGORIES = [
  { value: 'FUEL', label: 'Fuel' },
  { value: 'TOLLS', label: 'Tolls' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'DRIVER_COST', label: 'Driver cost' },
  { value: 'SUBCONTRACTOR', label: 'Subcontractor' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'OVERHEAD', label: 'Overhead' },
  { value: 'OTHER', label: 'Other' },
];

/** DRIVER is a legacy value still present in stored data. */
const LEGACY = [{ value: 'DRIVER', label: 'Driver' }];

export const categoryLabel = (v?: string | null): string =>
  [...EXPENSE_CATEGORIES, ...LEGACY].find(c => c.value === v)?.label
  ?? (v ? v.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) : '—');

/** Filter options: "All" first, then every category including legacy ones. */
export const CATEGORY_FILTERS = [{ value: 'All', label: 'All categories' }, ...EXPENSE_CATEGORIES.slice(0, 4), ...LEGACY, ...EXPENSE_CATEGORIES.slice(4)];
