// whiteboard-ocr — 呼叫 Claude Vision API 辨識施工白板文字
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `請辨識這張施工現場照片中白板上的文字，提取下列資訊並以 JSON 格式回傳。
若照片中沒有白板、或某欄位看不清楚，對應值設為 null。

{
  "work_item": "工程項目或工項名稱",
  "location": "施工部位或位置",
  "date": "日期（格式 YYYY-MM-DD；民國年自動換算，例 114/05/10 → 2025-05-10）",
  "description": "施工說明或備註",
  "category": "類別（只能是：材料進場、施工抽查、查驗記錄、會勘紀錄、其他；若無則 null）"
}

只回傳 JSON 物件，不要任何說明或 markdown。`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { imageBase64, mimeType } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 未設定');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API 錯誤 ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const text = json.content?.[0]?.text?.trim() || '{}';

    let parsed: Record<string, string | null>;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
