// ส่งแจ้งเตือน Telegram ทันทีตอนบันทึกของที่ใกล้หมดอายุ
// ถ้าส่งไม่สำเร็จ จะไม่ทำให้การบันทึกของพัง แต่จะเขียนเหตุผลลง Logs ของ Vercel
import { todayBangkok, addDays } from "./dates.mjs";

const NEAR_DAYS = 2; // ถือว่า "ใกล้หมดอายุ" เมื่อเหลือไม่เกิน 2 วัน

export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("[telegram] ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN หรือ TELEGRAM_CHAT_ID ใน Vercel");
    return false;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`[telegram] ส่งไม่สำเร็จ ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.ok;
}

// รับรายการของที่เพิ่งบันทึก (ต้องมี name กับ expiry_date) แล้วแจ้งเฉพาะที่ใกล้หมดอายุ
export async function notifyIfNearExpiry(items) {
  try {
    const limit = addDays(todayBangkok(), NEAR_DAYS);
    const near = (items || []).filter((x) => x?.expiry_date && x.expiry_date <= limit);
    console.log(`[telegram] ตรวจ ${(items || []).length} ชิ้น ใกล้หมดอายุ ${near.length} ชิ้น (เกณฑ์ <= ${limit})`);
    if (near.length === 0) return;

    const lines = near.map((x) => `• ${x.name} (หมดอายุ ${x.expiry_date})`);
    await sendTelegram(`⚠️ ของใกล้หมดอายุ\n${lines.join("\n")}`);
  } catch (err) {
    console.error("[telegram] แจ้งเตือนไม่สำเร็จ:", err.message);
  }
}
