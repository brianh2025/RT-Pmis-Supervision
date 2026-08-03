/* 依施工日誌敘述自動拆解「位置及部位」與「施工項目」，供 Quality.jsx 自動建立待複驗查驗使用 */

/* 非查驗性日誌記事（休假、天候、場地管理），不列入待建立查驗 */
export const NON_INSPECT_RE = /連休|連假|休假|停工|無施工|颱風|豪雨|雨量|降雨|積水|排除|清理|整理|維持|打掃|環境|便道|善後/;

const ACTIVITY_TERMS = [
  '模板組立', '混凝土澆置', '鋼筋綁紮', '鋼筋加工',
  '預力混凝土基樁打設', '預力基樁打設', '基樁打設',
  '擋水鋼板樁打設', '擋土板樁打設', '鋼板樁打設', '鋼板樁進場',
  '擋土板樁拔除', '板樁拔除', '擋土措施打設',
  '土方開挖', '初步回填', '土方回填',
  'PC襯底施作', '襯底施作', '漸變段打除',
];
/* 找出字串中最早出現的活動詞（同位置取較長者，避免「擋水鋼板樁打設」被「鋼板樁打設」搶匹配） */
function findActivity(str) {
  let idx = -1, term = '';
  for (const t of ACTIVITY_TERMS) {
    const i = str.indexOf(t);
    if (i >= 0 && (idx === -1 || i < idx || (i === idx && t.length > term.length))) { idx = i; term = t; }
  }
  return { idx, term };
}
/* 拆解規則（以活動詞命中與否判別片段類型，位置與工項次序不固定亦可判別）：
 *   R1 括號內無活動詞 → 抽為位置（解「鋼筋綁紮（1F東側）」）
 *   R2 整段按 、，,及 全域斷詞（頓號多項目一律拆項）
 *   R3 逐 token：位置前綴＋活動詞→切分；活動詞開頭＋殘餘無活動詞→殘餘當位置；
 *      無活動詞→前置暫存或回填至 location 為空的項
 *   R4 整段無活動詞 → 各 token 視為自由工項各自成列
 * 測試案例：
 *   '1F東側鋼筋綁紮及模板組立'   → [{鋼筋綁紮,1F東側},{模板組立,1F東側}]
 *   '鋼筋綁紮（1F東側）'         → [{鋼筋綁紮,1F東側}]
 *   '路基整理、級配鋪設、涵管吊放' → 三項各自成列（無位置）
 *   '本日施作：1.P12～P15基樁打設 2.土方開挖（南側）' → [{基樁打設,P12～P15},{土方開挖,南側}]
 *   '鋼筋綁紮1F東側'             → [{鋼筋綁紮,1F東側}]
 *   '模板組立、混凝土澆置、2F版' → [{模板組立,2F版},{混凝土澆置,2F版}]
 */
export function splitWorkItemEntry(raw) {
  const name = (raw || '').replace(/^本日施作[:：]?/, '').trim();
  // 先按「1. 2.」項次或句號分段（項次前可為句首、句號或空白；(?!\d) 避免誤切小數）
  const segs = name.split(/(?:^|[。;；\s])\s*\d+\.(?!\d)\s*/).map(s => s.replace(/[。\s]+$/, '').trim()).filter(Boolean);
  const out = [];
  for (const seg0 of (segs.length ? segs : [name])) {
    // R1 括號位置抽取
    let parenLoc = '';
    const seg = seg0.replace(/[（(]([^（）()]*)[）)]/g, (m, inner) => {
      if (findActivity(inner).idx >= 0) return m;
      if (inner.trim()) parenLoc = inner.trim();
      return '';
    }).trim();
    // R2 全域斷詞
    const tokens = seg.split(/[、，,及]/).map(s => s.trim()).filter(Boolean);
    // R3 逐 token 分類
    const results = [];
    const pendingTokens = [];  // 首個活動詞之前的無活動詞 token（前置位置或自由工項，段末定奪）
    let curLoc = parenLoc;
    for (const tok of tokens) {
      const { idx, term } = findActivity(tok);
      if (idx > 0) {
        curLoc = tok.slice(0, idx).trim() || curLoc;
        results.push({ item: tok.slice(idx), location: curLoc });
      } else if (idx === 0) {
        const rest = tok.slice(term.length).trim();
        if (rest && findActivity(rest).idx === -1) {
          // 工項在前、位置在後（如「鋼筋綁紮1F東側」）
          results.push({ item: term, location: rest });
          curLoc = rest;
        } else {
          results.push({ item: tok, location: curLoc });
        }
      } else if (results.length === 0) {
        pendingTokens.push(tok);
      } else {
        // 尾端無活動詞 token：回填至 location 為空的項，全數已有位置則自身成列
        const holes = results.filter(r => !r.location);
        if (holes.length) holes.forEach(r => { r.location = tok; });
        else results.push({ item: tok, location: curLoc });
      }
    }
    // R4 段末收尾
    if (results.length === 0) {
      for (const tok of pendingTokens) out.push({ item: tok, location: parenLoc });
    } else {
      if (pendingTokens.length) {
        const loc = pendingTokens.join('');
        results.forEach(r => { if (!r.location) r.location = loc; });
      }
      out.push(...results);
    }
  }
  return out.length ? out : [{ item: name, location: '' }];
}
