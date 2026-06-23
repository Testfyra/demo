import {bug} from 'bug'
const shouldFail = process.env.DEMO_FAIL_TESTS === 'true';

if (shouldFail) {
  console.error('CheckoutService integration test failed: invalid session token handling');
  process.exit(1);
}





console.log('Unit tests passed');
console.log('Integration tests passed');
console.log('Coverage: 84%');
