/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');

try {
  console.log('Testing TypeScript compilation...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✓ TypeScript compilation successful!');
} catch {
  console.error('✗ TypeScript compilation failed');
  process.exit(1);
}
