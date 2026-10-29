/**
 * Get display name for a table based on its section
 * @param table - Table object or table properties
 * @returns Formatted table name (e.g., "Masa 5" or "Aile - 3")
 */
export function getTableDisplayName(table: { number: number; displayName?: string; section?: 'normal' | 'family' | 'ladies' }): string {
  const number = table.displayName ?? String(table.number);
  if (table.section === 'ladies') return `H-${number}`;
  return table.section === 'family' 
    ? `Aile - ${number}`
    : `Masa ${number}`;
}

/**
 * Get display name for merged tables
 * @param mergedNumbers - Array of merged table numbers
 * @param section - Section of the primary table
 * @returns Formatted merged table name (e.g., "Masa 1-2" or "Aile - 1-2")
 */
export function getMergedTableDisplayName(mergedNumbers: number[], section?: 'normal' | 'family' | 'ladies'): string {
  const joined = mergedNumbers.join('-');
  if (section === 'ladies') return `H-${joined}`;
  return section === 'family' 
    ? `Aile - ${joined}` 
    : `Masa ${joined}`;
}
