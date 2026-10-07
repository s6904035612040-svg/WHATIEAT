import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase.mjs";
import { notifyIfNearExpiry } from "../../../lib/telegram.mjs"; // เพิ่ม: แจ้ง Telegram ทันที

export const dynamic = "force-dynamic";

const EDITABLE = ["name", "quantity", "category", "expiry_date", "price_thb", "status"];
const STATUSES = ["active", "eaten", "wasted"];

function fail(err, status = 500) {
  console.error(err);
  return NextResponse.json({ error: err.message || String(err) }, { status });
}

// ดึงของทั้งหมด: ของที่ยังอยู่เรียงตามวันหมดอายุ + สถิติเงินที่ประหยัด/เสียไป
export async function GET() {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("items")
      .select("*")
      .order("expiry_date", { ascending: true });
    if (error) throw error;

    const sum = (status) =>
      data
        .filter((i) => i.status === status)
        .reduce((s, i) => s + Number(i.price_thb || 0), 0);

    return NextResponse.json({
      items: data.filter((i) => i.status === "active"),
      stats: {
        saved_thb: sum("eaten"),
        wasted_thb: sum("wasted"),
        eaten_count: data.filter((i) => i.status === "eaten").length,
        wasted_count: data.filter((i) => i.status === "wasted").length,
      },
    });
  } catch (err) {
    return fail(err);
  }
}

// บันทึกรายการหลายชิ้นที่ผู้ใช้ตรวจแล้ว
export async function POST(req) {
  try {
    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return fail(new Error("ไม่มีรายการให้บันทึก"), 400);
    }
    const rows = items.map((i) => ({
      name: String(i.name || "").trim(),
      quantity: i.quantity || null,
      category: i.category || null,
      added_date: i.added_date,
      expiry_date: i.expiry_date,
      price_thb: Number(i.price_thb) || 0,
      confidence: i.confidence ?? null,
    }));
    if (rows.some((r) => !r.name || !r.expiry_date)) {
      return fail(new Error("ทุกรายการต้องมีชื่อและวันหมดอายุ"), 400);
    }

    const db = getSupabase();
    const { data, error } = await db.from("items").insert(rows).select();
    if (error) throw error;

    // เพิ่ม: ถ้ามีชิ้นที่ใกล้หมดอายุ ส่ง Telegram ทันที (ต้อง await ไม่งั้น Vercel ตัดก่อนส่ง)
    await notifyIfNearExpiry(data);

    return NextResponse.json({ items: data });
  } catch (err) {
    return fail(err);
  }
}

// แก้ไขของชิ้นเดียว หรือเปลี่ยนสถานะ (กินแล้ว/ทิ้ง)
export async function PATCH(req) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return fail(new Error("ต้องระบุ id"), 400);

    const patch = {};
    for (const key of EDITABLE) {
      if (key in fields) patch[key] = fields[key];
    }
    if ("status" in patch && !STATUSES.includes(patch.status)) {
      return fail(new Error("status ไม่ถูกต้อง"), 400);
    }

    const db = getSupabase();
    const { data, error } = await db.from("items").update(patch).eq("id", id).select().single();
    if (error) throw error;

    // เพิ่ม: แก้วันหมดอายุของที่ยังอยู่ในตู้เย็น -> เช็คแล้วแจ้งทันที
    if ("expiry_date" in patch && data.status === "active") {
      await notifyIfNearExpiry([data]);
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return fail(new Error("ต้องระบุ id"), 400);
    const db = getSupabase();
    const { error } = await db.from("items").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
