const API_BASE = '/api';

let currentMode = 'decrypt';

const codeInput = document.getElementById('codeInput');
const inputLabel = document.getElementById('inputLabel');
const actionBtn = document.getElementById('actionBtn');
const clearBtn = document.getElementById('clearBtn');
const exampleBtn = document.getElementById('exampleBtn');
const decryptModeBtn = document.getElementById('decryptModeBtn');
const encryptModeBtn = document.getElementById('encryptModeBtn');
const resultSection = document.getElementById('resultSection');
const resultTitle = document.getElementById('resultTitle');
const originalLabel = document.getElementById('originalLabel');
const resultLabel = document.getElementById('resultLabel');
const originalCode = document.getElementById('originalCode');
const resultText = document.getElementById('resultText');
const errorSection = document.getElementById('errorSection');
const errorList = document.getElementById('errorList');
const mappingTable = document.getElementById('mappingTable');
const copyBtn = document.getElementById('copyBtn');

const DECRYPT_EXAMPLES = [
    '55 13 377 377 1597 0 89 1597 1597 21',
    '55 13 377 377 1597 0 75025 1597 6765 377 8',
    '89 0 2 610 0 55 13 6765 13',
    '6765 8 2 89 13 0 3 13 21 34 1597 1597 8'
];

const ENCRYPT_EXAMPLES = [
    'HELLO WORLD',
    'MYSTERY CODE',
    'I AM HERE',
    'READ BEFORE USE'
];

function switchMode(mode) {
    currentMode = mode;
    
    if (mode === 'decrypt') {
        decryptModeBtn.classList.add('active');
        encryptModeBtn.classList.remove('active');
        inputLabel.textContent = '输入神秘代码（数字用空格分隔，0代表空格）：';
        codeInput.placeholder = '例如：55 13 377 0 89 13...';
        actionBtn.textContent = '解密';
    } else {
        encryptModeBtn.classList.add('active');
        decryptModeBtn.classList.remove('active');
        inputLabel.textContent = '输入要加密的英文文本（仅支持 A-Z 和空格）：';
        codeInput.placeholder = '例如：HELLO WORLD...';
        actionBtn.textContent = '加密';
    }
    
    clearAll();
}

async function loadMapping() {
    try {
        const response = await fetch(`${API_BASE}/mapping`);
        const data = await response.json();
        
        if (data.success) {
            renderMapping(data.mapping);
        } else {
            mappingTable.innerHTML = '<div class="mapping-loading">加载映射失败</div>';
        }
    } catch (error) {
        console.error('Failed to load mapping:', error);
        mappingTable.innerHTML = '<div class="mapping-loading">加载映射失败</div>';
    }
}

function renderMapping(mapping) {
    const entries = Object.entries(mapping).sort((a, b) => {
        return parseInt(a[0], 10) - parseInt(b[0], 10);
    });
    
    let html = '';
    for (const [number, letter] of entries) {
        html += `
            <div class="mapping-card">
                <div class="mapping-number">${number}</div>
                <div class="mapping-letter">${letter}</div>
            </div>
        `;
    }
    html += `
        <div class="mapping-card">
            <div class="mapping-number">0</div>
            <div class="mapping-letter">空格</div>
        </div>
    `;
    mappingTable.innerHTML = html;
}

async function performAction() {
    if (currentMode === 'decrypt') {
        await decryptCode();
    } else {
        await encryptText();
    }
}

async function decryptCode() {
    const code = codeInput.value.trim();
    
    if (!code) {
        alert('请输入神秘代码');
        return;
    }
    
    actionBtn.disabled = true;
    actionBtn.innerHTML = '<span class="loading"></span>解密中...';
    
    try {
        const response = await fetch(`${API_BASE}/decrypt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showDecryptResult(data);
        } else {
            alert('解密失败: ' + data.error);
        }
    } catch (error) {
        console.error('Decryption error:', error);
        alert('解密失败，请检查网络连接');
    } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = '解密';
    }
}

async function encryptText() {
    const text = codeInput.value.trim();
    
    if (!text) {
        alert('请输入要加密的文本');
        return;
    }
    
    if (!/^[A-Za-z\s]+$/.test(text)) {
        alert('只支持英文字母（A-Z）和空格');
        return;
    }
    
    actionBtn.disabled = true;
    actionBtn.innerHTML = '<span class="loading"></span>加密中...';
    
    try {
        const response = await fetch(`${API_BASE}/encrypt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text.toUpperCase() })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showEncryptResult(data);
        } else {
            alert('加密失败: ' + data.error);
        }
    } catch (error) {
        console.error('Encryption error:', error);
        alert('加密失败，请检查网络连接');
    } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = '加密';
    }
}

function showDecryptResult(data) {
    resultSection.style.display = 'block';
    resultTitle.textContent = '解密结果';
    originalLabel.textContent = '原始代码：';
    resultLabel.textContent = '解密结果：';
    originalCode.textContent = data.original;
    resultText.textContent = data.decrypted;
    
    copyBtn.style.display = 'inline-block';
    copyBtn.textContent = '📋 复制文本';
    copyBtn.classList.remove('copied');
    copyBtn.onclick = () => copyToClipboard(data.decrypted);
    
    if (data.errors && data.errors.length > 0) {
        errorSection.style.display = 'block';
        errorList.innerHTML = data.errors.map(e => `<li>${e}</li>`).join('');
    } else {
        errorSection.style.display = 'none';
    }
    
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showEncryptResult(data) {
    resultSection.style.display = 'block';
    resultTitle.textContent = '加密结果';
    originalLabel.textContent = '原始文本：';
    resultLabel.textContent = '加密结果：';
    originalCode.textContent = data.original;
    resultText.textContent = data.encrypted;
    
    copyBtn.style.display = 'inline-block';
    copyBtn.textContent = '📋 复制代码';
    copyBtn.classList.remove('copied');
    copyBtn.onclick = () => copyToClipboard(data.encrypted);
    
    if (data.errors && data.errors.length > 0) {
        errorSection.style.display = 'block';
        errorList.innerHTML = data.errors.map(e => `<li>${e}</li>`).join('');
    } else {
        errorSection.style.display = 'none';
    }
    
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✅ 已复制！';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            if (currentMode === 'decrypt') {
                copyBtn.textContent = '📋 复制文本';
            } else {
                copyBtn.textContent = '📋 复制代码';
            }
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('复制失败');
    });
}

function clearAll() {
    codeInput.value = '';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    codeInput.focus();
}

function loadExample() {
    const examples = currentMode === 'decrypt' ? DECRYPT_EXAMPLES : ENCRYPT_EXAMPLES;
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    codeInput.value = randomExample;
}

decryptModeBtn.addEventListener('click', () => switchMode('decrypt'));
encryptModeBtn.addEventListener('click', () => switchMode('encrypt'));
actionBtn.addEventListener('click', performAction);
clearBtn.addEventListener('click', clearAll);
exampleBtn.addEventListener('click', loadExample);

codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        performAction();
    }
});

loadMapping();
