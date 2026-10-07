# 🧊 ตู้เย็นอัจฉริยะ (Smart Fridge)

เว็บที่ช่วยไม่ให้ลืมของในตู้เย็น: ถ่ายรูปของที่ซื้อมา -> AI ระบุรายการและประเมินวันหมดอายุ -> แสดงสีเขียว/เหลือง/แดง -> แนะนำเมนู -> แจ้งเตือน Telegram ทุกเช้า

โปรเจกต์ปลายภาควิชา Artificial Intelligence in Modern Life (040603005)

## ฟีเจอร์

- อัปโหลดรูปของ/ใบเสร็จ ให้ AI (Gemini) อ่านรายการ จำนวน ราคา และอายุการเก็บ
- ตรวจแก้ผลของ AI ก่อนบันทึก (ช่องที่ AI ไม่มั่นใจจะไฮไลต์)
- รายการของเรียงตามวันหมดอายุ สีเขียว/เหลือง/แดง
- ปุ่ม "วันนี้กินอะไรดี" แนะนำ 3 เมนูจากของที่ใกล้เสียก่อน
- สรุปเงินที่ประหยัดได้ (กดว่ากินแล้ว) และเงินที่เสียไป (กดว่าทิ้ง)
- แจ้งเตือน Telegram ทุกเช้า พร้อมเมนูแนะนำ ผ่าน GitHub Actions

## โครงสร้าง

```
app/                 หน้าเว็บ (Next.js) และ API routes
  api/analyze        รูป -> AI -> รายการฉบับร่าง
  api/items          ดู/เพิ่ม/แก้/ลบ ของใน Supabase
  api/recipes        แนะนำเมนู
lib/ai.mjs           prompt ทั้งหมด + ฟังก์ชันเรียก Gemini
lib/supabase.mjs     ตัวเชื่อม Supabase
scripts/notify.mjs   สคริปต์ส่ง Telegram
supabase/schema.sql  ตารางฐานข้อมูล
.github/workflows/   ตั้งเวลาแจ้งเตือน
```

## วิธีติดตั้ง

1. **Supabase**: สร้างโปรเจกต์ใหม่ แล้วรัน `supabase/schema.sql` ใน SQL Editor
2. **Gemini**: ขอ API key ที่ https://aistudio.google.com/apikey
3. **Telegram**: คุยกับ @BotFather เพื่อสร้างบอทและเอา token แล้วส่งข้อความหาบอท 1 ครั้ง จากนั้นเปิด `https://api.telegram.org/bot<TOKEN>/getUpdates` เพื่อดู chat id
4. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจริง
5. รันในเครื่อง:

```bash
npm install
npm run dev        # เปิด http://localhost:3000
npm run notify     # ลองส่งแจ้งเตือน Telegram (ต้องมี env ครบ)
```

## Deploy

- **เว็บ**: นำเข้า repo ที่ Vercel แล้วตั้ง Environment Variables 4 ตัว คือ `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`
- **แจ้งเตือน**: ที่ GitHub repo > Settings > Secrets and variables > Actions เพิ่ม `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` ระบบรันทุกวัน 07:00 (เวลาไทย) และกดรันเองได้ที่แท็บ Actions > Daily fridge notification > Run workflow

## ความปลอดภัย

- key ทุกตัวอยู่ใน environment variables ห้าม commit `.env.local`
- ฐานข้อมูลเปิด RLS และเข้าถึงผ่าน service role key ฝั่งเซิร์ฟเวอร์เท่านั้น

## ข้อจำกัด

เวอร์ชันนี้เป็นแบบผู้ใช้คนเดียว (ไม่มีระบบล็อกอิน) ใครมีลิงก์เว็บก็เห็นข้อมูลชุดเดียวกัน ถ้าจะใช้จริงควรเพิ่ม Supabase Auth

## การแบ่งงาน

- คนที่ 1 (AI + Backend): prompt อ่านรูป, API, เมนูแนะนำ, เชื่อม Supabase
- คนที่ 2 (Frontend + แจ้งเตือน + Deploy): หน้าเว็บ, Telegram bot, GitHub Actions, Vercel, README
