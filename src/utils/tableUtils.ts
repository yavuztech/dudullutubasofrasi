/**
 * Get display name for a table based on its section
 * @param table - Table object or table properties
 * @returns Formatted table name (e.g., "Masa 5" or "Aile - 3")
 */
export function getTableDisplayName(table: { number: number; section?: 'normal' | 'family' }): string {
  return table.section === 'family' 
    ? `Aile - ${table.number}` 
    : `Masa ${table.number}`;
}

/**
 * Get display name for merged tables
 * @param mergedNumbers - Array of merged table numbers
 * @param section - Section of the primary table
 * @returns Formatted merged table name (e.g., "Masa 1-2" or "Aile - 1-2")
 */
export function getMergedTableDisplayName(mergedNumbers: number[], section?: 'normal' | 'family'): string {
  const joined = mergedNumbers.join('-');
  return section === 'family' 
    ? `Aile - ${joined}` 
    : `Masa ${joined}`;
}
