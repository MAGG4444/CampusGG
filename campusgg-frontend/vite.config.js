import { defineConfig } from 'vite'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

// Explicit allowlist: these files are local-only and are never copied to dist.
const previewFiles = {
  valorant: 'valorant.png',
  'league-of-legends': 'league-of-legends.png',
  'counter-strike-2': 'counter-strike-2.jpg',
  dota: 'dota.jpg',
  minecraft: 'minecraft.jpg',
  'it-takes-two': 'it-takes-two.webp',
  'overwatch-2': 'overwatch-2.svg',
  'rocket-league': 'rocket-league.svg',
}

export default defineConfig({
  plugins: [{
    name: 'local-channel-art-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__channel-logo-preview', async (req, res, next) => {
        if (process.env.VITE_CHANNEL_LOGO_PREVIEW !== '1') return next()
        const name = previewFiles[decodeURIComponent((req.url || '').split('?')[0].slice(1))]
        if (!name) return next()
        try {
          const data = await readFile(path.resolve('local-game-art', name))
          const type = name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
          res.setHeader('Content-Type', type)
          res.setHeader('Cache-Control', 'no-store')
          res.end(data)
        } catch { next() }
      })
    },
  }],
  // Existing public artwork has not been cleared for deployment.
  build: { copyPublicDir: false },
})
