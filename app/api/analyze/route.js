import { NextResponse } from "next/server";
import { askGemini, READ_IMAGE_PROMPT } from "../../../lib/ai.mjs";
import { todayBangkok, addDays } from "../../../lib/dates.mjs";
export const maxDuration = 60; // รอ AI ได้นานสุด 60 วินาที (ค่าเริ่มต้นสั้นเกินไป)

export const maxDuration = 60;

// รับรูป (data URL) -> ส่งให้ AI -> คืนรายการ "ฉบับร่าง" ให้ผู้ใช้ตรวจแก้ก่อนบันทึก
export async function POST(req) {
  try {
    const { image } = await req.json();
    const match = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(image || "");
    if (!match) {
      return NextResponse.json({ error: "รูปภาพไม่ถูกต้อง" }, { status: 400 });
    }

    const result = await askGemini({
      prompt: READ_IMAGE_PROMPT,
      image: { mimeType: match[1], data: match[2] },
    });

    const list = Array.isArray(result) ? result : result?.items ?? [];
    const today = todayBangkok();

    const items = list
      .filter((x) => x && x.name)
      .map((x) => ({
        name: String(x.name).trim(),
        quantity: x.quantity ? String(x.quantity) : "",
        category: x.category || "อื่นๆ",
        price_thb: Number(x.price_thb) || 0,
        confidence: x.confidence == null ? null : Number(x.confidence),
        added_date: today,
        expiry_date: addDays(today, Math.max(0, Number(x.shelf_life_days) || 3)),
      }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
