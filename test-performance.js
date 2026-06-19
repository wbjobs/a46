const http = require('http');

const PORT = 3003;

function makeRequest(path, method, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
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

function generateRandomCode(count) {
  const numbers = [
    '2', '3', '5', '8', '13', '21', '34', '55', '89', '144',
    '233', '377', '610', '987', '1597', '2584', '4181', '6765',
    '10946', '17711', '28657', '46368', '75025', '121393',
    '196418', '317811'
  ];
  
  const tokens = [];
  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.1) {
      tokens.push('0');
    } else {
      tokens.push(numbers[Math.floor(Math.random() * numbers.length)]);
    }
  }
  return tokens.join(' ');
}

async function runPerformanceTest() {
  console.log('=== 性能测试 ===\n');

  console.log('1. 健康检查...');
  const startHealth = Date.now();
  const health = await makeRequest('/api/health', 'GET');
  const healthTime = Date.now() - startHealth;
  console.log(`   状态: ${health.success ? '正常' : '失败'}`);
  console.log(`   守护进程就绪: ${health.daemonReady}`);
  console.log(`   耗时: ${healthTime}ms`);
  console.log();

  console.log('2. 单个短代码测试 (5个数字)...');
  const shortCode = generateRandomCode(5);
  const startShort = Date.now();
  const resultShort = await makeRequest('/api/decrypt', 'POST', { code: shortCode });
  const shortTime = Date.now() - startShort;
  console.log(`   输入长度: 5 个数字`);
  console.log(`   输出: ${resultShort.decrypted}`);
  console.log(`   耗时: ${shortTime}ms`);
  console.log();

  console.log('3. 中等长度代码测试 (50个数字)...');
  const mediumCode = generateRandomCode(50);
  const startMedium = Date.now();
  const resultMedium = await makeRequest('/api/decrypt', 'POST', { code: mediumCode });
  const mediumTime = Date.now() - startMedium;
  console.log(`   输入长度: 50 个数字`);
  console.log(`   输出长度: ${resultMedium.decrypted.length} 个字符`);
  console.log(`   耗时: ${mediumTime}ms`);
  console.log();

  console.log('4. 长代码测试 (200个数字)...');
  const longCode = generateRandomCode(200);
  const startLong = Date.now();
  const resultLong = await makeRequest('/api/decrypt', 'POST', { code: longCode });
  const longTime = Date.now() - startLong;
  console.log(`   输入长度: 200 个数字`);
  console.log(`   输出长度: ${resultLong.decrypted.length} 个字符`);
  console.log(`   耗时: ${longTime}ms`);
  console.log();

  console.log('5. 超长代码测试 (500个数字)...');
  const veryLongCode = generateRandomCode(500);
  const startVeryLong = Date.now();
  const resultVeryLong = await makeRequest('/api/decrypt', 'POST', { code: veryLongCode });
  const veryLongTime = Date.now() - startVeryLong;
  console.log(`   输入长度: 500 个数字`);
  console.log(`   输出长度: ${resultVeryLong.decrypted.length} 个字符`);
  console.log(`   耗时: ${veryLongTime}ms`);
  console.log();

  console.log('6. 连续请求测试 (10次连续请求)...');
  const consecutiveTimes = [];
  for (let i = 0; i < 10; i++) {
    const code = generateRandomCode(100);
    const start = Date.now();
    await makeRequest('/api/decrypt', 'POST', { code });
    const time = Date.now() - start;
    consecutiveTimes.push(time);
  }
  const avgTime = consecutiveTimes.reduce((a, b) => a + b, 0) / consecutiveTimes.length;
  const minTime = Math.min(...consecutiveTimes);
  const maxTime = Math.max(...consecutiveTimes);
  console.log(`   平均耗时: ${avgTime.toFixed(2)}ms`);
  console.log(`   最快: ${minTime}ms`);
  console.log(`   最慢: ${maxTime}ms`);
  console.log(`   各次耗时: ${consecutiveTimes.join('ms, ')}ms`);
  console.log();

  console.log('7. 缓存统计...');
  const stats = await makeRequest('/api/stats', 'GET');
  console.log('   守护进程统计:', JSON.stringify(stats.daemon, null, 6).replace(/\n/g, '\n   '));
  console.log('   缓存统计:', JSON.stringify(stats.cache, null, 6).replace(/\n/g, '\n   '));
  console.log();

  console.log('=== 性能测试完成 ===');
}

runPerformanceTest().catch(console.error);
