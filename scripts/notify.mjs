// รันโดย GitHub Actions ทุกเช้า (หรือรันเองด้วย: npm run notify)
// ดึงของที่หมดอายุภายใน 2 วัน -> ให้ AI แนะนำเมนู -> ส่งเข้า Telegram

import { getSupabase } from "../lib/supabase.mjs";
import { askGemini, NOTIFY_MENU_PROMPT } from "../lib/ai.mjs";
import { todayBangkok, addDays, daysBetween } from "../lib/dates.mjs";

const WARN_DAYS = 2;

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`Telegram error ${res.status}: ${await res.text()}`);
}

function dayText(days) {
  if (days < 0) return `หมดอายุแล้ว ${Math.abs(days)} วัน`;
  if (days === 0) return "หมดอายุวันนี้";
  if (days === 1) return "หมดอายุพรุ่งนี้";
  return `อีก ${days} วันหมดอายุ`;
}

async function main() {
  const db = getSupabase();
  const today = todayBangkok();

  const { data, error } = await db
    .from("items")
    .select("name, quantity, expiry_date")
    .eq("status", "active")
    .lte("expiry_date", addDays(today, WARN_DAYS))
    .order("expiry_date", { ascending: true });
  if (error) throw error;

  if (!data.length) {
    await sendTelegram("🧊 วันนี้ตู้เย็นปลอดภัย ไม่มีของใกล้หมดอายุ ✅");
    console.log("ไม่มีของใกล้หมดอายุ");
    return;
  }

  const items = data.map((i) => ({ ...i, days_left: daysBetween(today, i.expiry_date) }));

  const lines = items.map((i) => {
    const icon = i.days_left <= 0 ? "🔴" : i.days_left === 1 ? "🟠" : "🟡";
    return `${icon} ${i.name} — ${dayText(i.days_left)}`;
  });

  let menuText = "";
  try {
    const result = await askGemini({ prompt: NOTIFY_MENU_PROMPT(items) });
    if (result?.menu) {
      menuText = `\n\n🍳 ลองทำ "${result.menu}" ไหม`;
      if (result.missing?.length) menuText += `\nขาดแค่: ${result.missing.join(", ")}`;
    }
  } catch (err) {
    // ถ้า AI ล่ม ก็ยังต้องส่งแจ้งเตือนรายการของอยู่ดี
    console.warn("ขอเมนูจาก AI ไม่สำเร็จ:", err.message);
  }

  await sendTelegram(`🧊 ของใกล้หมดอายุวันนี้\n\n${lines.join("\n")}${menuText}`);
  console.log(`ส่งแจ้งเตือน ${items.length} รายการแล้ว`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
