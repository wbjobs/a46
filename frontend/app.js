const API_BASE = '/api';

const codeInput = document.getElementById('codeInput');
const decryptBtn = document.getElementById('decryptBtn');
const clearBtn = document.getElementById('clearBtn');
const exampleBtn = document.getElementById('exampleBtn');
const resultSection = document.getElementById('resultSection');
const originalCode = document.getElementById('originalCode');
const decryptedText = document.getElementById('decryptedText');
const errorSection = document.getElementById('errorSection');
const errorList = document.getElementById('errorList');
const mappingTable = document.getElementById('mappingTable');

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

async function decryptCode() {
    const code = codeInput.value.trim();
    
    if (!code) {
        alert('请输入神秘代码');
        return;
    }
    
    decryptBtn.disabled = true;
    decryptBtn.innerHTML = '<span class="loading"></span>解密中...';
    
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
            showResult(data);
        } else {
            alert('解密失败: ' + data.error);
        }
    } catch (error) {
        console.error('Decryption error:', error);
        alert('解密失败，请检查网络连接');
    } finally {
        decryptBtn.disabled = false;
        decryptBtn.textContent = '解密';
    }
}

function showResult(data) {
    resultSection.style.display = 'block';
    originalCode.textContent = data.original;
    decryptedText.textContent = data.decrypted;
    
    if (data.errors && data.errors.length > 0) {
        errorSection.style.display = 'block';
        errorList.innerHTML = data.errors.map(e => `<li>${e}</li>`).join('');
    } else {
        errorSection.style.display = 'none';
    }
    
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearAll() {
    codeInput.value = '';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    codeInput.focus();
}

function loadExample() {
    const examples = [
        '55 13 377 377 1597 0 89 1597 1597 21',
        '55 13 377 377 1597 0 75025 1597 6765 377 8',
        '89 0 2 610 0 55 13 6765 13',
        '6765 8 2 89 13 0 3 13 21 34 1597 1597 8'
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    codeInput.value = randomExample;
}

decryptBtn.addEventListener('click', decryptCode);
clearBtn.addEventListener('click', clearAll);
exampleBtn.addEventListener('click', loadExample);

codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        decryptCode();
    }
});

loadMapping();
