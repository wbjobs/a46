const http = require('http');

function makeRequest(path, method, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
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

async function runTests() {
  console.log('=== 神秘代码翻译系统 API 测试 ===\n');

  try {
    console.log('1. 测试健康检查接口...');
    const health = await makeRequest('/api/health', 'GET');
    console.log('   状态:', health.success ? '✓ 正常' : '✗ 失败');
    console.log('   响应:', JSON.stringify(health, null, 2));
    console.log();

    console.log('2. 测试映射接口...');
    const mapping = await makeRequest('/api/mapping', 'GET');
    console.log('   状态:', mapping.success ? '✓ 正常' : '✗ 失败');
    if (mapping.success) {
      console.log('   映射数量:', Object.keys(mapping.mapping).length);
      console.log('   8 ->', mapping.mapping['8'], '(应为 D)');
      console.log('   55 ->', mapping.mapping['55'], '(应为 H)');
      console.log('   377 ->', mapping.mapping['377'], '(应为 L)');
    }
    console.log();

    console.log('3. 测试解密接口 - "HELLO WORLD"...');
    const testCode1 = '55 13 377 377 1597 0 75025 1597 6765 377 8';
    const decrypt1 = await makeRequest('/api/decrypt', 'POST', { code: testCode1 });
    console.log('   状态:', decrypt1.success ? '✓ 正常' : '✗ 失败');
    console.log('   输入:', testCode1);
    console.log('   输出:', decrypt1.decrypted);
    console.log('   期望: HELLO WORLD');
    console.log('   匹配:', decrypt1.decrypted === 'HELLO WORLD' ? '✓ 正确' : '✗ 错误');
    console.log();

    console.log('4. 测试解密接口 - "I AM HERE"...');
    const testCode2 = '89 0 2 610 0 55 13 6765 13';
    const decrypt2 = await makeRequest('/api/decrypt', 'POST', { code: testCode2 });
    console.log('   状态:', decrypt2.success ? '✓ 正常' : '✗ 失败');
    console.log('   输入:', testCode2);
    console.log('   输出:', decrypt2.decrypted);
    console.log('   期望: I AM HERE');
    console.log('   匹配:', decrypt2.decrypted === 'I AM HERE' ? '✓ 正确' : '✗ 错误');
    console.log();

    console.log('5. 测试错误处理 - 无效数字...');
    const testCode3 = '55 999 13';
    const decrypt3 = await makeRequest('/api/decrypt', 'POST', { code: testCode3 });
    console.log('   状态:', decrypt3.success ? '✓ 正常' : '✗ 失败');
    console.log('   输入:', testCode3);
    console.log('   输出:', decrypt3.decrypted);
    console.log('   错误:', decrypt3.errors ? decrypt3.errors.join(', ') : '无');
    console.log();

    console.log('=== 测试完成 ===');

  } catch (error) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

runTests();
