// ⚠️ WARNING: API keys are exposed in client-side code. For production, use a backend proxy.
// Pollinations.ai API (2026): Get your API key at https://enter.pollinations.ai
// pk_ = Publishable key (client-side, rate limited to 1 pollen per IP per hour)
// sk_ = Secret key (server-side only, no rate limits)
// ⚠️ IMPORTANT: Restrict this key to your domain at enter.pollinations.ai
const IMAGE_URL = 'https://gen.pollinations.ai';
const TEXT_URL = 'https://gen.pollinations.ai/text';
const POLLINATIONS_KEY = 'pk_pFTa9RWkfLIkPq2f'; // ⚠️ Replace with YOUR Pollinations API key

// State
let currentMode = 'free';
let selectedStyle = '';
let selectedRatio = { width: 1024, height: 1024, ratio: '1:1' };
let generatedImageUrl = null;
let historyList = JSON.parse(localStorage.getItem('polliprompt_history')) || [];

// DOM Elements
const promptInput = document.getElementById('prompt');
const styleOptions = document.querySelectorAll('.pill');
const generateBtn = document.getElementById('generateBtn');
const resultContent = document.getElementById('resultContent');
const resultArea = document.querySelector('.result-area');
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const btnSurpriseMe = document.getElementById('btnSurpriseMe');
const btnEnhance = document.getElementById('btnEnhance');
const enhancedPromptBox = document.getElementById('enhancedPromptBox');
const enhancedPromptText = document.getElementById('enhancedPromptText');
const btnUseOriginal = document.getElementById('btnUseOriginal');
const isActiveEnhanced = document.getElementById('isActiveEnhanced');
const historyListEl = document.getElementById('historyList');
const btnClearHistory = document.getElementById('btnClearHistory');

// Initialize
function init() {
    renderHistory();

    // Setup listeners
    styleOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedStyle = btn.dataset.style;
        });
    });

    // Aspect ratio listeners
    const ratioOptions = document.querySelectorAll('.ratio-btn');
    ratioOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRatio = {
                ratio: btn.dataset.ratio,
                width: parseInt(btn.dataset.width),
                height: parseInt(btn.dataset.height)
            };
            // Save preference
            localStorage.setItem('polliprompt_ratio', JSON.stringify(selectedRatio));
        });
    });
    
    // Load saved ratio preference
    const savedRatio = localStorage.getItem('polliprompt_ratio');
    if (savedRatio) {
        const parsed = JSON.parse(savedRatio);
        const matchingBtn = document.querySelector(`.ratio-btn[data-ratio="${parsed.ratio}"]`);
        if (matchingBtn) {
            document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            matchingBtn.classList.add('active');
            selectedRatio = parsed;
        }
    }

    generateBtn.addEventListener('click', generateImage);

    // Test API button
    const btnTestApi = document.getElementById('btnTestApi');
    const apiStatus = document.getElementById('apiStatus');
    if (btnTestApi) {
        btnTestApi.addEventListener('click', testApiConnection);
    }

    // Feature listeners
    btnSurpriseMe.addEventListener('click', handleSurpriseMe);
    btnEnhance.addEventListener('click', handleEnhancePrompt);
    btnUseOriginal.addEventListener('click', () => {
        isActiveEnhanced.value = "false";
        enhancedPromptBox.classList.remove('active');
    });
    
    // Clear history listener
    if (btnClearHistory) {
        btnClearHistory.addEventListener('click', () => {
            if (confirm('Clear all history? This cannot be undone.')) {
                historyList = [];
                localStorage.removeItem('polliprompt_history');
                renderHistory();
            }
        });
    }
}

