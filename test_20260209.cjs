const fs = require('fs');

function parseDate(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/\s+/g, '')
    .replace(/[年/]/g, '-').replace(/月/g, '-').replace(/日/g, '')
    .trim();
  const rocMatch = s.match(/^(\d{2,3})-(\d{1,2})-(\d{1,2})$/);
  if (rocMatch) {
    const y = parseInt(rocMatch[1]);
    const m = rocMatch[2].padStart(2, '0');
    const d = rocMatch[3].padStart(2, '0');
    return `${y + 1911}-${m}-${d}`;
  }
  const ceMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ceMatch) return `${ceMatch[1]}-${ceMatch[2].padStart(2,'0')}-${ceMatch[3].padStart(2,'0')}`;
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return null;
}

async function testIt() {
  const lib = await import('file:///e:/RT-Pmis-Supervision/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync('Daily log sample/20260209_監造日報.pdf'));
  const pdf = await lib.getDocument({ data }).promise;
  console.log('numPages:', pdf.numPages);
  
  for (let p=1; p<=pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.map(i => ({
      str: i.str.trim(),
      x: Math.round(i.transform[4]),
      y: Math.round(i.transform[5])
    })).filter(i => i.str);
    
    const allText = items.map(i => i.str).join(' ');
    if (!/公共\s*工程\s*監造\s*報表/.test(allText) && !/施工日誌/.test(allText)) {
      continue;
    }
    
    // -- DATE --
    const dateLabelItem = items.find(i => i.str.startsWith('填表日期'));
    let logDate = null;
    if (dateLabelItem) {
      const embeddedDate = dateLabelItem.str.match(/(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
      if (embeddedDate) logDate = parseDate(`${embeddedDate[1]}年${embeddedDate[2]}月${embeddedDate[3]}日`);
      if (!logDate) {
        const near = items.filter(i => Math.abs(i.y - dateLabelItem.y) <= 8 && i.x > dateLabelItem.x - 10 && i.x < dateLabelItem.x + 200 && i.str !== dateLabelItem.str && (/\d{2,3}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(i.str) || /\d{2,3}\s*年/.test(i.str)));
        if (near.length) logDate = parseDate(near[0].str);
      }
    }
    if (!logDate) {
      const cjkDateItems = items.filter(i => /\d{2,3}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/.test(i.str));
      if (cjkDateItems.length) logDate = parseDate(cjkDateItems[0].str);
    }
    if (!logDate) {
      const dateItems = items.filter(i => /^\d{2,3}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(i.str));
      const labelY = dateLabelItem?.y ?? 770;
      const sorted = dateItems.sort((a, b) => Math.abs(a.y - labelY) - Math.abs(b.y - labelY));
      if (sorted.length) logDate = parseDate(sorted[0].str);
    }

    // -- WEATHER --
    const VALID_WEATHER = ['晴', '多雲', '陰', '小雨', '中雨', '大雨', '颱風', '豪雨'];
    let weatherAm = null, weatherPm = null;
    const amItem = items.find(i => i.str.includes('上午'));
    const pmItem = items.find(i => i.str.includes('下午'));
    if (amItem) {
      const em = amItem.str.match(/(?:上午)[:：\s]*(晴|多雲|陰|小雨|中雨|大雨|颱風|豪雨)/);
      if (em) weatherAm = em[1];
      else {
        const after = items.filter(i => Math.abs(i.y - amItem.y) <= 5 && i.x > amItem.x).sort((a,b) => a.x - b.x);
        weatherAm = after.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
      }
    }
    if (pmItem) {
      const em = pmItem.str.match(/(?:下午)[:：\s]*(晴|多雲|陰|小雨|中雨|大雨|颱風|豪雨)/);
      if (em) weatherPm = em[1];
      else {
        const after = items.filter(i => Math.abs(i.y - pmItem.y) <= 5 && i.x > pmItem.x).sort((a,b) => a.x - b.x);
        weatherPm = after.find(i => VALID_WEATHER.includes(i.str))?.str ?? null;
      }
    }

    // -- PROGRESS --
    let plannedProgress = null, actualProgress = null;
    const predLabel = items.find(i => i.str.includes('預定進度') || i.str.includes('預定'));
    const actLabel = items.find(i => i.str.includes('實際進度') || i.str.includes('實際'));
    if (predLabel) {
      const nums = items.filter(i => Math.abs(i.y - predLabel.y) <= 5 && /^[\d.]+$/.test(i.str));
      if (nums.length) {
        const rn = nums.filter(i => i.x > predLabel.x).sort((a,b) => a.x - b.x);
        const ln = nums.filter(i => i.x < predLabel.x).sort((a,b) => predLabel.x - a.x);
        plannedProgress = parseFloat((rn[0] || ln[0])?.str) || null;
      }
    }
    if (actLabel) {
      const nums = items.filter(i => Math.abs(i.y - actLabel.y) <= 5 && /^[\d.]+$/.test(i.str));
      if (nums.length) {
        const rn = nums.filter(i => i.x > actLabel.x).sort((a,b) => a.x - b.x);
        const ln = nums.filter(i => i.x < actLabel.x).sort((a,b) => actLabel.x - a.x);
        actualProgress = parseFloat((rn[0] || ln[0])?.str) || null;
      }
    }

    // -- WORK ITEMS --
    function isBoilerplate(str) {
      if (str.length > 50) return true;
      if (/^(公共工程監造報表|施工日誌|監造單位|主辦機關|設計單位|施工廠商|表報編號|工程編號|填表日期|契約工期|開工日期|預定完工日期|累計工期|工期展延天數|契約金額|預定進度|實際進度|本日天氣)/.test(str)) return true;
      if (/(含約定之檢驗停留點|主辦機關指示及通知廠商辦理事項|請參詳施工日誌)/.test(str)) return true;
      if (/註：/.test(str)) return true;
      return false;
    }

    const tableItems = items.filter(i => i.y < 740 && i.y > 50 && !isBoilerplate(i.str));
    const rowsByY = [];
    tableItems.forEach(item => {
      if (/^[壹貳參肆一二三四五六七八九十]$/.test(item.str)) return;
      if (/^(工程項目|單位|契約數量|今日|累計|發包工程費|第.號明細表|約定之重要施工)/.test(item.str)) return;
      let row = rowsByY.find(r => Math.abs(r.y - item.y) <= 4);
      if (!row) { row = { y: item.y, items: [] }; rowsByY.push(row); }
      row.items.push(item);
    });
    
    const workItemsArr = [];
    rowsByY.sort((a, b) => b.y - a.y);
    for (const row of rowsByY) {
      if (row.items.length < 2) continue;
      row.items.sort((a, b) => a.x - b.x);
      const hasText = row.items.some(i => /[^\d,.%\-\s]/.test(i.str));
      const hasNum = row.items.some(i => /^[\d,.%-]+$/.test(i.str));
      if (hasText && hasNum) {
        const texts = row.items.filter(i => /[^\d,.%\-\s]/.test(i.str)).map(i => i.str);
        const nums = row.items.filter(i => /^[\d,.%-]+$/.test(i.str)).map(i => i.str);
        const name = texts[0];
        const unit = texts.length > 1 ? texts[1] : '';
        let displayNum = '-';
        if (nums.length >= 3) displayNum = nums[1];
        else if (nums.length === 2) displayNum = nums[0];
        else if (nums.length === 1) displayNum = nums[0];
        if (displayNum !== '-' && displayNum !== '0' && displayNum !== '0.00') {
          workItemsArr.push(`${name}：${displayNum} ${unit}`.trim());
        }
      }
    }
    const workItemsStr = workItemsArr.join('\n') || null;

    console.log(`Page ${p} Result:`, { logDate, weatherAm, weatherPm, plannedProgress, actualProgress, work_items: workItemsStr });
  }
}
testIt().catch(console.error);
