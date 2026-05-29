/**
 * 格式化百分比：確保非零值不因四捨五入而顯示為 "0%"
 *
 *  0      → "0%"
 *  0.005  → "0.01%"   (1位小數顯示0，自動找到2位)
 *  0.056  → "0.1%"    (1位小數夠用)
 *  1.5    → "1.5%"
 *  null   → fallback（預設 "—"）
 */
export function fmtPct(val, fallback = '—') {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  if (isNaN(n)) return fallback;
  if (n === 0) return '0%';
  if (parseFloat(n.toFixed(1)) !== 0) return parseFloat(n.toFixed(1)) + '%';
  for (let dp = 2; dp <= 4; dp++) {
    if (parseFloat(n.toFixed(dp)) !== 0) return n.toFixed(dp) + '%';
  }
  return '< 0.0001%';
}