// Surprise Me
async function handleSurpriseMe() {
    btnSurpriseMe.disabled = true;
    btnSurpriseMe.textContent = '🎲 Generating...';
    
    const randomSeed = Math.floor(Math.random() * 1000000);
    const sysPrompt = `You are a creative AI prompt generator. Generate ONE random, creative, and visually interesting image prompt. Make it unique and unexpected. Include interesting subjects, lighting, mood, and artistic style. Keep it under 150 characters. Reply ONLY with the prompt text, nothing else.

Random seed: ${randomSeed}

Examples of what NOT to return:
- "Here's a prompt:"
- Quotes around the prompt
- Multiple prompts

Just return one creative prompt like:
"A cyberpunk street food vendor in neon-lit Tokyo alleyway, rain reflections, cinematic lighting, photorealistic"`;

    try {
        const url = `${TEXT_URL}/${encodeURIComponent(sysPrompt)}?model=nova-fast&key=${POLLINATIONS_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Text API error: ${res.status}`);
        const surprisePrompt = await res.text();

        promptInput.value = surprisePrompt.trim();
        isActiveEnhanced.value = "false";
        enhancedPromptBox.classList.remove('active');

    } catch (err) {
        console.error("Surprise Me failed:", err);
        // Fallback to hardcoded prompts if API fails
        const fallbackPrompts = [
            "A cyberpunk samurai drinking tea in a neon garden",
            "A giant bioluminescent whale flying through space",
            "A cozy hobbit hole made of glass in a futuristic city",
            "A cat astronaut exploring Mars with tiny rover",
            "A mysterious wizard hacker in a digital realm",
            "An ancient dragon sleeping on a pile of vintage computers"
        ];
        promptInput.value = fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)];
        alert('Using offline prompts. Try again later for AI-generated surprises!');
    } finally {
        btnSurpriseMe.disabled = false;
        btnSurpriseMe.textContent = '🎲 Surprise Me';
    }
}

// Enhance Prompt
async function handleEnhancePrompt() {
    const currentPrompt = promptInput.value.trim();
    if (!currentPrompt) {
        alert("Please enter a basic prompt first.");
        return;
    }

    // Build style instruction based on selected style
    let styleSection = '';
    if (selectedStyle) {
        styleSection = `
STYLE REQUIREMENT: ${selectedStyle}

IMPORTANT: You MUST incorporate this style into the enhanced prompt. Use keywords like brushstrokes, texture, color palette, and artistic techniques that match "${selectedStyle}". Do NOT just mention the style - actually write the prompt IN that style.
`;
    }

    const sysPrompt = `You are an expert AI image prompt engineer. Your task is to EXPAND and ENHANCE the user's prompt below.

RULES:
1. KEEP the original subject, characters, and main elements from the user's prompt
2. Add vivid details about lighting, mood, atmosphere, camera angles
3. ${selectedStyle ? 'INCORPORATE the style keywords throughout the prompt' : 'Add artistic style keywords'}
4. Reply ONLY with the enhanced prompt text - no quotes, no preamble, no explanations

${styleSection}
USER'S PROMPT TO ENHANCE:
"${currentPrompt}"

Enhanced version (rich, detailed, ready for image generation):`;

    try {
        btnEnhance.disabled = true;
        btnEnhance.textContent = "✨ Enhancing...";

        const url = `${TEXT_URL}/${encodeURIComponent(sysPrompt)}?model=nova-fast&key=${POLLINATIONS_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Text API error: ${res.status}`);
        const enhancedContext = await res.text();

        enhancedPromptText.textContent = enhancedContext.trim();
        enhancedPromptBox.classList.add('active');
        isActiveEnhanced.value = "true";

    } catch (err) {
        console.error("Enhancement failed:", err);
        alert(`Failed to enhance prompt: ${err.message}`);
    } finally {
        btnEnhance.disabled = false;
        btnEnhance.textContent = "✨ AI Enhance";
    }
}

