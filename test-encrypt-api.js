const http = require('http');

const BASE_URL = 'http://localhost:3003';

function makeRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test() {
  console.log('=== Testing Encrypt API ===\n');

  console.log('1. Test encrypt "HELLO WORLD"');
  let start = Date.now();
  let resp = await makeRequest('/api/encrypt', 'POST', { text: 'HELLO WORLD' });
  console.log('   Time:', Date.now() - start, 'ms');
  console.log('   Result:', JSON.stringify(resp, null, 2));
  console.log();

  console.log('2. Test decrypt the result to verify round-trip');
  if (resp.success && resp.encrypted) {
    start = Date.now();
    const decryptResp = await makeRequest('/api/decrypt', 'POST', { code: resp.encrypted });
    console.log('   Time:', Date.now() - start, 'ms');
    console.log('   Result:', JSON.stringify(decryptResp, null, 2));
    console.log('   Round-trip match:', decryptResp.decrypted === 'HELLO WORLD' ? '✅ YES' : '❌ NO');
  }
  console.log();

  console.log('3. Test encrypt "MYSTERY CODE"');
  start = Date.now();
  resp = await makeRequest('/api/encrypt', 'POST', { text: 'MYSTERY CODE' });
  console.log('   Time:', Date.now() - start, 'ms');
  console.log('   Result:', JSON.stringify(resp, null, 2));
  console.log();

  console.log('4. Test stats endpoint');
  start = Date.now();
  const stats = await makeRequest('/api/stats', 'GET');
  console.log('   Time:', Date.now() - start, 'ms');
  console.log('   Encrypt stats:', JSON.stringify(stats.cache, null, 2).substring(0, 400));
}

test().catch(console.error);
