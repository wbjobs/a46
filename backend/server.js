const express = require('express');
const cors = require('cors');
const { execFileSync } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

let fibMapping = null;
let mappingCacheTime = null;
const CACHE_TTL = 3600000;

function loadFibMapping() {
  const now = Date.now();
  if (fibMapping && mappingCacheTime && (now - mappingCacheTime < CACHE_TTL)) {
    return fibMapping;
  }

  try {
    const cliPath = path.join(__dirname, '../fib-generator/fib-generator.exe');
    const output = execFileSync(cliPath, ['-format=json'], { encoding: 'utf8' });
    const mappings = JSON.parse(output);
    
    fibMapping = {};
    for (const item of mappings) {
      fibMapping[item.number] = item.letter;
    }
    
    mappingCacheTime = now;
    console.log('Fibonacci mapping loaded from CLI tool');
    return fibMapping;
  } catch (error) {
    console.error('Failed to load fibonacci mapping from CLI:', error.message);
    console.log('Falling back to built-in mapping');
    
    fibMapping = {
      '2': 'A', '3': 'B', '5': 'C', '8': 'D', '13': 'E', '21': 'F', '34': 'G',
      '55': 'H', '89': 'I', '144': 'J', '233': 'K', '377': 'L', '610': 'M',
      '987': 'N', '1597': 'O', '2584': 'P', '4181': 'Q', '6765': 'R',
      '10946': 'S', '17711': 'T', '28657': 'U', '46368': 'V', '75025': 'W',
      '121393': 'X', '196418': 'Y', '317811': 'Z'
    };
    mappingCacheTime = now;
    return fibMapping;
  }
}

function decryptCode(code) {
  const mapping = loadFibMapping();
  const tokens = code.trim().split(/\s+/);
  let result = '';
  const errors = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (token === '0') {
      result += ' ';
      continue;
    }
    
    const num = parseInt(token, 10);
    if (isNaN(num)) {
      errors.push(`Invalid token at position ${i + 1}: "${token}"`);
      result += '?';
      continue;
    }
    
    const letter = mapping[token];
    if (letter) {
      result += letter;
    } else {
      errors.push(`Unknown number at position ${i + 1}: ${token}`);
      result += '?';
    }
  }

  return {
    original: code,
    decrypted: result,
    errors: errors.length > 0 ? errors : null
  };
}

app.get('/api/mapping', (req, res) => {
  try {
    const mapping = loadFibMapping();
    res.json({
      success: true,
      mapping: mapping
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load mapping'
    });
  }
});

app.post('/api/decrypt', (req, res) => {
  const { code } = req.body;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "code" parameter'
    });
  }

  try {
    const result = decryptCode(code);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Decryption error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during decryption'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Mystery Code Server running on http://localhost:${PORT}`);
  loadFibMapping();
});
