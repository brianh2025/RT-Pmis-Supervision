/* 各工項施工抽查紀錄表清單（依 PDF 表 7.3-17 ~ 7.3-30）
   code: Drive 資料夾名稱前綴（EA、EB…）
   label: 表單顯示名稱
   items: 抽查子項目陣列 { phase, name, standard }
     phase: '施工前' | '施工中' | '施工完成'
     name: 管理項目名稱
     standard: 抽查標準（定量定性）
     key: 是否為關鍵項目（★）
*/

export const INSPECTION_TEMPLATES = [
  {
    code: 'EA',
    label: '測量工程',
    items: [
      { phase: '施工前', name: '儀器定期校正',          standard: '一年內校正報告',                           key: true  },
      { phase: '施工前', name: '標尺或反光器完整無破損', standard: '完整無破損',                               key: false },
      { phase: '施工前', name: '氣候因素',               standard: '測量時無下雨或光線不良情形',               key: false },
      { phase: '施工前', name: '地表雜物與草木清除與掘除', standard: '雜物、草木先行清理乾淨',                 key: false },
      { phase: '施工中', name: '座標、高程是否校核',     standard: '控制點高程：位置誤差≦[1/3000]；高程誤差±[20*√Kmm]', key: true },
      { phase: '施工中', name: '引用控制樁是否正確',     standard: '引用正確',                                 key: true  },
      { phase: '施工中', name: '控制點是否設置牢固',     standard: '無移動或損毀且設置牢固',                   key: true  },
      { phase: '施工完成', name: '放樣點與設計圖尺寸計算', standard: '經驗算確認正確',                         key: true  },
      { phase: '施工完成', name: '放樣點位置',           standard: '一般結構物：±1cm；基樁：±5cm',             key: true  },
      { phase: '施工完成', name: '放樣點保護',           standard: '有標記、保護',                             key: true  },
      { phase: '施工完成', name: '高程引點計算',         standard: '經驗算確認正確',                           key: true  },
      { phase: '施工完成', name: '放樣點高程',           standard: '一般結構物：±1cm；基樁：±5cm',             key: true  },
    ],
  },
  {
    code: 'EB',
    label: '開挖工程',
    items: [
      { phase: '施工前', name: '地表雜物與草木清除與掘除', standard: '雜物、草木先行清理乾淨',                 key: false },
      { phase: '施工前', name: '開挖範圍及高程測量',     standard: '放樣位置誤差±2cm',                        key: true  },
      { phase: '施工前', name: '必要樁位保護',           standard: '有標記、保護',                             key: false },
      { phase: '施工中', name: '開挖順序',               standard: '自上而下依序開挖',                         key: true  },
      { phase: '施工中', name: '不良地層',               standard: '積水抽除、軟弱地層去除',                   key: true  },
      { phase: '施工中', name: '開挖後現地材料',         standard: '不得有不適用材料留於底部',                 key: true  },
      { phase: '施工中', name: '土方堆置',               standard: '不可堆於開挖區域旁',                       key: true  },
      { phase: '施工完成', name: '整平',                 standard: '坡面應平整堅實，坡度約 1:0.5',             key: true  },
      { phase: '施工完成', name: '地表廢土清除',         standard: '開挖面以上廢土確實清除',                   key: false },
    ],
  },
  {
    code: 'EC',
    label: '回填工程',
    items: [
      { phase: '施工前', name: '地表雜物與草木清除與掘除', standard: '雜物、草木先行清理乾淨',                 key: false },
      { phase: '施工中', name: '分層回填夯實',           standard: '每層鬆方厚度不得超過 30cm（結構物 15cm／非結構物 25-30cm）', key: true },
      { phase: '施工中', name: '輾壓機具、人員是否符合規定', standard: '輾壓機具駕駛具合格執照，機具經檢驗合格', key: false },
      { phase: '施工中', name: '填方材料是否符合規定',   standard: '無雜物，最大粒徑小於[2/3 層厚]，構造物頂 30cm 範圍內填土最大粒徑不大於[10cm]', key: true },
      { phase: '施工完成', name: '平整度',               standard: '回填面應平整堅實，坡度平緩，表面整平高差在±5cm 內', key: true },
    ],
  },
  {
    code: 'ED',
    label: '鋼筋工程',
    items: [
      { phase: '施工前', name: '成品之堆置方法和狀態',   standard: '鋼筋墊高儲放，分類堆置，帆布加蓋，防止鋼筋污染及銹蝕', key: false },
      { phase: '施工中', name: '鋼筋號數、鋼筋間距、支數', standard: '依設計圖說',                             key: true  },
      { phase: '施工中', name: '鋼筋搭接位置及長度',     standard: '搭接不得於同一斷面；搭接長度 D13≧48cm',   key: true  },
      { phase: '施工中', name: '鋼筋綁紮牢固',           standard: '間距<20cm 牢固不得紊亂、間隔綁紮；間距≧20cm 牢固不得紊亂、逐步綁紮', key: true },
      { phase: '施工中', name: '保護層厚度',             standard: '臨土 7.5cm+0.6cm',                         key: true  },
      { phase: '施工完成', name: '完成面平直度',         standard: '平直度良好、線型良好',                     key: true  },
    ],
  },
  {
    code: 'EE',
    label: '模板工程',
    items: [
      { phase: '施工前', name: '模板規格及外觀',         standard: '模板，是否過度使用',                       key: false },
      { phase: '施工前', name: '清潔狀況',               standard: '構造物底部整平與清理',                     key: false },
      { phase: '施工中', name: '塗脫模劑',               standard: '塗抹均勻',                                 key: false },
      { phase: '施工中', name: '斷面尺寸',               standard: '模板組立尺寸≧設計斷面尺寸',                key: true  },
      { phase: '施工中', name: '模板內之清潔狀況',       standard: '無木片、木屑等雜物',                       key: false },
      { phase: '施工中', name: '界面密合度與空隙是否填補', standard: '模板緊結度緊密',                         key: true  },
      { phase: '施工中', name: '保護層厚度',             standard: '臨土 7.5cm+0.6cm',                         key: true  },
      { phase: '施工中', name: '模板平直度',             standard: '模板之斜率精度、頂部水平精度小於 1% 以內', key: false },
      { phase: '施工中', name: '模板及支撐',             standard: '支撐是否穩固、無變形',                     key: true  },
      { phase: '施工完成', name: '模板拆模時間',         standard: '版(淨跨6m以下)[10]天；版(淨跨6m以上)[14]天；梁[21]天；柱牆墩側模[3]天；明渠[3]天', key: true },
      { phase: '施工完成', name: '清理模板',             standard: '鐵釘拔除、鐵線剪除',                       key: false },
    ],
  },
  {
    code: 'EF',
    label: '混凝土工程',
    items: [
      { phase: '施工前', name: '澆置面、模板內部清潔狀況', standard: '木片、木屑殘留鐵釘垃圾雜物之清潔',       key: false },
      { phase: '施工前', name: '模板之脫模劑塗佈狀況',   standard: '均勻塗佈',                                 key: false },
      { phase: '施工中', name: '拌合至澆置完成之時間控制', standard: '90 分鐘內',                              key: true  },
      { phase: '施工中', name: '坍度',                   standard: '15±4.0cm',                                 key: true  },
      { phase: '施工中', name: '氯離子',                 standard: '氯離子含量≦0.15kg/m³',                     key: true  },
      { phase: '施工中', name: '澆置方法、澆置順序',     standard: '分層澆置，澆置高度落差不得高於 1.5m',      key: true  },
      { phase: '施工中', name: '震動棒震動時間',         standard: '5-10 秒/處',                               key: true  },
      { phase: '施工中', name: '混凝土粒料是否有分離情形', standard: '無分離',                                 key: false },
      { phase: '施工完成', name: '混凝土表面濕潤狀態',   standard: '保持混凝土表面濕潤狀態，以灑水法或覆蓋法養護', key: true },
      { phase: '施工完成', name: '澆置完成面',           standard: '不得有明顯裂痕及蜂窩現象產生',             key: false },
      { phase: '施工完成', name: '完成面清潔',           standard: '殘留鐵線材、繫結器須剪除',                 key: false },
      { phase: '施工完成', name: '排水器',               standard: '每處確實設置',                             key: false },
      { phase: '施工完成', name: '尺寸檢驗',             standard: '依設計圖說',                               key: false },
    ],
  },
  {
    code: 'EG',
    label: '臨時擋土設施工程',
    items: [
      { phase: '施工前', name: '施作位置',               standard: '依據設計圖說位置放樣',                     key: false },
      { phase: '施工前', name: '地表淺層舊基礎或障礙物', standard: '試挖或導溝施做、障礙物清除',               key: false },
      { phase: '施工前', name: '鋼板樁尺寸',             standard: '板樁長度≧7、9m；鋼板樁寬度 0.4m',         key: true  },
      { phase: '施工前', name: '鋼板樁外觀',             standard: '無折彎扭曲變形',                           key: true  },
      { phase: '施工中', name: '擋土樁打設是否垂直',     standard: '不得有偏斜，垂直打設垂直度≦1/100',        key: true  },
      { phase: '施工中', name: '鋼板樁打設接槽是否緊密', standard: '接槽緊密',                                 key: true  },
      { phase: '施工中', name: '量測變位',               standard: '警戒值≧1/360（3.6cm）',                   key: false },
      { phase: '施工中', name: '鋼板樁拆裝時交通維持',   standard: '安全警示、派專員指揮交通',                 key: true  },
      { phase: '施工完成', name: '拔樁空隙填縫',         standard: '以填砂並灌水填滿空隙',                     key: true  },
      { phase: '施工完成', name: '剩餘材料清除及場地整理', standard: '場地整理完成',                           key: false },
    ],
  },
  {
    code: 'EH',
    label: '預力混凝土基樁工程',
    items: [
      { phase: '施工前', name: '開挖整地放樣',           standard: '擋浪牆 1m 交錯排列；坡面工間距 1m 排列',  key: false },
      { phase: '施工前', name: '外觀',                   standard: '表面無蜂窩、光滑',                         key: false },
      { phase: '施工前', name: '長度',                   standard: '6m±0.3% 內',                               key: true  },
      { phase: '施工前', name: '直徑',                   standard: 'D=30cm+5mm，-2mm 內（2點平均值）',         key: true  },
      { phase: '施工前', name: '厚度',                   standard: 'T=6cm+40mm，-2mm 內（4點平均值）',         key: true  },
      { phase: '施工中', name: '打設間距',               standard: '擋浪牆 1m 交錯排列；坡面工間距 1m 排列',  key: true  },
      { phase: '施工中', name: '垂直度檢查',             standard: '±1/50',                                    key: true  },
      { phase: '施工完成', name: '打設間距及高程',       standard: '樁頭露出高度 7.5cm±2.5cm（距PC工作面）', key: true  },
      { phase: '施工完成', name: '回填砂',               standard: '確實注滿下部樁長 2/3',                     key: true  },
      { phase: '施工完成', name: '樁頭補強',             standard: 'e1-D22*6 支、e2-D16*10 支，e2@15cm',      key: true  },
      { phase: '施工完成', name: '灌漿',                 standard: '確實注滿混凝土強度 210kg/cm²，上部樁長 1/3', key: true },
    ],
  },
  {
    code: 'EI',
    label: '臨時擋抽移排水工程',
    items: [
      { phase: '施工前', name: '施作位置',               standard: '依據設計圖說位置放樣',                     key: false },
      { phase: '施工前', name: '地表淺層舊基礎或障礙物', standard: '試挖或導溝施做、障礙物清除',               key: false },
      { phase: '施工前', name: '鋼板樁尺寸',             standard: '板樁長度≧7、9m；鋼板樁寬度 0.4m',         key: true  },
      { phase: '施工前', name: '鋼板樁外觀',             standard: '無折彎扭曲變形',                           key: true  },
      { phase: '施工中', name: '擋土樁打設是否垂直',     standard: '不得有偏斜，垂直打設垂直度≦1/100',        key: true  },
      { phase: '施工中', name: '鋼板樁打設接槽是否緊密', standard: '接槽緊密',                                 key: true  },
      { phase: '施工中', name: '量測變位',               standard: '警戒值≧1/360（3.6cm）',                   key: false },
      { phase: '施工中', name: '鋼板樁拆裝時交通維持',   standard: '安全警示、派專員指揮交通',                 key: true  },
      { phase: '施工中', name: '抽排水',                 standard: '積水是否清除',                             key: false },
      { phase: '施工中', name: '填土',                   standard: '回填土無雜物',                             key: false },
      { phase: '施工完成', name: '拔樁空隙填縫',         standard: '以填砂並灌水填滿空隙',                     key: true  },
      { phase: '施工完成', name: '剩餘材料清除及場地整理', standard: '場地整理完成',                           key: false },
    ],
  },
  {
    code: 'EJ',
    label: '瀝青混凝土鋪面工程',
    items: [
      { phase: '施工前', name: '氣候因素',               standard: '晴天溫度＞10℃，乾燥無積水',               key: false },
      { phase: '施工前', name: '路面雜物（草）清理',     standard: '路基面（級配）平整，無坑洞、浮鬆塵土等材料', key: false },
      { phase: '施工前', name: '鋪築機具及滾壓機具檢查', standard: '初壓≧8t 二軸三輪或 6t 振動壓路機；次壓自走式膠輪壓路機；終壓 6～8t 二軸二輪', key: false },
      { phase: '施工前', name: '人力分配及交通安全設施', standard: '人員及交維設施配置完整',                   key: false },
      { phase: '施工前', name: '瀝青混凝土外觀',         standard: '無雜物且粒料分布均勻',                     key: true  },
      { phase: '施工中', name: '材料溫度',               standard: '舖築溫度 120-163℃；初壓 100-120℃；次壓 82-100℃；終壓 65℃以上', key: true },
      { phase: '施工中', name: '黏、透層撒佈量',         standard: '黏層 0.15-0.45 L/M²；透層 0.3～0.9 L/M²', key: true },
      { phase: '施工中', name: '分層鋪築接縫',           standard: '縱向接縫≧15cm；橫向接縫≧60cm',            key: true  },
      { phase: '施工中', name: '鬆方厚度',               standard: '鬆方厚度≧預設舖築厚度之 1.25 倍',         key: true  },
      { phase: '施工中', name: '滾壓方向',               standard: '與路中心線平行，自外側邊緣開始漸次向路中心', key: false },
      { phase: '施工中', name: '壓實',                   standard: '路面滾壓直至路面平整無輪滾痕為止',         key: false },
      { phase: '施工完成', name: '通車溫度',             standard: '50°C 以下方可通車',                        key: true  },
    ],
  },
  {
    code: 'EK',
    label: 'CLSM 工程',
    items: [
      { phase: '施工前', name: '澆置前雜物清理',         standard: '清除雜物',                                 key: false },
      { phase: '施工中', name: '出廠至澆置完成之時間控制', standard: '≦90 分鐘',                              key: true  },
      { phase: '施工中', name: '外觀',                   standard: '外觀無異常狀態',                           key: false },
      { phase: '施工中', name: '坍流度試驗',             standard: '40-60cm',                                  key: true  },
      { phase: '施工中', name: '澆注順序',               standard: '由邊而中，由下而上',                       key: true  },
      { phase: '施工中', name: '澆置厚度、分層澆置',     standard: '每層澆置厚度≦30cm',                       key: true  },
      { phase: '施工完成', name: '澆置完成厚度',         standard: '詳圖說',                                   key: true  },
    ],
  },
  {
    code: 'EL',
    label: '植筋工程',
    items: [
      { phase: '施工前', name: '儀器材料確認',           standard: '藥劑檢查、施工工具檢查',                   key: false },
      { phase: '施工前', name: '鋼筋長度',               standard: 'L≧233cm',                                  key: true  },
      { phase: '施工中', name: '鑽孔孔徑',               standard: '∮19 孔徑 22~25mm',                        key: true  },
      { phase: '施工中', name: '鑽孔深度',               standard: '≧30cm',                                    key: true  },
      { phase: '施工中', name: '鑽孔間距',               standard: 'D19@20cm',                                 key: true  },
      { phase: '施工中', name: '鑽孔是否清潔',           standard: '使用吹氣筒或其他空壓設備吹淨',             key: true  },
      { phase: '施工中', name: '灌注植筋膠',             standard: '深入孔底、打入六分',                       key: true  },
      { phase: '施工中', name: '植入鋼筋',               standard: '置入鋼筋後需滿溢，植入後 4 小時不可移動', key: true  },
      { phase: '施工完成', name: '外觀檢查、外露長度',   standard: '無歪斜，外露長度符合圖說',                 key: false },
    ],
  },
  {
    code: 'EM',
    label: '混凝土塊工程',
    items: [
      { phase: '施工前', name: '混凝土塊尺寸、型式',     standard: '符合圖說',                                 key: false },
      { phase: '施工中', name: '吊放範圍是否有警示',     standard: '禁止人員入內',                             key: true  },
      { phase: '施工中', name: '混凝土塊吊放是否按圖施做', standard: '混凝土塊排列緊密',                       key: true  },
      { phase: '施工完成', name: '場地整理',             standard: '場地整理完成',                             key: false },
    ],
  },
  {
    code: 'EN',
    label: '坡面工工程',
    items: [
      { phase: '施工前', name: '地表雜物與草木清除與掘除', standard: '雜草、樹木先行清理乾淨',                 key: false },
      { phase: '施工前', name: '必要樁位與高程之檢測及保護', standard: '無損毀或移動',                         key: false },
      { phase: '施工前', name: '開挖位置及高程',         standard: '依設計圖說所標示的尺度為準，位置誤差小於±1cm', key: false },
      { phase: '施工中', name: '鋼筋裁切長度、外觀及尺寸', standard: '依設計圖說',                            key: false },
      { phase: '施工中', name: '點焊鋼線網規格',         standard: '依設計圖說',                               key: false },
      { phase: '施工中', name: '模板規格及外觀',         standard: '清水模板，是否過度使用',                   key: false },
      { phase: '施工完成', name: '混凝土表面濕潤狀態',   standard: '保持混凝土表面濕潤狀態，以灑水法或覆蓋法養護', key: true },
      { phase: '施工完成', name: '澆置完成面',           standard: '不得有明顯裂痕及蜂窩現象產生',             key: false },
      { phase: '施工完成', name: '完成面清潔',           standard: '殘留鐵線材、繫結器須剪除',                 key: false },
    ],
  },
];