// Generate Image
async function generateImage() {
    resultArea.style.display = 'block';
    const basePrompt = promptInput.value.trim();
    const model = document.getElementById('model').value;

    if (!basePrompt) {
        showError('Please enter a description to generate an image.');
        return;
    }

    let finalPrompt = basePrompt;
    
    // Add enhanced prompt if active (style already included in enhancement)
    if (isActiveEnhanced.value === "true") {
        finalPrompt = enhancedPromptText.textContent.trim();
    } else if (selectedStyle) {
        // Only add style if NOT using enhanced prompt
        finalPrompt += `, ${selectedStyle}`;
    }

    loadingEl.classList.add('active');
    resultContent.innerHTML = '';
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        const encodedPrompt = encodeURIComponent(finalPrompt);
        const seed = Math.floor(Math.random() * 100000);
        const imageUrl = `${IMAGE_URL}/image/${encodedPrompt}`;
        const params = new URLSearchParams({
            model: model,
            seed: seed.toString(),
            width: selectedRatio.width.toString(),
            height: selectedRatio.height.toString(),
            nologo: 'true',
            key: POLLINATIONS_KEY
        });
        const fullUrl = `${imageUrl}?${params.toString()}`;

        // Check prompt length (Pollinations has limits)
        if (finalPrompt.length > 2000) {
            throw new Error(`Prompt too long (${finalPrompt.length} chars). Max is ~2000 characters.`);
        }

        generatedImageUrl = fullUrl;

        resultContent.innerHTML = `
            <div style="position:relative;">
                <img src="${fullUrl}" alt="Generated image" class="result-image"
                     id="resultImage"
                     style="opacity:0;transition:opacity 0.5s;"
                     crossorigin="anonymous">
                <div id="imgLoadingMsg" style="color:#aaa;font-size:0.9rem;margin-top:8px;">\u23f3 Loading image... (may take 10\u201330 seconds)</div>
            </div>
            <div class="actions">
                <button class="action-btn" id="btnDownload">\u2b07\ufe0f Download</button>
                <button class="action-btn" id="btnCopyPrompt">\ud83d\udccb Copy Prompt</button>
                <button class="action-btn" id="btnRegenerate">\ud83d\udd04 Regenerate</button>
            </div>
            <div style="margin-top:15px;font-size:0.85rem;color:#888;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;">
                <strong>Prompt used:</strong> ${finalPrompt}
            </div>
            <div style="margin-top:8px;font-size:0.75rem;color:#666;background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                <span><strong>Model:</strong> ${model}</span>
                <span><strong>Size:</strong> ${selectedRatio.width}x${selectedRatio.height} (${selectedRatio.ratio})</span>
            </div>
        `;

        // Setup image load handlers with better error info
        const resultImage = document.getElementById('resultImage');
        const imgLoadingMsg = document.getElementById('imgLoadingMsg');

        resultImage.onload = () => {
            resultImage.style.opacity = 1;
            imgLoadingMsg.style.display = 'none';
        };

        resultImage.onerror = (e) => {
            console.error('[Image] Load failed:', e);
            console.error('[Image] URL:', fullUrl);
            imgLoadingMsg.textContent = `⚠️ Image failed to load. Prompt: ${finalPrompt.length} chars. Try a shorter prompt or different model.`;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Image';
        };

        // Setup action button listeners
        document.getElementById('btnDownload').addEventListener('click', downloadImage);
        document.getElementById('btnCopyPrompt').addEventListener('click', () => copyText(finalPrompt));
        document.getElementById('btnRegenerate').addEventListener('click', generateImage);

        // Save to history
        saveToHistory(finalPrompt, fullUrl);

    } catch (err) {
        showError(`Failed to generate image: ${err.message}`);
        console.error('[Image] Error:', err);
    } finally {
        loadingEl.classList.remove('active');
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Image';
    }
}

function saveToHistory(prompt, url) {
    const newItem = {
        id: Date.now(),
        prompt: prompt,
        url: url,
        timestamp: new Date().toLocaleString()
    };

    // Keep last 10 items to prevent lag
    historyList.unshift(newItem);
    if (historyList.length > 10) historyList.pop();

    localStorage.setItem('polliprompt_history', JSON.stringify(historyList));
    renderHistory();
}

