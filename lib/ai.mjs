// ทุก prompt ของโปรเจกต์อยู่ที่ไฟล์นี้ เพื่อให้โชว์ในคลิปและบันทึกลง PROMPTS.md ได้ง่าย

export const READ_IMAGE_PROMPT = `คุณเป็นผู้ช่วยจัดการตู้เย็น ดูรูปแล้วระบุอาหาร/วัตถุดิบทุกชิ้นที่มองเห็น
ตอบเป็น JSON array เท่านั้น แต่ละรายการมี field ดังนี้:
- name: ชื่อภาษาไทย
- quantity: จำนวนพร้อมหน่วย เช่น "2 กล่อง", "500 กรัม"
- category: เลือกจาก ผัก, ผลไม้, เนื้อสัตว์, นม/ไข่, เครื่องดื่ม, ของแห้ง, อื่นๆ
- shelf_life_days: จำนวนเต็ม ประมาณอายุการเก็บ "ในตู้เย็น" นับจากวันนี้ (ถ้าเป็นใบเสร็จ ให้ประเมินจากชนิดสินค้า)
- price_thb: ราคาประมาณเป็นบาท (ตัวเลข) ถ้าเป็นใบเสร็จให้ใช้ราคาในใบเสร็จ
- confidence: ตัวเลข 0 ถึง 1 ถ้าไม่แน่ใจให้ใส่ต่ำ

กฎสำคัญ:
- ห้ามเดาของที่มองไม่เห็นในรูป
- เนื้อสัตว์ดิบ (ไก่ หมู) เก็บในช่องธรรมดาได้ 1-2 วัน ปลา/อาหารทะเลสด 1-2 วัน
- นมสดพาสเจอไรซ์ 5-7 วัน ไข่ไก่ 21 วัน ผักใบเขียว 3-5 วัน
- ถ้าในรูปไม่มีอาหารเลย ให้ตอบ []`;

export const RECIPE_PROMPT = (items) => `คุณเป็นเชฟที่ช่วยลดขยะอาหาร
ของในตู้เย็นที่ใกล้หมดอายุ (เรียงจากใกล้หมดอายุที่สุด):
${items.map((i) => `- ${i.name} (${i.quantity || "ไม่ระบุ"}) เหลือ ${i.days_left} วัน`).join("\n")}

แนะนำเมนู 3 เมนู ที่ใช้ของที่ใกล้หมดอายุก่อน ทำง่ายสำหรับนักศึกษาที่อยู่หอ
ตอบเป็น JSON array เท่านั้น แต่ละเมนูมี:
- title: ชื่อเมนูภาษาไทย
- uses: array ชื่อของในตู้เย็นที่ใช้
- missing: array ของที่ต้องซื้อเพิ่ม (ถ้าไม่ต้องซื้อให้เป็น [])
- steps: สรุปวิธีทำสั้นๆ ไม่เกิน 3 ประโยค
ห้ามใช้ของที่ไม่อยู่ในรายการ ยกเว้นเครื่องปรุงพื้นฐาน (เกลือ น้ำปลา น้ำมัน) ให้ใส่ใน missing ถ้าต้องซื้อ`;

export const NOTIFY_MENU_PROMPT = (items) => `ของในตู้เย็นที่ใกล้หมดอายุ:
${items.map((i) => `- ${i.name} เหลือ ${i.days_left} วัน`).join("\n")}

แนะนำ 1 เมนูง่ายๆ ที่ใช้ของใกล้หมดอายุก่อน และบอกของที่ต้องซื้อเพิ่ม (ถ้ามี)
ตอบเป็น JSON object เท่านั้น: {"menu": "ชื่อเมนู", "missing": ["ของที่ขาด"]}`;

// รายชื่อรุ่นสำรอง: ลองตามลำดับ ตัวไหนเต็ม/ยุ่ง/ไม่มีในบัญชีจะข้ามไปตัวถัดไป
// (แก้รายชื่อได้ตามที่เห็นในลิงก์ .../v1beta/models?key=...)
const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];
const ATTEMPT_TIMEOUT_MS = 14000; // รอแต่ละรุ่นไม่เกิน 14 วินาที (4 รุ่น รวมไม่เกิน 60 วิของ route.js)
const SKIP_STATUS = [404, 429, 500, 502, 503, 504]; // สถานะที่ให้ข้ามไปรุ่นถัดไป

export async function askGemini({ prompt, image }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY");

  // ถ้าตั้ง GEMINI_MODEL ไว้ ให้ลองตัวนั้นก่อน แล้วค่อยตามด้วยรุ่นสำรอง
  const models = [
    ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
    ...FALLBACK_MODELS,
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  const parts = [{ text: prompt }];
  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  let data;
  const failures = [];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
          signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        }
      );
      if (res.ok) {
        data = await res.json();
        break;
      }
      failures.push(`${model}: ${res.status}`);
      if (!SKIP_STATUS.includes(res.status)) {
        // error แบบอื่น (เช่น 400, 401, 403) ลองรุ่นอื่นก็ไม่ช่วย ให้แจ้งทันที
        const detail = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
      }
    } catch (err) {
      if (err.message.startsWith("Gemini API error")) throw err;
      failures.push(`${model}: ${err.message}`); // timeout หรือเน็ตหลุด -> ข้ามไปรุ่นถัดไป
    }
  }

  if (!data) {
    throw new Error(`เรียก AI ไม่สำเร็จทุกรุ่น (${failures.join(", ")}) กรุณากดถ่ายใหม่อีกครั้ง`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI ตอบกลับไม่ใช่ JSON: ${cleaned.slice(0, 200)}`);
  }
}
