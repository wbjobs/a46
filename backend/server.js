const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  clear() {
    this.cache.clear();
  }
}

class FibDaemon extends EventEmitter {
  constructor(cliPath) {
    super();
    this.cliPath = cliPath;
    this.process = null;
    this.isReady = false;
    this.requestQueue = [];
    this.currentRequest = null;
    this.responseBuffer = '';
    this.requestId = 0;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isShuttingDown = false;
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      daemonRequests: 0,
      errors: 0,
      restarts: 0
    };
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        console.log('Starting Fibonacci Generator Daemon...');
        
        this.process = spawn(this.cliPath, ['-daemon'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        });

        this.process.stdout.on('data', (data) => {
          this._handleStdout(data);
        });

        this.process.stderr.on('data', (data) => {
          console.log('[Daemon stderr]:', data.toString().trim());
        });

        this.process.on('close', (code) => {
          console.log(`Daemon process exited with code ${code}`);
          this.isReady = false;
          this._handleProcessExit(code);
        });

        this.process.on('error', (err) => {
          console.error('Daemon process error:', err.message);
          this.isReady = false;
          if (!this.isShuttingDown) {
            this._scheduleRestart();
          }
        });

        setTimeout(() => {
          this._sendRequest({ command: 'PING' })
            .then(() => {
              this.isReady = true;
              console.log('Fibonacci Daemon is ready');
              resolve();
            })
            .catch((err) => {
              reject(new Error(`Failed to ping daemon: ${err.message}`));
            });
        }, 500);

      } catch (error) {
        reject(error);
      }
    });
  }

  _handleStdout(data) {
    this.responseBuffer += data.toString();
    
    let newlineIndex;
    while ((newlineIndex = this.responseBuffer.indexOf('\n')) !== -1) {
      const line = this.responseBuffer.substring(0, newlineIndex).trim();
      this.responseBuffer = this.responseBuffer.substring(newlineIndex + 1);
      
      if (line) {
        try {
          const response = JSON.parse(line);
          this._handleResponse(response);
        } catch (e) {
          console.error('Failed to parse daemon response:', line.substring(0, 100));
        }
      }
    }
  }

  _handleResponse(response) {
    this.stats.daemonRequests++;
    
    if (this.currentRequest && 
        (response.id === this.currentRequest.request.id || 
         response.command === this.currentRequest.request.command)) {
      const req = this.currentRequest;
      this.currentRequest = null;
      
      if (response.success) {
        req.resolve(response);
      } else {
        req.reject(new Error(response.message || 'Daemon error'));
      }
      
      this._processNextRequest();
    }
  }

  _handleProcessExit(code) {
    if (this.currentRequest) {
      this.currentRequest.reject(new Error('Daemon process exited'));
      this.currentRequest = null;
    }
    
    while (this.requestQueue.length > 0) {
      const req = this.requestQueue.shift();
      req.reject(new Error('Daemon process exited'));
    }
    
    if (!this.isShuttingDown) {
      this._scheduleRestart();
    }
  }

  _scheduleRestart() {
    if (this.retryCount >= this.maxRetries) {
      console.error('Max retries exceeded, giving up on daemon');
      this.emit('daemonFailed');
      return;
    }
    
    this.retryCount++;
    this.stats.restarts++;
    
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 10000);
    console.log(`Restarting daemon in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
    
    setTimeout(() => {
      this.start()
        .then(() => {
          this.retryCount = 0;
          this.emit('daemonRestored');
        })
        .catch((err) => {
          console.error('Failed to restart daemon:', err.message);
          this._scheduleRestart();
        });
    }, delay);
  }

  _sendRequest(request) {
    return new Promise((resolve, reject) => {
      this.requestId++;
      const req = {
        ...request,
        id: `req-${this.requestId}`
      };
      
      this.requestQueue.push({
        request: req,
        resolve,
        reject
      });
      
      if (!this.currentRequest) {
        this._processNextRequest();
      }
    });
  }

  _processNextRequest() {
    if (this.currentRequest || this.requestQueue.length === 0) return;
    
    const req = this.requestQueue.shift();
    this.currentRequest = req;
    this.stats.totalRequests++;
    
    try {
      const json = JSON.stringify(req.request) + '\n';
      this.process.stdin.write(json);
    } catch (error) {
      this.currentRequest = null;
      req.reject(error);
      this._processNextRequest();
    }
  }

  async getMappings() {
    if (!this.isReady) {
      throw new Error('Daemon not ready');
    }
    const response = await this._sendRequest({ command: 'MAPPINGS' });
    return response.mapping;
  }

  async lookupNumbers(numbers) {
    if (!this.isReady) {
      throw new Error('Daemon not ready');
    }
    const response = await this._sendRequest({
      command: 'LOOKUP',
      numbers: numbers
    });
    return {
      results: response.results,
      errors: response.errors || []
    };
  }

  stop() {
    this.isShuttingDown = true;
    if (this.process) {
      this.process.kill();
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

const FALLBACK_MAPPING = {
  '2': 'A', '3': 'B', '5': 'C', '8': 'D', '13': 'E', '21': 'F', '34': 'G',
  '55': 'H', '89': 'I', '144': 'J', '233': 'K', '377': 'L', '610': 'M',
  '987': 'N', '1597': 'O', '2584': 'P', '4181': 'Q', '6765': 'R',
  '10946': 'S', '17711': 'T', '28657': 'U', '46368': 'V', '75025': 'W',
  '121393': 'X', '196418': 'Y', '317811': 'Z'
};

class FibCache {
  constructor() {
    this.l1Cache = { ...FALLBACK_MAPPING };
    this.l2Cache = new LRUCache(5000);
    this.daemon = null;
    this.fallbackMapping = FALLBACK_MAPPING;
    this.isInitialized = false;
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      daemonHits: 0,
      fallbackHits: 0,
      misses: 0
    };
  }

  async init(daemon) {
    this.daemon = daemon;
    
    try {
      const mappings = await daemon.getMappings();
      this.l1Cache = { ...mappings };
      this.isInitialized = true;
      console.log('L1 cache preloaded from daemon with', Object.keys(mappings).length, 'mappings');
    } catch (error) {
      console.warn('Failed to preload cache from daemon:', error.message);
      this.l1Cache = { ...FALLBACK_MAPPING };
      this.isInitialized = true;
    }
  }

  get(number) {
    if (number === '0') {
      return { value: ' ', source: 'builtin' };
    }
    
    if (number in this.l1Cache) {
      this.stats.l1Hits++;
      return { value: this.l1Cache[number], source: 'l1' };
    }
    
    const l2Value = this.l2Cache.get(number);
    if (l2Value !== undefined) {
      this.stats.l2Hits++;
      return { value: l2Value, source: 'l2' };
    }
    
    return null;
  }

  set(number, value) {
    this.l2Cache.set(number, value);
  }

  async lookupBulk(numbers) {
    const results = {};
    const toLookup = [];
    
    for (const num of numbers) {
      const cached = this.get(num);
      if (cached) {
        results[num] = cached.value;
      } else {
        toLookup.push(num);
      }
    }
    
    if (toLookup.length === 0) {
      return { results, allCached: true };
    }
    
    if (this.daemon && this.daemon.isReady) {
      try {
        const { results: daemonResults, errors } = await this.daemon.lookupNumbers(toLookup);
        this.stats.daemonHits += toLookup.length;
        
        for (const num of toLookup) {
          const value = daemonResults[num];
          if (value && value !== '?') {
            this.l2Cache.set(num, value);
          }
          results[num] = value || '?';
        }
        
        return { results, errors, allCached: false };
      } catch (error) {
        console.warn('Daemon lookup failed, using fallback:', error.message);
      }
    }
    
    for (const num of toLookup) {
      const value = this.fallbackMapping[num];
      if (value) {
        this.stats.fallbackHits++;
        results[num] = value;
        this.l2Cache.set(num, value);
      } else {
        this.stats.misses++;
        results[num] = '?';
      }
    }
    
    return { results, allCached: false };
  }

  getStats() {
    return {
      ...this.stats,
      l1Size: Object.keys(this.l1Cache).length,
      l2Size: this.l2Cache.size()
    };
  }
}

let fibDaemon = null;
let fibCache = null;

async function initSystem() {
  const cliPath = path.join(__dirname, '../fib-generator/fib-generator.exe');
  
  fibDaemon = new FibDaemon(cliPath);
  fibCache = new FibCache();
  
  try {
    await fibDaemon.start();
    await fibCache.init(fibDaemon);
    console.log('System initialized successfully');
  } catch (error) {
    console.error('Failed to initialize daemon, using fallback mode:', error.message);
    await fibCache.init(fibDaemon);
  }
  
  fibDaemon.on('daemonFailed', () => {
    console.warn('Daemon permanently failed, running in fallback mode');
  });
  
  fibDaemon.on('daemonRestored', () => {
    console.log('Daemon restored after failure');
    fibCache.init(fibDaemon).catch(console.error);
  });
}

function decryptCode(code) {
  const tokens = code.trim().split(/\s+/);
  const uniqueNumbers = [...new Set(tokens.filter(t => t !== '0'))];
  
  return fibCache.lookupBulk(uniqueNumbers).then(({ results, errors }) => {
    let decrypted = '';
    const errorList = errors ? [...errors] : [];
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (token === '0') {
        decrypted += ' ';
        continue;
      }
      
      const letter = results[token];
      if (letter && letter !== '?') {
        decrypted += letter;
      } else {
        decrypted += '?';
        if (!errorList.some(e => e.includes(token))) {
          errorList.push(`Unknown number at position ${i + 1}: ${token}`);
        }
      }
    }
    
    return {
      original: code,
      decrypted: decrypted,
      errors: errorList.length > 0 ? errorList : null
    };
  });
}

app.get('/api/mapping', async (req, res) => {
  try {
    const mapping = { ...fibCache.l1Cache };
    if (fibCache.l2Cache.size() > 0) {
      for (const [key, value] of fibCache.l2Cache.cache) {
        if (!(key in mapping)) {
          mapping[key] = value;
        }
      }
    }
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

app.post('/api/decrypt', async (req, res) => {
  const { code } = req.body;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "code" parameter'
    });
  }
  
  try {
    const result = await decryptCode(code);
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
    daemonReady: fibDaemon ? fibDaemon.isReady : false,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    daemon: fibDaemon ? fibDaemon.getStats() : null,
    cache: fibCache ? fibCache.getStats() : null
  });
});

app.listen(PORT, async () => {
  console.log(`Mystery Code Server running on http://localhost:${PORT}`);
  await initSystem();
  console.log('Server is ready to handle requests');
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  if (fibDaemon) {
    fibDaemon.stop();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (fibDaemon) {
    fibDaemon.stop();
  }
  process.exit(0);
});