function renderHistory() {
    if (historyList.length === 0) {
        historyListEl.innerHTML = '<p style="color: #aaa; font-size: 0.9rem; text-align: center; padding: 20px 0;">No history yet. Start generating!</p>';
        return;
    }

    historyListEl.innerHTML = historyList.map((item, index) => `
        <div class="history-item" data-index="${index}">
            <img src="${item.url}" alt="History item" loading="lazy">
            <div class="prompt-text" title="${item.prompt}">${item.prompt}</div>
            <div class="meta-text">
                <span>${item.timestamp}</span>
            </div>
        </div>
    `).join('');

    // Event delegation for history items
    historyListEl.querySelectorAll('.history-item[data-index]').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-index'), 10);
            loadHistoryItem(historyList[idx]);
        });
    });
}

function loadHistoryItem(item) {
    if (!item) return;

    resultArea.style.display = 'block';

    // Reset enhancements UI
    isActiveEnhanced.value = "false";
    enhancedPromptBox.classList.remove('active');
    promptInput.value = item.prompt.split(',')[0].trim();

    generatedImageUrl = item.url;
    resultContent.innerHTML = `
        <img src="${item.url}" alt="Generated image" class="result-image">
        <div class="actions">
            <button class="action-btn" id="btnDownloadHistory">⬇️ Download</button>
            <button class="action-btn" id="btnCopyHistory">📋 Copy Prompt</button>
        </div>
        <div style="margin-top: 15px; font-size: 0.85rem; color: #888; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
            <strong>Prompt used:</strong> ${item.prompt}
        </div>
    `;

    document.getElementById('btnDownloadHistory').addEventListener('click', downloadImage);
    document.getElementById('btnCopyHistory').addEventListener('click', () => copyText(item.prompt));

    // Scroll to results
    resultArea.scrollIntoView({ behavior: 'smooth' });
}

function showError(message) {
    resultContent.innerHTML = `<div class="error">⚠️ ${message}</div>`;
}

async function downloadImage() {
    if (!generatedImageUrl) return;

    try {
        const response = await fetch(generatedImageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `polliprompt-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Download failed, falling back to new tab", err);
        window.open(generatedImageUrl, '_blank');
    }
}

function copyText(text) {
    navigator.clipboard.writeText(text);
    alert('Prompt copied to clipboard!');
}

async function testApiConnection() {
    const apiStatus = document.getElementById('apiStatus');
    const btnTestApi = document.getElementById('btnTestApi');
    
    if (!apiStatus || !btnTestApi) return;
    
    btnTestApi.disabled = true;
    btnTestApi.textContent = '🔍 Testing...';
    apiStatus.textContent = 'Testing Pollinations API connection...';
    apiStatus.style.color = '#aaa';
    
    try {
        // Test with a simple image request (includes API key)
        const testParams = new URLSearchParams({
            model: 'flux',
            width: '100',
            height: '100',
            seed: '123',
            key: POLLINATIONS_KEY
        });
        const testUrl = `${IMAGE_URL}/image/test?${testParams.toString()}`;

        const response = await fetch(testUrl, { method: 'HEAD' });

        if (response.ok) {
            apiStatus.textContent = '✅ API is working! You can generate images.';
            apiStatus.style.color = '#4ade80';
        } else {
            apiStatus.textContent = `⚠️ API returned status: ${response.status}`;
            apiStatus.style.color = '#fbbf24';
        }
    } catch (err) {
        apiStatus.textContent = '❌ API connection failed. Check your internet or try again later.';
        apiStatus.style.color = '#f87171';
    } finally {
        btnTestApi.disabled = false;
        btnTestApi.textContent = '🔍 Test API Connection';
    }
}

// Allow Enter key to submit (but not in textarea normally)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        generateImage();
    }
});

// Run Init
document.addEventListener('DOMContentLoaded', init);