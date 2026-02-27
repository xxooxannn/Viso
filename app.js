// ⚠️ WARNING: API keys are exposed in client-side code. For production, use a backend proxy.
// Pollinations.ai API (2026): Get your API key at https://enter.pollinations.ai
// pk_ = Publishable key (client-side, rate limited to 1 pollen per IP per hour)
// sk_ = Secret key (server-side only, no rate limits)
// ⚠️ IMPORTANT: Restrict this key to your domain at enter.pollinations.ai
const IMAGE_URL = 'https://gen.pollinations.ai';
const TEXT_URL = 'https://gen.pollinations.ai/text';
const POLLINATIONS_KEY = 'pk_pFTa9RWkfLIkPq2f'; // ⚠️ Replace with YOUR Pollinations API key

// --- Utilities ---

/**
 * Escapes HTML special characters to prevent XSS when injecting
 * user-controlled strings into innerHTML.
 */
function sanitizeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Shows a temporary toast notification instead of blocking alert().
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
}

// --- Safe localStorage helpers ---

function loadHistoryFromStorage() {
    try {
        return JSON.parse(localStorage.getItem('polliprompt_history')) || [];
    } catch {
        return [];
    }
}

function loadRatioFromStorage() {
    try {
        const raw = localStorage.getItem('polliprompt_ratio');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

// --- State ---
let currentMode = 'free';
let selectedStyle = '';
let selectedRatio = { width: 1024, height: 1024, ratio: '1:1' };
let generatedImageUrl = null;
let historyList = loadHistoryFromStorage();

// --- DOM Elements ---
const promptInput = document.getElementById('prompt');
const styleOptions = document.querySelectorAll('.pill');
const generateBtn = document.getElementById('generateBtn');
const resultContent = document.getElementById('resultContent');
const resultArea = document.querySelector('.result-area');
const loadingEl = document.getElementById('loading');
const btnSurpriseMe = document.getElementById('btnSurpriseMe');
const btnEnhance = document.getElementById('btnEnhance');
const enhancedPromptBox = document.getElementById('enhancedPromptBox');
const enhancedPromptText = document.getElementById('enhancedPromptText');
const btnUseOriginal = document.getElementById('btnUseOriginal');
const isActiveEnhanced = document.getElementById('isActiveEnhanced');
const historyListEl = document.getElementById('historyList');
const btnClearHistory = document.getElementById('btnClearHistory');

// --- Initialize ---
function init() {
    renderHistory();

    // Style pill listeners
    styleOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            selectedStyle = btn.dataset.style || '';
        });
    });

    // Aspect ratio listeners
    const ratioOptions = document.querySelectorAll('.ratio-btn');
    ratioOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ratio-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            selectedRatio = {
                ratio: btn.dataset.ratio,
                width: parseInt(btn.dataset.width, 10),
                height: parseInt(btn.dataset.height, 10)
            };
            localStorage.setItem('polliprompt_ratio', JSON.stringify(selectedRatio));
        });
    });

    // Load saved ratio preference
    const savedRatio = loadRatioFromStorage();
    if (savedRatio) {
        const matchingBtn = document.querySelector(`.ratio-btn[data-ratio="${savedRatio.ratio}"]`);
        if (matchingBtn) {
            document.querySelectorAll('.ratio-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            matchingBtn.classList.add('active');
            matchingBtn.setAttribute('aria-pressed', 'true');
            selectedRatio = savedRatio;
        }
    }

    generateBtn.addEventListener('click', generateImage);

    // Test API button
    const btnTestApi = document.getElementById('btnTestApi');
    if (btnTestApi) {
        btnTestApi.addEventListener('click', testApiConnection);
    }

    // Feature listeners
    btnSurpriseMe.addEventListener('click', handleSurpriseMe);
    btnEnhance.addEventListener('click', handleEnhancePrompt);
    btnUseOriginal.addEventListener('click', () => {
        isActiveEnhanced.value = 'false';
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

// --- Surprise Me ---
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
        isActiveEnhanced.value = 'false';
        enhancedPromptBox.classList.remove('active');

    } catch (err) {
        console.error('Surprise Me failed:', err);
        const fallbackPrompts = [
            'A cyberpunk samurai drinking tea in a neon garden',
            'A giant bioluminescent whale flying through space',
            'A cozy hobbit hole made of glass in a futuristic city',
            'A cat astronaut exploring Mars with tiny rover',
            'A mysterious wizard hacker in a digital realm',
            'An ancient dragon sleeping on a pile of vintage computers'
        ];
        promptInput.value = fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)];
        showToast('Using offline prompts. Try again later for AI-generated surprises!', 'info');
    } finally {
        btnSurpriseMe.disabled = false;
        btnSurpriseMe.textContent = '🎲 Random';
    }
}

