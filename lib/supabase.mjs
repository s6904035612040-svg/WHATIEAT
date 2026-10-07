import { createClient } from "@supabase/supabase-js";

// ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น (API routes และสคริปต์ notify) เพราะใช้ service role key
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
