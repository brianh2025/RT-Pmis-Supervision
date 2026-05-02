import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// 在 dev / build 啟動時，將 pdfjs-dist 的靜態資源複製到 public/
// 避免生產環境依賴外部 CDN（版本不符、網路阻斷等問題）
const copyPdfjsAssets = {
  name: 'copy-pdfjs-assets',
  buildStart() {
    const pairs = [
      ['./node_modules/pdfjs-dist/cmaps', './public/cmaps'],
      ['./node_modules/pdfjs-dist/standard_fonts', './public/standard_fonts'],
    ];
    for (const [src, dst] of pairs) {
      const srcAbs = path.resolve(src);
      const dstAbs = path.resolve(dst);
      if (fs.existsSync(srcAbs) && !fs.existsSync(dstAbs)) {
        fs.cpSync(srcAbs, dstAbs, { recursive: true });
      }
    }
  },
};

export default defineConfig({
  plugins: [react(), copyPdfjsAssets],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
})
