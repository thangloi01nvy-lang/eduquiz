const { execSync } = require('child_process');

console.log('🔍 Executing Automated Build & Type Check Verification...');

try {
  console.log('1️⃣ Checking TypeScript Types (tsc --noEmit)...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  
  console.log('2️⃣ Validating Vite Production Build (npm run build)...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('✅ ALL CHECKS PASSED PERFECTLY! Code is 100% safe to commit and push.');
} catch (error) {
  console.error('❌ BUILD CHECK FAILED! Please resolve syntax or type errors before pushing.');
  process.exit(1);
}