// --- Enhance Prompt ---
async function handleEnhancePrompt() {
    const currentPrompt = promptInput.value.trim();
    if (!currentPrompt) {
        showToast('Please enter a basic prompt first.', 'error');
        return;
    }

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
        btnEnhance.textContent = '✨ Enhancing...';

        const url = `${TEXT_URL}/${encodeURIComponent(sysPrompt)}?model=nova-fast&key=${POLLINATIONS_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Text API error: ${res.status}`);
        const enhancedContext = await res.text();

        enhancedPromptText.textContent = enhancedContext.trim();
        enhancedPromptBox.classList.add('active');
        isActiveEnhanced.value = 'true';

    } catch (err) {
        console.error('Enhancement failed:', err);
        showToast(`Failed to enhance prompt: ${err.message}`, 'error');
    } finally {
        btnEnhance.disabled = false;
        btnEnhance.textContent = '✨ AI Enhance';
    }
}

// --- Generate Image ---
async function generateImage() {
    const basePrompt = promptInput.value.trim();
    const model = document.getElementById('model').value;

    // Validate before showing result area
    if (!basePrompt) {
        showError('Please enter a description to generate an image.');
        return;
    }

    resultArea.style.display = 'block';

    let finalPrompt = basePrompt;

    // Use enhanced prompt if active (style already included in enhancement)
    if (isActiveEnhanced.value === 'true') {
        finalPrompt = enhancedPromptText.textContent.trim();
    } else if (selectedStyle) {
        finalPrompt += `, ${selectedStyle}`;
    }

    loadingEl.classList.add('active');
    resultContent.innerHTML = '';
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        // Check prompt length (Pollinations has limits)
        if (finalPrompt.length > 2000) {
            throw new Error(`Prompt too long (${finalPrompt.length} chars). Max is ~2000 characters.`);
        }

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

        generatedImageUrl = fullUrl;

        // Build result DOM safely — no inline styles, uses CSS classes
        const wrapper = document.createElement('div');

        const imgWrap = document.createElement('div');
        imgWrap.style.position = 'relative';

        const img = document.createElement('img');
        img.src = fullUrl;
        img.alt = sanitizeHTML(finalPrompt);
        img.className = 'result-image';
        img.id = 'resultImage';
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.5s';
        img.crossOrigin = 'anonymous';

        const imgLoadingMsg = document.createElement('div');
        imgLoadingMsg.id = 'imgLoadingMsg';
        imgLoadingMsg.className = 'img-loading-msg';
        imgLoadingMsg.textContent = '⏳ Loading image... (may take 10–30 seconds)';

        img.onload = () => {
            img.style.opacity = '1';
            imgLoadingMsg.style.display = 'none';
        };

        img.onerror = (e) => {
            console.error('[Image] Load failed:', e);
            console.error('[Image] URL:', fullUrl);
            imgLoadingMsg.textContent = `⚠️ Image failed to load. Prompt: ${finalPrompt.length} chars. Try a shorter prompt or different model.`;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Image';
        };

        imgWrap.appendChild(img);
        imgWrap.appendChild(imgLoadingMsg);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const btnDownload = document.createElement('button');
        btnDownload.className = 'action-btn';
        btnDownload.id = 'btnDownload';
        btnDownload.textContent = '⬇️ Download';
        btnDownload.addEventListener('click', downloadImage);

        const btnCopyPrompt = document.createElement('button');
        btnCopyPrompt.className = 'action-btn';
        btnCopyPrompt.id = 'btnCopyPrompt';
        btnCopyPrompt.textContent = '📋 Copy Prompt';
        btnCopyPrompt.addEventListener('click', () => copyText(finalPrompt));

        const btnRegenerate = document.createElement('button');
        btnRegenerate.className = 'action-btn';
        btnRegenerate.id = 'btnRegenerate';
        btnRegenerate.textContent = '🔄 Regenerate';
        btnRegenerate.addEventListener('click', generateImage);

        actions.appendChild(btnDownload);
        actions.appendChild(btnCopyPrompt);
        actions.appendChild(btnRegenerate);

        const promptMeta = document.createElement('div');
        promptMeta.className = 'prompt-meta';
        const promptLabel = document.createElement('strong');
        promptLabel.textContent = 'Prompt used:';
        const promptVal = document.createTextNode(' ' + finalPrompt);
        promptMeta.appendChild(promptLabel);
        promptMeta.appendChild(promptVal);

        const modelMeta = document.createElement('div');
        modelMeta.className = 'model-meta';
        const modelSpan = document.createElement('span');
        modelSpan.innerHTML = `<strong>Model:</strong> ${sanitizeHTML(model)}`;
        const sizeSpan = document.createElement('span');
        sizeSpan.innerHTML = `<strong>Size:</strong> ${selectedRatio.width}x${selectedRatio.height} (${sanitizeHTML(selectedRatio.ratio)})`;
        modelMeta.appendChild(modelSpan);
        modelMeta.appendChild(sizeSpan);

        wrapper.appendChild(imgWrap);
        wrapper.appendChild(actions);
        wrapper.appendChild(promptMeta);
        wrapper.appendChild(modelMeta);

        resultContent.innerHTML = '';
        resultContent.appendChild(wrapper);

        // Save to history
        saveToHistory(basePrompt, finalPrompt, fullUrl);

    } catch (err) {
        showError(`Failed to generate image: ${err.message}`);
        console.error('[Image] Error:', err);
    } finally {
        loadingEl.classList.remove('active');
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Image';
    }
}

