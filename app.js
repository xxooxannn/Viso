// ⚠️ WARNING: API keys are exposed in client-side code. For production, use a backend proxy.
// Pollinations.ai API (2026): Get your API key at https://enter.pollinations.ai
// pk_ = Publishable key (client-side, rate limited to 1 pollen per IP per hour)
// sk_ = Secret key (server-side only, no rate limits)
// ⚠️ IMPORTANT: Restrict this key to your domain at enter.pollinations.ai
const IMAGE_URL = 'https://gen.pollinations.ai';
const TEXT_URL = 'https://gen.pollinations.ai/v1/chat/completions';
const POLLINATIONS_KEY = 'pk_AcdSEDf5knIFbQ8n'; // ⚠️ Replace with YOUR Pollinations API key

// Security Helper
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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
        const res = await fetch(TEXT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${POLLINATIONS_KEY}`
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: sysPrompt }],
                model: 'nova-fast'
            })
        });
        if (!res.ok) throw new Error(`Text API error: ${res.status}`);
        const data = await res.json();
        const surprisePrompt = data.choices[0].message.content;

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

        const res = await fetch(TEXT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${POLLINATIONS_KEY}`
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: sysPrompt }],
                model: 'nova-fast'
            })
        });
        if (!res.ok) throw new Error(`Text API error: ${res.status}`);
        const data = await res.json();
        const enhancedContext = data.choices[0].message.content;

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
    const negativePromptValue = document.getElementById('negativePrompt') ? document.getElementById('negativePrompt').value.trim() : '';
    const batchSize = document.getElementById('batchSize') ? parseInt(document.getElementById('batchSize').value, 10) : 1;
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

        // Check prompt length (Pollinations has limits)
        if (finalPrompt.length > 2000) {
            throw new Error(`Prompt too long (${finalPrompt.length} chars). Max is ~2000 characters.`);
        }

        const batchContainer = document.createElement('div');
        batchContainer.style.display = 'grid';
        batchContainer.style.gridTemplateColumns = batchSize > 1 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr';
        batchContainer.style.gap = '16px';
        resultContent.appendChild(batchContainer);

        let firstUrl = null;

        for (let i = 0; i < batchSize; i++) {
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
            if (negativePromptValue) {
                params.append('negative_prompt', negativePromptValue);
            }
            const fullUrl = `${imageUrl}?${params.toString()}`;

            if (i === 0) firstUrl = fullUrl;

            const imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            imgContainer.innerHTML = `
                <img src="${escapeHTML(fullUrl)}" alt="Generated image ${i+1}" class="result-image"
                     style="opacity:0;transition:opacity 0.5s;"
                     crossorigin="anonymous">
                <div class="imgLoadingMsg" style="color:#aaa;font-size:0.9rem;margin-top:8px;">\u23f3 Loading image ${i+1}...</div>
                <div class="actions" style="margin-top:8px;">
                    <button class="action-btn btnDownloadSpecific" data-url="${escapeHTML(fullUrl)}">\u2b07\ufe0f Download</button>
                </div>
            `;
            batchContainer.appendChild(imgContainer);

            const imgEl = imgContainer.querySelector('img');
            const msgEl = imgContainer.querySelector('.imgLoadingMsg');

            imgEl.onload = () => {
                imgEl.style.opacity = 1;
                msgEl.style.display = 'none';
            };

            imgEl.onerror = (e) => {
                console.error(`[Image ${i+1}] Load failed:`, e);
                msgEl.textContent = `⚠️ Image ${i+1} failed to load.`;
            };

            // Save to history
            saveToHistory(finalPrompt, fullUrl);
        }

        generatedImageUrl = firstUrl;

        const globalActions = document.createElement('div');
        globalActions.innerHTML = `
            <div class="actions" style="margin-top: 16px;">
                <button class="action-btn" id="btnCopyPrompt">\ud83d\udccb Copy Prompt</button>
                <button class="action-btn" id="btnRegenerate">\ud83d\udd04 Regenerate</button>
            </div>
            <div style="margin-top:15px;font-size:0.85rem;color:#888;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;">
                <strong>Prompt used:</strong> ${escapeHTML(finalPrompt)}
                ${negativePromptValue ? `<br><strong style="margin-top:4px;display:inline-block;">Negative prompt:</strong> ${escapeHTML(negativePromptValue)}` : ''}
            </div>
            <div style="margin-top:8px;font-size:0.75rem;color:#666;background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                <span><strong>Model:</strong> ${escapeHTML(model)}</span>
                <span><strong>Size:</strong> ${escapeHTML(selectedRatio.width)}x${escapeHTML(selectedRatio.height)} (${escapeHTML(selectedRatio.ratio)})</span>
            </div>
        `;
        resultContent.appendChild(globalActions);

        // Setup action button listeners
        document.getElementById('btnCopyPrompt').addEventListener('click', () => copyText(finalPrompt));
        document.getElementById('btnRegenerate').addEventListener('click', generateImage);

        // Setup individual download buttons
        document.querySelectorAll('.btnDownloadSpecific').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.target.getAttribute('data-url');
                downloadSpecificImage(url);
            });
        });

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
            <img src="${escapeHTML(item.url)}" alt="History item" loading="lazy">
            <div class="prompt-text" title="${escapeHTML(item.prompt)}">${escapeHTML(item.prompt)}</div>
            <div class="meta-text">
                <span>${escapeHTML(item.timestamp)}</span>
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
        <img src="${escapeHTML(item.url)}" alt="Generated image" class="result-image">
        <div class="actions">
            <button class="action-btn" id="btnDownloadHistory">⬇️ Download</button>
            <button class="action-btn" id="btnCopyHistory">📋 Copy Prompt</button>
        </div>
        <div style="margin-top: 15px; font-size: 0.85rem; color: #888; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
            <strong>Prompt used:</strong> ${escapeHTML(item.prompt)}
        </div>
    `;

    document.getElementById('btnDownloadHistory').addEventListener('click', downloadImage);
    document.getElementById('btnCopyHistory').addEventListener('click', () => copyText(item.prompt));

    // Scroll to results
    resultArea.scrollIntoView({ behavior: 'smooth' });
}

function showError(message) {
    resultContent.innerHTML = `<div class="error">⚠️ ${escapeHTML(message)}</div>`;
}

async function downloadImage() {
    if (!generatedImageUrl) return;
    await downloadSpecificImage(generatedImageUrl);
}

async function downloadSpecificImage(targetUrl) {
    if (!targetUrl) return;

    try {
        const response = await fetch(targetUrl);
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
        window.open(targetUrl, '_blank');
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