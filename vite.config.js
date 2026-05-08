import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// 建置時將 pdfjs-dist cmaps 複製到 public/cmaps（供本地 CID 字型解碼）
const copyPdfjsAssets = {
  name: 'copy-pdfjs-assets',
  buildStart() {
    const pairs = [
      ['./node_modules/pdfjs-dist/cmaps', './public/cmaps'],
      ['./node_modules/pdfjs-dist/standard_fonts', './public/standard_fonts'],
    ]
    for (const [src, dst] of pairs) {
      const srcAbs = path.resolve(src)
      const dstAbs = path.resolve(dst)
      if (fs.existsSync(srcAbs)) {
        fs.cpSync(srcAbs, dstAbs, { recursive: true })
      }
    }
  },
}

export default defineConfig({
  plugins: [react(), copyPdfjsAssets],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
})
