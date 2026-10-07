import "./globals.css";

export const metadata = {
  title: "WHATIEAT",
  description: "ข้าวทุกจาน อาหารทุกอย่าง อย่ากินทิ้งขว้าง เป็นของมีค่า ผู้คนอดอยาก มีมากหนักหนา สงสารบรรดา เด็กตาดำๆ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
