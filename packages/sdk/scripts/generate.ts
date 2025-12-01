import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import openapiTS from 'openapi-typescript';

async function main() {
  const specPath = resolve(process.cwd(), '../../apps/api/openapi.json');
  const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
  const output = await openapiTS(spec as Record<string, unknown>, { alphabetize: true });
  const outPath = resolve(process.cwd(), 'src/generated/openapi-types.ts');
  writeFileSync(outPath, String(output), 'utf-8');
  console.log('Wrote', outPath);
  console.log('Generated SDK types from', specPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
