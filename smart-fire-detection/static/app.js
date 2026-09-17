const $ = (id) => document.getElementById(id);

let camOn = false;
let prevFrame = null;
let audioCtx = null;
let beeping = false;
let cameraInterval = null;


// ---------- API helper ----------

async function api(path, body) {
  const opt = body
    ? {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    : {};

  try {
    const res = await fetch(path, opt);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();

  } catch (error) {
    console.error("API Error:", error);
    return {};
  }
}


// ---------- Camera smoke analysis ----------
// Plain JavaScript + Canvas pixel analysis

$("camBtn").onclick = async () => {

  if (camOn) return;

  try {

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: {
          ideal: 320
        },
        height: {
          ideal: 240
        },
        facingMode: "user"
      },
      audio: false
    });

    const video = $("cam");

    // Attach camera stream
    video.srcObject = stream;

    // Make sure browser allows the video to render
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    // Wait until camera video metadata is available
    await new Promise((resolve) => {

      if (video.readyState >= 2) {
        resolve();
        return;
      }

      video.onloadedmetadata = () => {
        resolve();
      };

    });

    // Explicitly start video playback
    await video.play();

    camOn = true;

    $("camBtn").textContent = "Camera running";
    $("camMsg").textContent = "analyzing frames";

    // Prevent duplicate intervals
    if (cameraInterval) {
      clearInterval(cameraInterval);
    }

    cameraInterval = setInterval(analyzeFrame, 1000);

    // Run first analysis immediately
    analyzeFrame();

  } catch (e) {

    console.error("Camera error:", e);

    camOn = false;

    $("camBtn").textContent = "Start Camera";

    $("camMsg").textContent =
      "camera blocked: " + e.name;

  }
};


// ---------- Analyze camera frame ----------