// --- History ---

function saveToHistory(originalPrompt, finalPrompt, url) {
    const newItem = {
        id: Date.now(),
        originalPrompt: originalPrompt,
        prompt: finalPrompt,
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
        historyListEl.innerHTML = '';
        const empty = document.createElement('p');
        empty.style.cssText = 'color:#aaa;font-size:0.9rem;text-align:center;padding:20px 0;';
        empty.textContent = 'No history yet. Start generating!';
        historyListEl.appendChild(empty);
        return;
    }

    historyListEl.innerHTML = '';

    historyList.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.dataset.index = index;
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `Load: ${item.originalPrompt || item.prompt}`);

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = sanitizeHTML(item.originalPrompt || item.prompt);
        img.loading = 'lazy';

        const promptDiv = document.createElement('div');
        promptDiv.className = 'history-prompt';
        promptDiv.title = item.originalPrompt || item.prompt;
        promptDiv.textContent = item.originalPrompt || item.prompt;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'history-meta';

        const timeSpan = document.createElement('span');
        timeSpan.textContent = item.timestamp;
        metaDiv.appendChild(timeSpan);

        el.appendChild(img);
        el.appendChild(promptDiv);
        el.appendChild(metaDiv);

        const handleLoad = () => loadHistoryItem(historyList[index]);
        el.addEventListener('click', handleLoad);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleLoad();
            }
        });

        historyListEl.appendChild(el);
    });
}

function loadHistoryItem(item) {
    if (!item) return;

    resultArea.style.display = 'block';

    // Reset enhancements UI
    isActiveEnhanced.value = 'false';
    enhancedPromptBox.classList.remove('active');

    // Restore original prompt (not the potentially-comma-heavy final prompt)
    promptInput.value = item.originalPrompt || item.prompt;

    generatedImageUrl = item.url;

    // Build result DOM safely
    const wrapper = document.createElement('div');

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = sanitizeHTML(item.originalPrompt || item.prompt);
    img.className = 'result-image';

    const actions = document.createElement('div');
    actions.className = 'actions';

    const btnDownloadHistory = document.createElement('button');
    btnDownloadHistory.className = 'action-btn';
    btnDownloadHistory.id = 'btnDownloadHistory';
    btnDownloadHistory.textContent = '⬇️ Download';
    btnDownloadHistory.addEventListener('click', downloadImage);

    const btnCopyHistory = document.createElement('button');
    btnCopyHistory.className = 'action-btn';
    btnCopyHistory.id = 'btnCopyHistory';
    btnCopyHistory.textContent = '📋 Copy Prompt';
    btnCopyHistory.addEventListener('click', () => copyText(item.prompt));

    actions.appendChild(btnDownloadHistory);
    actions.appendChild(btnCopyHistory);

    const promptMeta = document.createElement('div');
    promptMeta.className = 'prompt-meta';
    const promptLabel = document.createElement('strong');
    promptLabel.textContent = 'Prompt used:';
    const promptVal = document.createTextNode(' ' + item.prompt);
    promptMeta.appendChild(promptLabel);
    promptMeta.appendChild(promptVal);

    wrapper.appendChild(img);
    wrapper.appendChild(actions);
    wrapper.appendChild(promptMeta);

    resultContent.innerHTML = '';
    resultContent.appendChild(wrapper);

    resultArea.scrollIntoView({ behavior: 'smooth' });
}

// --- Helpers ---

function showError(message) {
    resultArea.style.display = 'block';
    resultContent.innerHTML = `<div class="error">⚠️ ${sanitizeHTML(message)}</div>`;
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
        console.error('Download failed, falling back to new tab', err);
        window.open(generatedImageUrl, '_blank');
    }
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Prompt copied to clipboard!', 'success');
    } catch (err) {
        // Fallback for HTTP or denied permission
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Prompt copied to clipboard!', 'success');
        } catch {
            showToast('Could not copy — please copy manually.', 'error');
        }
    }
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
        btnTestApi.textContent = '🔍 Test Connection';
    }
}

// Allow Ctrl+Enter to submit
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        generateImage();
    }
});

// Run Init
document.addEventListener('DOMContentLoaded', init);
