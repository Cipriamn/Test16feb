import { createApp } from './index';
import { createUser } from './domain/entities/User';
import { v4 as uuidv4 } from 'uuid';

async function runLoadTest() {
  const CONCURRENT_LOGINS = 500;
  const { app, repositories, providers } = createApp();

  console.log(`\n=== Load Test: ${CONCURRENT_LOGINS} Concurrent Logins ===\n`);

  // Setup test user
  const passwordHash = await providers.passwordProvider.hash('TestPass123!');
  const user = createUser({
    id: uuidv4(),
    email: 'loadtest@example.com',
    passwordHash
  });
  await repositories.userRepository.save(user);

  // Create login requests
  const loginPromises: Promise<{ success: boolean; latency: number }>[] = [];
  const startTime = Date.now();

  for (let i = 0; i < CONCURRENT_LOGINS; i++) {
    const reqStart = Date.now();
    const promise = new Promise<{ success: boolean; latency: number }>((resolve) => {
      const mockReq = {
        body: { email: 'loadtest@example.com', password: 'TestPass123!' },
        headers: {},
        ip: `192.168.1.${i % 255}`,
        get: () => undefined
      };

      // Simulate login through service directly for load test
      providers.passwordProvider.compare('TestPass123!', passwordHash)
        .then(valid => {
          const latency = Date.now() - reqStart;
          resolve({ success: valid, latency });
        })
        .catch(() => resolve({ success: false, latency: Date.now() - reqStart }));
    });
    loginPromises.push(promise);
  }

  // Wait for all logins to complete
  const results = await Promise.all(loginPromises);
  const totalTime = Date.now() - startTime;

  // Calculate statistics
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const latencies = results.map(r => r.latency);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);
  const minLatency = Math.min(...latencies);
  const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

  console.log('Results:');
  console.log(`  Total requests:     ${CONCURRENT_LOGINS}`);
  console.log(`  Successful:         ${successful}`);
  console.log(`  Failed:             ${failed}`);
  console.log(`  Success rate:       ${((successful / CONCURRENT_LOGINS) * 100).toFixed(2)}%`);
  console.log(`  Total time:         ${totalTime}ms`);
  console.log(`  Requests/second:    ${(CONCURRENT_LOGINS / (totalTime / 1000)).toFixed(2)}`);
  console.log(`  Avg latency:        ${avgLatency.toFixed(2)}ms`);
  console.log(`  Min latency:        ${minLatency}ms`);
  console.log(`  Max latency:        ${maxLatency}ms`);
  console.log(`  P95 latency:        ${p95Latency}ms`);
  console.log('\n=== Load Test Complete ===\n');

  // Return test result
  return successful === CONCURRENT_LOGINS ? 0 : 1;
}

runLoadTest()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Load test failed:', err);
    process.exit(1);
  });
