const { spawn } = require('child_process');
const path = require('path');

const cliPath = path.join(__dirname, 'fib-generator/fib-generator.exe');

console.log('Testing daemon mode...');

const daemon = spawn(cliPath, ['-daemon'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseBuffer = '';
let requestCount = 0;
let responsesReceived = 0;

daemon.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  let newlineIndex;
  while ((newlineIndex = responseBuffer.indexOf('\n')) !== -1) {
    const line = responseBuffer.substring(0, newlineIndex).trim();
    responseBuffer = responseBuffer.substring(newlineIndex + 1);
    
    if (line) {
      console.log('Received:', line.substring(0, 200));
      responsesReceived++;
      
      try {
        const resp = JSON.parse(line);
        console.log('Parsed response:', JSON.stringify(resp, null, 2).substring(0, 300));
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    }
  }
});

daemon.stderr.on('data', (data) => {
  console.log('[STDERR]:', data.toString().trim());
});

daemon.on('close', (code) => {
  console.log(`Daemon exited with code ${code}`);
});

function sendRequest(command, data = {}) {
  requestCount++;
  const req = {
    command,
    id: `test-${requestCount}`,
    ...data
  };
  const json = JSON.stringify(req) + '\n';
  console.log('Sending:', json.trim());
  daemon.stdin.write(json);
}

setTimeout(() => {
  console.log('\n--- Test 1: PING ---');
  sendRequest('PING');
}, 500);

setTimeout(() => {
  console.log('\n--- Test 2: MAPPINGS ---');
  sendRequest('MAPPINGS');
}, 1500);

setTimeout(() => {
  console.log('\n--- Test 3: LOOKUP ---');
  sendRequest('LOOKUP', { numbers: ['8', '55', '377', '0'] });
}, 2500);

setTimeout(() => {
  console.log('\n--- Test 4: BATCH LOOKUP ---');
  sendRequest('LOOKUP', { numbers: ['2', '3', '5', '8', '13', '21', '34', '55', '89', '144'] });
}, 3500);

setTimeout(() => {
  console.log('\n--- Summary ---');
  console.log('Requests sent:', requestCount);
  console.log('Responses received:', responsesReceived);
  daemon.kill();
  process.exit(0);
}, 5000);