export function getTemplateByCode(code) {
  return INSPECTION_TEMPLATES.find(t => t.code === code);
}

export function getTemplateByLabel(label) {
  return INSPECTION_TEMPLATES.find(t => t.label === label || label?.includes(t.label));
}

export const TEMPLATE_OPTIONS = INSPECTION_TEMPLATES.map(t => ({
  value: t.code,
  label: `${t.code} ${t.label}`,
}));

export const INSPECT_TYPE_OPTIONS = ['施工檢驗停留點', '不定期檢查'];
export const FLOW_OPTIONS         = ['施工前', '施工中檢查', '施工完成檢查'];
export const RESULT_SYMBOL        = { pass: '○', fail: '╳', na: '／' };

/* 工項名稱關鍵字 → 表單代碼（模糊比對） */
const KEYWORD_MAP = [
  { keywords: ['測量'],              code: 'EA' },
  { keywords: ['開挖', '基礎開挖'],  code: 'EB' },
  { keywords: ['回填', '土方'],      code: 'EC' },
  { keywords: ['鋼筋'],             code: 'ED' },
  { keywords: ['模板'],             code: 'EE' },
  { keywords: ['混凝土澆置', '混凝土'],code: 'EF' },
  { keywords: ['擋土'],             code: 'EG' },
  { keywords: ['基樁', '樁'],       code: 'EH' },
  { keywords: ['排水', '抽移'],     code: 'EI' },
  { keywords: ['瀝青', '鋪面'],     code: 'EJ' },
  { keywords: ['CLSM', 'clsm'],    code: 'EK' },
  { keywords: ['植筋'],             code: 'EL' },
  { keywords: ['混凝土塊'],         code: 'EM' },
  { keywords: ['坡面'],             code: 'EN' },
];

export function guessTemplateCode(workItem) {
  if (!workItem) return null;
  const w = workItem.toLowerCase();
  for (const { keywords, code } of KEYWORD_MAP) {
    if (keywords.some(k => w.includes(k.toLowerCase()))) return code;
  }
  return null;
}
