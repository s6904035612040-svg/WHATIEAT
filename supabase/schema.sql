-- รันใน Supabase: SQL Editor > New query > วางแล้วกด Run

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity text,
  category text,
  added_date date not null default current_date,
  expiry_date date not null,
  price_thb numeric default 0,
  confidence numeric,
  status text not null default 'active'
    check (status in ('active', 'eaten', 'wasted')),
  created_at timestamptz not null default now()
);

create index if not exists items_status_expiry_idx on items (status, expiry_date);

-- เปิด RLS โดยไม่ใส่ policy: เข้าถึงได้เฉพาะผ่าน service role key ฝั่งเซิร์ฟเวอร์เท่านั้น
alter table items enable row level security;
