const $ = (id) => document.getElementById(id);

let camOn = false;
let prevFrame = null;
let audioCtx = null;
let beeping = false;

async function api(path, body) {
  const opt = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {};
  const res = await fetch(path, opt);
  return res.json();
}

/* ---------- camera smoke analysis (plain JS, canvas pixels) ---------- */

$("camBtn").onclick = async () => {
  if (camOn) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
    $("cam").srcObject = stream;
    camOn = true;
    $("camBtn").textContent = "Camera running";
    $("camMsg").textContent = "analyzing frames";
    setInterval(analyzeFrame, 1000);
  } catch (e) {
    $("camMsg").textContent = "camera blocked: " + e.name;
  }
};

function analyzeFrame() {
  const video = $("cam");
  if (!video.videoWidth) return;

  const c = $("work");
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, c.width, c.height);
  const frame = ctx.getImageData(0, 0, c.width, c.height).data;

  let grayPixels = 0, movedPixels = 0, total = c.width * c.height;

  for (let i = 0; i < frame.length; i += 4) {
    const r = frame[i], g = frame[i + 1], b = frame[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const brightness = (r + g + b) / 3;

    // smoke = low colour saturation + mid/high brightness (grayish haze)
    if (max - min < 22 && brightness > 95 && brightness < 232) grayPixels++;

    if (prevFrame) {
      const d = Math.abs(r - prevFrame[i]) + Math.abs(g - prevFrame[i + 1]) + Math.abs(b - prevFrame[i + 2]);
      if (d > 34) movedPixels++;
    }
  }

  prevFrame = frame;

  const grayRatio = grayPixels / total;
  const motionRatio = movedPixels / total;
  // smoke is hazy AND drifting -> combine both evidences
  let score = grayRatio * 0.75 + Math.min(motionRatio * 3, 1) * 0.25;
  score = Math.min(Math.round(score * 100) / 100, 1);

  $("visionBar").style.width = (score * 100) + "%";
  $("visionBar").style.background = score >= 0.55 ? "#f87171" : score >= 0.3 ? "#fbbf24" : "#4ade80";
  $("camMsg").textContent = "score " + score.toFixed(2);

  api("/api/vision", { confidence: score });
}

/* ---------- buzzer ---------- */

function buzz() {
  if (!$("sound").checked || beeping) return;
  beeping = true;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.value = 0.06;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  setTimeout(() => { osc.stop(); beeping = false; }, 400);
}

/* ---------- dashboard polling ---------- */

async function refresh() {
  const d = await api("/api/latest");
  if (d.status === "empty") return;

  $("status").textContent = d.level;
  $("status").className = "status " + d.level.toLowerCase();
  $("reason").textContent = d.reason;

  $("smoke").textContent = d.smoke;
  $("temp").textContent = d.temperature + " \u00B0C";
  $("hum").textContent = d.humidity + " %";
  $("flame").textContent = d.flame ? "DETECTED" : "clear";
  $("vision").textContent = d.vision_smoke.toFixed(2);
  $("buzzer").textContent = d.buzzer ? "ON" : "OFF";

  $("smoke").className = "value" + (d.smoke > 400 ? " hot" : "");
  $("temp").className = "value" + (d.temperature > 50 ? " hot" : "");
  $("flame").className = "value" + (d.flame ? " hot" : "");
  $("buzzer").className = "value" + (d.buzzer ? " hot" : "");

  if (d.buzzer) buzz();

  drawChart(await api("/api/history?limit=30"));
  drawAlerts(await api("/api/alerts?limit=15"));
}

function drawChart(rows) {
  const c = $("chart"), ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  if (!rows.length) return;

  const pad = 30, w = c.width - pad * 2, h = c.height - pad * 2;
  const maxVal = 900;

  ctx.strokeStyle = "#222a34";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + w, y); ctx.stroke();
  }

  // threshold line
  const ty = pad + h - (400 / maxVal) * h;
  ctx.strokeStyle = "#f8717155";
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(pad, ty); ctx.lineTo(pad + w, ty); ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  rows.forEach((r, i) => {
    const x = pad + (w / Math.max(rows.length - 1, 1)) * i;
    const y = pad + h - (Math.min(r.smoke, maxVal) / maxVal) * h;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();

  rows.forEach((r, i) => {
    if (r.level === "NORMAL") return;
    const x = pad + (w / Math.max(rows.length - 1, 1)) * i;
    const y = pad + h - (Math.min(r.smoke, maxVal) / maxVal) * h;
    ctx.fillStyle = r.level === "FIRE" ? "#f87171" : "#fbbf24";
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = "#7b8593";
  ctx.font = "11px sans-serif";
  ctx.fillText("900", 4, pad + 4);
  ctx.fillText("0", 14, pad + h + 4);
}

function drawAlerts(rows) {
  const tbody = $("alerts");
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="muted">No alerts yet</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((a) =>
    `<tr><td>${a.ts}</td><td class="${a.level.toLowerCase()}">${a.level}</td><td>${a.reason}</td></tr>`
  ).join("");
}

$("demoBtn").onclick = () => api("/api/demo", { on: true, seconds: 20 });
$("resetBtn").onclick = async () => { await api("/api/reset", {}); refresh(); };

refresh();
setInterval(refresh, 2000);
