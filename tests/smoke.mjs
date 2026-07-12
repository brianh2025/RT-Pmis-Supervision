// RT-PMIS 登入煙霧測試 — 通過認證閘門後走訪所有受保護頁面，驗證渲染不崩潰
//
// 用法：
//   npm run build && npm run test:smoke
//
// 兩種模式（自動判定）：
//   A. 真實登入：設定 TEST_USER_EMAIL + TEST_USER_PASSWORD（Supabase 測試帳號），
//      以 email/password 取得真實 session，頁面會載入真實資料。
//      VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 從環境變數或 .env.local 讀取。
//   B. 假 session：未設定測試帳號時，注入偽造 session 通過 ProtectedRoute，
//      驗證所有頁面外殼渲染與路由（資料請求失敗屬預期，只檢查不白屏、不崩潰）。
//
// 其他環境變數：
//   TEST_BASE_URL   預設 http://localhost:4173（未啟動時自動以 vite preview 啟動）
//   CHROMIUM_PATH   指定 Chromium 執行檔（預設用 playwright 自帶）

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

// ── 讀取設定（環境變數優先，其次 .env.local）─────────────────
function loadEnvLocal() {
  const out = {};
  if (!existsSync('.env.local')) return out;
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const dotenv = loadEnvLocal();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || dotenv.VITE_SUPABASE_URL || 'https://dummy-test.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || dotenv.VITE_SUPABASE_ANON_KEY || 'dummy-anon-key-for-smoke-test';
const BASE = process.env.TEST_BASE_URL || 'http://localhost:4173';
const EMAIL = process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TEST_USER_PASSWORD;
const realLogin = Boolean(EMAIL && PASSWORD);
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;

// ── 取得 session（真實登入或偽造）────────────────────────────
async function getSession() {
  if (realLogin) {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    if (error) throw new Error(`測試帳號登入失敗：${error.message}`);
    // 順便抓一個真實專案 id 供子頁面走訪
    const { data: projects } = await sb.from('projects').select('id').limit(1);
    return { session: data.session, projectId: projects?.[0]?.id ?? null };
  }
  // 偽造 session：exp 設未來使 getSession 不觸發 refresh，user 結構滿足 AuthContext
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const fakeJwt = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'smoke-test-user', role: 'authenticated', exp })}.sig`;
  return {
    session: {
      access_token: fakeJwt,
      refresh_token: 'smoke-test-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: exp,
      user: {
        id: 'smoke-test-user', aud: 'authenticated', role: 'authenticated',
        email: 'smoke-test@example.com', app_metadata: {}, user_metadata: {},
        created_at: new Date().toISOString(),
      },
    },
    projectId: '00000000-0000-0000-0000-000000000000',
  };
}

// ── 確保 preview 伺服器可用 ───────────────────────────────────
async function ensureServer() {
  const alive = await fetch(BASE).then((r) => r.ok).catch(() => false);
  if (alive) return null;
  const proc = spawn('npx', ['vite', 'preview', '--port', new URL(BASE).port || '4173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await fetch(BASE).then((r) => r.ok).catch(() => false)) return proc;
  }
  proc.kill();
  throw new Error(`無法啟動 preview 伺服器（${BASE}），請先 npm run build`);
}

// ── 主流程 ────────────────────────────────────────────────────
const { session, projectId } = await getSession();
const server = await ensureServer();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 150)));

// 在 app 載入前注入 session，通過 ProtectedRoute
await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(session)]);

const routes = [
  ['/dashboard', '總覽 Dashboard'],
  [`/projects/${projectId}/dashboard`, '專案儀表板'],
  [`/projects/${projectId}/supervision`, '施工日誌'],
  [`/projects/${projectId}/journal`, '監造報表'],
  [`/projects/${projectId}/progress`, '進度管理'],
  [`/projects/${projectId}/material`, '材料管控'],
  [`/projects/${projectId}/submission`, '送審管理'],
  [`/projects/${projectId}/quality`, '品質管理'],
  [`/projects/${projectId}/photos`, '照片記錄'],
  [`/projects/${projectId}/archive`, '文件歸檔'],
  [`/projects/${projectId}/analytics`, '分析'],
];

let failed = 0;
console.log(`模式：${realLogin ? 'A 真實登入（' + EMAIL + '）' : 'B 假 session（僅驗證外殼渲染與路由）'}\n`);

for (const [path, name] of routes) {
  pageErrors.length = 0;
  let status = 'PASS';
  const notes = [];
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const url = page.url();
    const text = ((await page.textContent('body')) || '').replace(/\s+/g, ' ').trim();
    if (url.includes('/login')) { status = 'FAIL'; notes.push('被導回登入頁（session 未生效）'); }
    if (text.length < 10) { status = 'FAIL'; notes.push('頁面近乎空白（疑似白屏）'); }
    if (pageErrors.length) { status = 'FAIL'; notes.push(`JS 例外：${pageErrors[0]}`); }
  } catch (e) {
    status = 'FAIL';
    notes.push(e.message.slice(0, 100));
  }
  if (status === 'FAIL') failed++;
  console.log(`${status === 'PASS' ? '✅' : '❌'} ${name.padEnd(8, '　')} ${path}${notes.length ? ' — ' + notes.join('；') : ''}`);
}

// 登出防護迴歸：以無 session 的乾淨 context 進受保護頁，應導回 /login
// （不能沿用原 page：addInitScript 每次導航都會重新注入 session）
const cleanPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await cleanPage.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
await cleanPage.waitForTimeout(1500);
const guarded = cleanPage.url().includes('/login');
if (!guarded) failed++;
console.log(`${guarded ? '✅' : '❌'} 未登入防護 /dashboard → /login`);

await browser.close();
server?.kill();
console.log(`\n結果：${routes.length + 1 - failed}/${routes.length + 1} 通過`);
process.exit(failed ? 1 : 0);
