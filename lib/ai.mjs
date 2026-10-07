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

// ตั้งค่าการลองใหม่ (retry) เมื่อ Gemini ยุ่ง/ช้า
const MAX_ATTEMPTS = 100;                 // ลองสูงสุด 100 รอบ
const ATTEMPT_TIMEOUT_MS = 18000;       // รอแต่ละรอบไม่เกิน 18 วินาที (รวมไม่เกิน 60 วิของ route.js)
const RETRY_STATUS = [429, 500, 502, 503, 504]; // สถานะที่ควรลองใหม่

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function askGemini({ prompt, image }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY");

  // ค่าเริ่มต้นเป็น gemini-3.8-flash ตามที่ Google แจ้งใน error
  // ถ้าตั้ง GEMINI_MODEL ใน Vercel/GitHub ไว้ ค่านั้นจะถูกใช้แทน
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const parts = [{ text: prompt }];
  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  let data;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });

      if (res.ok) {
        data = await res.json();
        break;
      }

      const detail = await res.text();
      lastError = new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
      // ถ้าไม่ใช่ error ชั่วคราว (เช่น 400, 401, 404) ไม่ต้องลองใหม่
      if (!RETRY_STATUS.includes(res.status)) throw lastError;
    } catch (err) {
      if (err === lastError) throw err; // error ที่ไม่ควรลองใหม่
      // timeout หรือเน็ตหลุด -> ลองใหม่
      lastError = new Error(`เรียก AI ไม่สำเร็จ: ${err.message}`);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(attempt * 1500); // รอ 1.5 วิ แล้ว 3 วิ
  }

  if (!data) {
    throw new Error(
      `${lastError?.message ?? "เรียก AI ไม่สำเร็จ"} (ลองแล้ว ${MAX_ATTEMPTS} รอบ กรุณากดถ่ายใหม่อีกครั้ง)`
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI ตอบกลับไม่ใช่ JSON: ${cleaned.slice(0, 200)}`);
  }
}
