const { spawn } = require('child_process');
const path = require('path');

const cliPath = path.join(__dirname, 'fib-generator/fib-generator.exe');

console.log('Testing encrypt functionality...');

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
      responsesReceived++;
      try {
        const resp = JSON.parse(line);
        console.log('Response:', JSON.stringify(resp, null, 2).substring(0, 500));
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    }
  }
});

daemon.stderr.on('data', (data) => {
  console.log('[STDERR]:', data.toString().trim());
});

function sendRequest(command, data = {}) {
  requestCount++;
  const req = {
    command,
    id: `test-${requestCount}`,
    ...data
  };
  const json = JSON.stringify(req) + '\n';
  console.log('\nSending:', command);
  daemon.stdin.write(json);
}

setTimeout(() => {
  console.log('\n--- Test: ENCRYPT "HELLO WORLD" ---');
  sendRequest('ENCRYPT', { letters: ['H', 'E', 'L', 'L', 'O', ' ', 'W', 'O', 'R', 'L', 'D'] });
}, 500);

setTimeout(() => {
  console.log('\n--- Test: LOOKUP_LETTERS ["A", "B", "C", "D", " "] ---');
  sendRequest('LOOKUP_LETTERS', { letters: ['A', 'B', 'C', 'D', ' '] });
}, 1500);

setTimeout(() => {
  console.log('\n--- Summary ---');
  console.log('Requests sent:', requestCount);
  console.log('Responses received:', responsesReceived);
  daemon.kill();
  process.exit(0);
}, 2500);
