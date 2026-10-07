import "./globals.css";

export const metadata = {
  title: "ตู้เย็นอัจฉริยะ",
  description: "ถ่ายรูปของที่ซื้อ ให้ AI บอกว่าอะไรจะหมดอายุก่อน",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