function analyzeFrame() {

  const video = $("cam");

  // Camera hasn't produced a usable frame yet
  if (
    !video ||
    !video.videoWidth ||
    !video.videoHeight
  ) {
    return;
  }

  const c = $("work");

  if (!c) return;

  const ctx = c.getContext("2d", {
    willReadFrequently: true
  });

  // Draw current camera frame onto hidden canvas
  ctx.drawImage(
    video,
    0,
    0,
    c.width,
    c.height
  );

  const frame = ctx.getImageData(
    0,
    0,
    c.width,
    c.height
  ).data;

  let grayPixels = 0;
  let movedPixels = 0;

  const total = c.width * c.height;


  // Analyze pixels
  for (let i = 0; i < frame.length; i += 4) {

    const r = frame[i];
    const g = frame[i + 1];
    const b = frame[i + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    const brightness =
      (r + g + b) / 3;


    // Smoke assumption:
    // low colour saturation + mid/high brightness
    // = grayish haze

    if (
      max - min < 22 &&
      brightness > 95 &&
      brightness < 232
    ) {
      grayPixels++;
    }


    // Detect movement between frames
    if (prevFrame) {

      const d =
        Math.abs(r - prevFrame[i]) +
        Math.abs(g - prevFrame[i + 1]) +
        Math.abs(b - prevFrame[i + 2]);

      if (d > 34) {
        movedPixels++;
      }
    }
  }


  // Save current frame for next comparison
  prevFrame = new Uint8ClampedArray(frame);


  const grayRatio =
    grayPixels / total;

  const motionRatio =
    movedPixels / total;


  // Smoke is considered:
  // 75% gray/hazy appearance
  // 25% movement/drifting

  let score =
    grayRatio * 0.75 +
    Math.min(motionRatio * 3, 1) * 0.25;


  // Keep score between 0 and 1
  score = Math.min(
    Math.round(score * 100) / 100,
    1
  );


  // Update progress bar
  $("visionBar").style.width =
    (score * 100) + "%";


  // Update bar state
  if (score >= 0.55) {

    $("visionBar").style.background =
      "#f87171";

  } else if (score >= 0.30) {

    $("visionBar").style.background =
      "#fbbf24";

  } else {

    $("visionBar").style.background =
      "#4ade80";
  }


  // Update text
  $("camMsg").textContent =
    "score " + score.toFixed(2);


  // Send camera result to backend
  api("/api/vision", {
    confidence: score
  });
}


// ---------- Buzzer ----------

function buzz() {

  if (
    !$("sound").checked ||
    beeping
  ) {
    return;
  }

  beeping = true;

  try {

    audioCtx =
      audioCtx ||
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

    // Resume audio context if browser suspended it
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc =
      audioCtx.createOscillator();

    const gain =
      audioCtx.createGain();

    osc.type = "square";

    osc.frequency.value = 880;

    gain.gain.value = 0.06;

    osc
      .connect(gain)
      .connect(audioCtx.destination);

    osc.start();

    setTimeout(() => {

      osc.stop();

      beeping = false;

    }, 400);

  } catch (error) {

    console.error(
      "Buzzer error:",
      error
    );

    beeping = false;
  }
}


// ---------- Dashboard polling ----------

async function refresh() {

  const d = await api("/api/latest");

  if (!d || d.status === "empty") {
    return;
  }


  // Overall status
  $("status").textContent =
    d.level;

  $("status").className =
    "status " +
    d.level.toLowerCase();


  // Reason
  $("reason").textContent =
    d.reason;


  // Sensor values
  $("smoke").textContent =
    d.smoke;

  $("temp").textContent =
    d.temperature + " °C";

  $("hum").textContent =
    d.humidity + " %";

  $("flame").textContent =
    d.flame
      ? "DETECTED"
      : "clear";


  // Camera score
  $("vision").textContent =
    Number(d.vision_smoke || 0).toFixed(2);


  // Buzzer
  $("buzzer").textContent =
    d.buzzer
      ? "ON"
      : "OFF";


  // ---------- Highlight dangerous values ----------

  $("smoke").className =
    "value" +
    (d.smoke > 400
      ? " hot"
      : "");


  $("temp").className =
    "value" +
    (d.temperature > 50
      ? " hot"
      : "");


  $("flame").className =
    "value" +
    (d.flame
      ? " hot"
      : "");


  $("buzzer").className =
    "value" +
    (d.buzzer
      ? " hot"
      : "");


  // Sound alert
  if (d.buzzer) {
    buzz();
  }


  // Charts and alerts
  const history =
    await api("/api/history?limit=30");

  drawChart(history);


  const alerts =
    await api("/api/alerts?limit=15");

  drawAlerts(alerts);
}


// ---------- Smoke trend chart ----------

function drawChart(rows) {

  const c = $("chart");

  if (!c) return;

  const ctx =
    c.getContext("2d");

  ctx.clearRect(
    0,
    0,
    c.width,
    c.height
  );


  if (!rows || !rows.length) {
    return;
  }


  const pad = 30;

  const w =
    c.width - pad * 2;

  const h =
    c.height - pad * 2;

  const maxVal = 900;


  // Grid
  ctx.strokeStyle =
    "#222a34";

  ctx.lineWidth = 1;


  for (
    let i = 0;
    i <= 4;
    i++
  ) {

    const y =
      pad + (h / 4) * i;

    ctx.beginPath();

    ctx.moveTo(
      pad,
      y
    );

    ctx.lineTo(
      pad + w,
      y
    );

    ctx.stroke();
  }


  // Smoke threshold line
  const ty =
    pad +
    h -
    (400 / maxVal) * h;


  ctx.strokeStyle =
    "#f8717155";

  ctx.setLineDash([
    5,
    4
  ]);

  ctx.beginPath();

  ctx.moveTo(
    pad,
    ty
  );

  ctx.lineTo(
    pad + w,
    ty
  );

  ctx.stroke();

  ctx.setLineDash([]);


  // Main smoke graph
  ctx.strokeStyle =
    "#60a5fa";

  ctx.lineWidth = 2;

  ctx.beginPath();


  rows.forEach((r, i) => {

    const x =
      pad +
      (w /
        Math.max(
          rows.length - 1,
          1
        )) *
        i;


    const y =
      pad +
      h -
      (
        Math.min(
          Number(r.smoke) || 0,
          maxVal
        ) /
        maxVal
      ) *
        h;


    if (i) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
    }

  });


  ctx.stroke();


  // Warning / fire points
  rows.forEach((r, i) => {

    if (r.level === "NORMAL") {
      return;
    }


    const x =
      pad +
      (w /
        Math.max(
          rows.length - 1,
          1
        )) *
        i;


    const y =
      pad +
      h -
      (
        Math.min(
          Number(r.smoke) || 0,
          maxVal
        ) /
        maxVal
      ) *
        h;


    ctx.fillStyle =
      r.level === "FIRE"
        ? "#f87171"
        : "#fbbf24";


    ctx.beginPath();

    ctx.arc(
      x,
      y,
      4,
      0,
      Math.PI * 2
    );

    ctx.fill();

  });


  // Labels
  ctx.fillStyle =
    "#7b8593";

  ctx.font =
    "11px sans-serif";

  ctx.fillText(
    "900",
    4,
    pad + 4
  );

  ctx.fillText(
    "0",
    14,
    pad + h + 4
  );
}


// ---------- Alert table ----------

function drawAlerts(rows) {

  const tbody =
    $("alerts");

  if (!tbody) return;


  if (
    !rows ||
    !rows.length
  ) {

    tbody.innerHTML =
      '<tr>' +
      '<td colspan="3" class="muted">' +
      'No alerts yet' +
      '</td>' +
      '</tr>';

    return;
  }


  tbody.innerHTML =
    rows
      .map((a) => {

        return `
          <tr>
            <td>${a.ts}</td>
            <td class="${a.level.toLowerCase()}">
              ${a.level}
            </td>
            <td>${a.reason}</td>
          </tr>
        `;

      })
      .join("");
}


// ---------- Fire simulation ----------

$("demoBtn").onclick = () => {

  api("/api/demo", {
    on: true,
    seconds: 20
  });

};


// ---------- Reset database ----------

$("resetBtn").onclick = async () => {

  await api(
    "/api/reset",
    {}
  );

  await refresh();

};


// ---------- Start dashboard ----------

refresh();

setInterval(
  refresh,
  2000
);
