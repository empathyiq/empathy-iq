const WHISPER_URL =
  "https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo";

const TEXT_EMOTION_URL =
  "https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base";

const HF_API_KEY = import.meta.env.VITE_HF_API_KEY;

const recordBtn     = document.getElementById("record");
const stopBtn       = document.getElementById("stop");
const detectTextBtn = document.getElementById("detect-text");

const statusDiv     = document.getElementById("status");
const transcriptDiv = document.getElementById("transcript");
const resultDiv     = document.getElementById("result");
const player        = document.getElementById("player");

let mediaRecorder;
let audioChunks = [];
let audioBlob   = null;
let mediaStream = null;

recordBtn.onclick = async () => {
  resetUI();

  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(mediaStream);
  audioChunks = [];

  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

  mediaRecorder.onstop = () => {
    audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    player.src = URL.createObjectURL(audioBlob);
    player.load();

    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;

    statusDiv.textContent = "Ready – press Detect.";
    detectTextBtn.disabled = false;
  };

  mediaRecorder.start();
  statusDiv.textContent = "Recording…";
  recordBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  mediaRecorder.stop();
  recordBtn.disabled = false;
  stopBtn.disabled = true;
};

detectTextBtn.onclick = async () => {
  if (!audioBlob) return;

  try {
    statusDiv.textContent = "Transcribing…";
    const { text } = await transcribe(audioBlob);
    transcriptDiv.textContent = `Transcript: ${text}`;

    statusDiv.textContent = "Detecting emotion…";
    const { label, score } = await classifyText(text);
    resultDiv.textContent =
      `Emotion: ${label} (${(score * 100).toFixed(1)} %)`;

    statusDiv.textContent = "Done ✔";
  } catch (err) {
    handleError(err);
  }
};

function resetUI() {
  statusDiv.textContent     = "";
  transcriptDiv.textContent = "";
  resultDiv.textContent     = "";
  player.src = "";
  detectTextBtn.disabled  = true;
}

function handleError(err) {
  console.error(err);
  statusDiv.textContent = "Error during analysis.";
  resultDiv.textContent = err.message;
}

async function transcribe(blob) {
  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "audio/wav"
    },
    body: blob
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  return res.json(); 
}

async function classifyText(text) {
  const res = await fetch(TEXT_EMOTION_URL, {
    method : "POST",
    headers: {
      Authorization : `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: text })
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Emotion ${res.status}: ${raw}`);

  const data  = JSON.parse(raw); 
  const preds = Array.isArray(data[0]) ? data[0] : data;
  const top   = preds.sort((a, b) => b.score - a.score)[0] || {};
  return { label: top.label ?? "Unknown", score: top.score ?? 0 };
}
