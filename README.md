# Viso

A clean, brutalist-style AI image generator

## Features

- 🎨 **Multiple Art Styles** - Realistic, Anime, Digital Art, Oil Paint, Watercolor
- 📐 **Aspect Ratios** - 1:1, 16:9, 9:16, 4:3, 3:4
- ⚡ **Fast & Quality Models** - Flux (best) and ZImage (fast)
- ✨ **AI Prompt Enhancer** - Expand simple prompts into detailed descriptions
- 🎲 **Random Prompt Generator** - Get creative ideas instantly
- 📚 **History** - Your last 10 generations saved locally
- 🌙 **Dark Theme** - Neo-brutalist design

## Quick Start

1. Get your free API key from [enter.pollinations.ai](https://enter.pollinations.ai)
2. Replace `POLLINATIONS_KEY` in `app.js` with your key
3. Open `index.html` in your browser
4. Start creating!

## Local Development

```bash
# Simple HTTP server
python3 -m http.server 8000

# Or use any static file server
npx serve .
```

## Deploy

### Vercel
```bash
npm i -g vercel
vercel --prod
```

### Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod
```

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- Pollinations.ai API
- Nova-fast (Bedrock) for prompt enhancement

## License

MIT

---

Made with ❤️ and AI
