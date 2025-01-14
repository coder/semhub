/**
 * Counts the number of parameter placeholders ($1, $2, etc) in a SQL string
 */
function countPlaceholders(sqlStr: string): number {
  const matches = sqlStr.match(/\$\d+/g);
  if (!matches) return 0;

  // Get the highest placeholder number
  const numbers = matches.map((m) => parseInt(m.slice(1)));
  return Math.max(...numbers);
}

/**
 * Substitutes parameters into a SQL query string with $1, $2, etc placeholders
 * Returns a SQL.Placeholder that can be used in other queries
 * @throws {Error} if number of params doesn't match placeholders
 */
export function substituteSqlParams(sqlStr: string, params: unknown[]): string {
  const expectedCount = countPlaceholders(sqlStr);
  if (expectedCount !== params.length) {
    throw new Error(
      `Parameter count mismatch: expected ${expectedCount} parameters but got ${params.length}`,
    );
  }

  let result = sqlStr;

  // For each parameter, replace $n with the actual value, properly escaped
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    let value: string;

    if (param === null) {
      value = "NULL";
    } else if (typeof param === "string") {
      // Escape single quotes and wrap in quotes
      value = `'${param.replace(/'/g, "''")}'`;
    } else if (typeof param === "boolean") {
      value = param ? "true" : "false";
    } else {
      value = String(param);
    }

    result = result.replace(placeholder, value);
  });

  return result;
}
