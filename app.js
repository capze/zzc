const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const expressionLabel = document.getElementById('expressionLabel');
const speechStatus = document.getElementById('speechStatus');
const startButton = document.getElementById('startButton');

let camera = null;
let lastExpression = '';
let lastSpeakAt = 0;
const speakCooldownMs = 2200;

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults(onResults);

startButton.addEventListener('click', () => {
  startButton.disabled = true;
  startButton.textContent = '正在啟動相機...';
  initializeCamera();
});

function initializeCamera() {
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({image: videoElement});
    },
    width: 720,
    height: 640,
    facingMode: 'user'
  });
  camera.start().then(() => {
    startButton.textContent = '相機已啟動';
    startButton.style.display = 'none';
  }).catch((error) => {
    console.error(error);
    startButton.disabled = false;
    startButton.textContent = '啟動相機';
    alert('相機啟動失敗，請確認已允許使用相機。');
  });
}

function onResults(results) {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    drawVideoFrame(results.image);
    expressionLabel.textContent = '尚未偵測到臉部';
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  drawAnnotations(results.image, landmarks);

  const expression = classifyExpression(landmarks);
  expressionLabel.textContent = expression.label;
  maybeSpeak(expression.label);
}

function drawVideoFrame(image) {
  canvasElement.width = image.width;
  canvasElement.height = image.height;
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.restore();
}

function drawAnnotations(image, landmarks) {
  canvasElement.width = image.width;
  canvasElement.height = image.height;
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(image, 0, 0, canvasElement.width, canvasElement.height);

  drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#5b98f5', lineWidth: 1});
  drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {color: '#a1f7d3', lineWidth: 2});
  drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {color: '#a1f7d3', lineWidth: 2});
  drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {color: '#f59e0b', lineWidth: 2});
  drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#e2e8f0', lineWidth: 1});
  drawLandmarks(canvasCtx, landmarks, {color: '#ffffff', radius: 1});
  canvasCtx.restore();
}

function classifyExpression(landmarks) {
  const distance = (i, j) => {
    const dx = landmarks[i].x - landmarks[j].x;
    const dy = landmarks[i].y - landmarks[j].y;
    return Math.hypot(dx, dy);
  };

  const mouthWidth = distance(61, 291);
  const mouthHeight = distance(13, 14);
  const faceWidth = distance(127, 356);
  const leftEyebrow = distance(70, 63);
  const rightEyebrow = distance(300, 293);
  const browGap = (leftEyebrow + rightEyebrow) / 2;

  const mouthOpenRatio = mouthHeight / faceWidth;
  const smileRatio = mouthWidth / faceWidth;
  const browRaise = browGap / faceWidth;

  if (mouthOpenRatio > 0.26 && browRaise > 0.12) {
    return {label: '哇！你看起來好驚訝！'};
  }
  if (smileRatio > 0.42) {
    return {label: '你今天看起來心情不錯喔！！'};
  }
  if (mouthOpenRatio > 0.17) {
    return {label: '你看起來有點開心！'};
  }
  return {label: '保持自然表情，我會持續偵測。'};
}

function maybeSpeak(message) {
  const now = Date.now();
  if (message === lastExpression && now - lastSpeakAt < speakCooldownMs) {
    return;
  }

  lastExpression = message;
  lastSpeakAt = now;
  speechStatus.textContent = '正在語音回饋...';

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'zh-TW';
  utterance.rate = 1;
  utterance.onend = () => {
    speechStatus.textContent = '語音回饋完成';
  };
  utterance.onerror = () => {
    speechStatus.textContent = '語音回饋失敗';
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
