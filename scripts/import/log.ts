/* Lightweight console logging for the import pipeline. */

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
};

export function step(message: string): void {
  console.log(`${colors.cyan}▸${colors.reset} ${message}`);
}

export function ok(table: string, count: number): void {
  console.log(
    `  ${colors.green}✓${colors.reset} ${table}: upserted ${count}`,
  );
}

export function warn(message: string): void {
  console.log(`  ${colors.yellow}!${colors.reset} ${message}`);
}

export function fail(message: string): void {
  console.error(`${colors.red}✗ ${message}${colors.reset}`);
}

export function done(total: number): void {
  console.log(
    `${colors.green}Done.${colors.reset} ${colors.dim}(${total} records)${colors.reset}`,
  );
}
