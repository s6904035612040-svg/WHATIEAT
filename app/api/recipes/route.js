import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase.mjs";
import { askGemini, RECIPE_PROMPT } from "../../../lib/ai.mjs";
import { todayBangkok, daysBetween } from "../../../lib/dates.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// "วันนี้กินอะไรดี": เอาของที่ใกล้หมดอายุที่สุด 8 ชิ้นไปให้ AI แนะนำเมนู
export async function POST() {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("items")
      .select("name, quantity, expiry_date")
      .eq("status", "active")
      .order("expiry_date", { ascending: true })
      .limit(8);
    if (error) throw error;

    if (!data.length) {
      return NextResponse.json({ error: "ตู้เย็นยังว่างอยู่ ลองอัปโหลดรูปของที่ซื้อมาก่อน" }, { status: 400 });
    }

    const today = todayBangkok();
    const items = data.map((i) => ({ ...i, days_left: daysBetween(today, i.expiry_date) }));

    const result = await askGemini({ prompt: RECIPE_PROMPT(items) });
    const recipes = Array.isArray(result) ? result : result?.recipes ?? [];
    return NextResponse.json({ recipes: recipes.slice(0, 3), based_on: items });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
