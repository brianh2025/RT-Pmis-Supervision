import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少 Supabase 環境變數，請檢查 .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
});

/** RT-PMIS 主系統網址（「開啟日誌」按鈕的連結目標） */
export const PMIS_BASE_URL =
  import.meta.env.VITE_PMIS_BASE_URL || 'https://www.xiaoxiong.page';
