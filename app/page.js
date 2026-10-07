"use client";

import { useEffect, useRef, useState } from "react";

const CATEGORIES = ["ผัก", "ผลไม้", "เนื้อสัตว์", "นม/ไข่", "เครื่องดื่ม", "ของแห้ง", "อื่นๆ"];
const REFRESH_MS = 10000; // เพิ่ม: อัปเดตรายการอัตโนมัติทุก 10 วินาที

function todayBangkok() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function daysLeft(expiry) {
  const a = new Date(`${todayBangkok()}T00:00:00Z`).getTime();
  const b = new Date(`${expiry}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function level(days) {
  if (days <= 1) return "red";
  if (days <= 3) return "yellow";
  return "green";
}

function label(days) {
  if (days < 0) return `หมดอายุแล้ว ${Math.abs(days)} วัน`;
  if (days === 0) return "หมดอายุวันนี้";
  return `เหลือ ${days} วัน`;
}

// ย่อรูปก่อนส่ง ให้ AI ตอบเร็วและไม่เกินขนาด request
function resizeImage(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
  return data;
}

export default function Home() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ saved_thb: 0, wasted_thb: 0 });
  const [preview, setPreview] = useState(null);
  const [draft, setDraft] = useState([]);
  const [recipes, setRecipes] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("เบราว์เซอร์นี้เปิดกล้องไม่ได้ (ต้องเปิดผ่าน https หรือ localhost) ลองใช้ปุ่มอัปโหลดรูปแทน");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "ยังไม่ได้อนุญาตให้ใช้กล้อง กดไอคอนกุญแจข้าง URL แล้วอนุญาตกล้อง"
          : `เปิดกล้องไม่สำเร็จ: ${err.message}`
      );
    }
  }

  // ต่อสตรีมกล้องเข้ากับ <video> หลังจากที่ video ถูกแสดงบนหน้าแล้ว
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn]);

  // ปิดกล้องเมื่อออกจากหน้า
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxSize = 1024;
    const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.8);
    stopCamera();
    await analyze(image);
  }

  async function analyze(image) {
    setError("");
    setDraft([]);
    setPreview(image);
    setBusy("analyze");
    try {
      const data = await api("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (!data.items.length) setError("AI ไม่พบอาหารในรูปนี้ ลองถ่ายใหม่ให้ชัดขึ้น");
      setDraft(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  // เพิ่มพารามิเตอร์ silent: ตอนอัปเดตอัตโนมัติจะไม่ขึ้นข้อความ error ถ้าเน็ตสะดุด
  async function load(silent = false) {
    try {
      const data = await api("/api/items");
      setItems(data.items);
      setStats(data.stats);
    } catch (e) {
      if (!silent) setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // เพิ่ม: อัปเดตรายการอัตโนมัติทุก REFRESH_MS (หยุดเมื่อไม่ได้เปิดแท็บนี้)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") load(true);
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick); // กลับมาที่แท็บนี้ดึงทันที
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const image = await resizeImage(file);
      await analyze(image);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = "";
    }
  }

  function updateDraft(index, patch) {
    setDraft((d) => d.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }

  async function saveDraft() {
    setBusy("save");
    setError("");
    try {
      await api("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: draft }),
      });
      setDraft([]);
      setPreview(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function setStatus(id, status) {
    try {
      await api("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(id) {
    if (!confirm("ลบรายการนี้ออกจากระบบ?")) return;
    try {
      await api("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function editExpiry(item) {
    const value = prompt("วันหมดอายุใหม่ (YYYY-MM-DD)", item.expiry_date);
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    try {
      await api("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, expiry_date: value }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function suggest() {
    setBusy("recipe");
    setError("");
    setRecipes(null);
    try {
      const data = await api("/api/recipes", { method: "POST" });
      setRecipes(data.recipes);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="wrap">
      <h1> WHATIEAT</h1>
      <p className="sub">ข้าวทุกจาน อาหารทุกอย่าง อย่ากินทิ้งขว้าง เป็นของมีค่า ผู้คนอดอยาก มีมากหนักหนา สงสารบรรดา เด็กตาดำๆ</p>

      {error && <div className="err">{error}</div>}

      <div className="stats">
        <div className="stat good">
          <b>฿{Math.round(stats.saved_thb).toLocaleString()}</b>
          <span>ประหยัดได้ (กินทันก่อนหมดอายุ)</span>
        </div>
        <div className="stat bad">
          <b>฿{Math.round(stats.wasted_thb).toLocaleString()}</b>
          <span>เสียไป (ต้องทิ้ง)</span>
        </div>
      </div>

      <section className="card">
        <h2>1. เพิ่มของเข้าตู้เย็น</h2>
        <div className="upload">
          {cameraOn ? (
            <div>
              <video ref={videoRef} className="camera" playsInline muted />
              <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
                <button className="primary" onClick={captureFrame}>📸 ถ่ายและให้ AI อ่าน</button>
                <button onClick={stopCamera}>ปิดกล้อง</button>
              </div>
            </div>
          ) : (
            <>
              <div>ถ่ายรูปวัตถุดิบหรือใบเสร็จ</div>
              <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
                <button className="primary" onClick={startCamera} disabled={busy === "analyze"}>
                  📷 เปิดกล้องสแกน
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={busy === "analyze"}>
                  🖼️ อัปโหลดรูป
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                style={{ display: "none" }}
              />
              {preview && <img src={preview} alt="รูปที่ถ่าย" />}
            </>
          )}
        </div>
        {busy === "analyze" && <div className="loading">🫪 รอครับโก๋ โบร๋กำลังมา...</div>}

        {draft.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h2>ตรวจสอบและแก้ไขก่อนบันทึก</h2>
            <p className="sub" style={{ margin: "0 0 10px" }}>
              AI อาจอ่านผิดได้ ช่องสีเหลืองคือรายการที่ AI ไม่มั่นใจ
            </p>
            {draft.map((d, i) => (
              <div className="draft-item" key={i}>
                <input
                  type="text"
                  value={d.name}
                  className={d.confidence != null && d.confidence < 0.6 ? "low" : ""}
                  onChange={(e) => updateDraft(i, { name: e.target.value })}
                />
                <input
                  type="text"
                  value={d.quantity}
                  placeholder="จำนวน"
                  onChange={(e) => updateDraft(i, { quantity: e.target.value })}
                />
                <input
                  type="date"
                  value={d.expiry_date}
                  onChange={(e) => updateDraft(i, { expiry_date: e.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  value={d.price_thb}
                  title="ราคา (บาท)"
