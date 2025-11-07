// Simulator logic: one active controller, QR pairing, Three.js cube + stream to controller

const waitingEl = document.getElementById('waiting');
const simulatingEl = document.getElementById('simulating');
const controllerUrlEl = document.getElementById('controller-url');
const simIdEl = document.getElementById('sim-id');
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');
const threeContainer = document.getElementById('three-container');

let peer;
let dataConn = null;
let currentCall = null;
let controllerPeerId = null;

let scene, camera, renderer, cube;
let animationId = null;
let stream = null;

// ---------- Init ----------

window.addEventListener('load', () => {
  initThree();
  initPeer();
  setSimulating(false);
});

// ---------- PeerJS setup ----------

function initPeer() {
  peer = new Peer({
    // Configure custom PeerJS server here if desired:
    // host: 'your-peer-server',
    // port: 9000,
    // path: '/peerjs'
  });

  peer.on('open', (id) => {
    log(`PeerJS ready. Simulator ID: ${id}`);
    simIdEl.textContent = `Simulator ID: ${id}`;

    const controllerUrl = `${location.origin}/controller/?simId=${encodeURIComponent(id)}`;
    controllerUrlEl.textContent = controllerUrl;

    new QRCode(document.getElementById('qrcode'), {
      text: controllerUrl,
      width: 220,
      height: 220
    });
  });

  peer.on('connection', (conn) => {
    log(`Incoming data connection from ${conn.peer}`);
    handleNewConnection(conn);
  });

  peer.on('error', (err) => {
    console.error(err);
    log(`Peer error: ${err.type || err}`);
  });
}

// Handle new controller, enforce single connection
function handleNewConnection(conn) {
  // If an existing controller is connected, drop it
  if (dataConn && dataConn.open) {
    log(`Closing previous controller ${dataConn.peer}`);
    try { dataConn.close(); } catch (_) {}
  }
  if (currentCall) {
    try { currentCall.close(); } catch (_) {}
    currentCall = null;
  }
  controllerPeerId = null;

  dataConn = conn;

  conn.on('open', () => {
    log(`Controller ${conn.peer} connected`);
    setSimulating(true);
  });

  conn.on('data', (msg) => {
    if (!msg) return;
    if (msg.type === 'registerViewer' && msg.peerId) {
      controllerPeerId = msg.peerId;
      log(`Registered controller viewer peerId=${controllerPeerId}`);
      startMediaStreamToController();
    } else if (msg.type === 'button') {
      log(`Button ${msg.id} pressed`);
      handleButtonEvent(msg.id);
    }
  });

  conn.on('close', () => {
    log(`Controller ${conn.peer} disconnected`);
    cleanupConnection();
  });

  conn.on('error', (err) => {
    log(`Connection error: ${err}`);
    cleanupConnection();
  });
}

function cleanupConnection() {
  controllerPeerId = null;
  if (currentCall) {
    try { currentCall.close(); } catch (_) {}
    currentCall = null;
  }
  setSimulating(false);
}

// Start media stream from Three.js canvas to controller via PeerJS call
function startMediaStreamToController() {
  if (!peer || !controllerPeerId || !stream) {
    log('Media stream not started (missing peer/controllerPeerId/stream).');
    return;
  }

  if (currentCall) {
    try { currentCall.close(); } catch (_) {}
    currentCall = null;
  }

  log(`Starting media stream to ${controllerPeerId}`);
  currentCall = peer.call(controllerPeerId, stream);

  if (!currentCall) {
    log('Failed to create media call');
    return;
  }

  currentCall.on('close', () => {
    log('Media stream closed');
  });

  currentCall.on('error', (err) => {
    log(`Media call error: ${err}`);
  });
}

// ---------- UI state ----------

function setSimulating(isSimulating) {
  if (isSimulating) {
    waitingEl.classList.add('hidden');
    simulatingEl.classList.remove('hidden');
    statusEl.textContent = 'Connected';
    statusEl.style.background = '#065f46';
    startAnimation();
  } else {
    waitingEl.classList.remove('hidden');
    simulatingEl.classList.add('hidden');
    statusEl.textContent = 'Disconnected';
    statusEl.style.background = '#7f1d1d';
    stopAnimation();
  }
}

// ---------- Three.js "game" ----------

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    getThreeAspect(),
    0.1,
    1000
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  resizeRenderer();
  threeContainer.appendChild(renderer.domElement);

  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshNormalMaterial();
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  camera.position.z = 4;

  // Capture stream from the WebGL canvas
  if (renderer.domElement.captureStream) {
    stream = renderer.domElement.captureStream(30);
    log('Canvas captureStream initialized.');
  } else {
    log('captureStream not supported in this browser.');
  }

  window.addEventListener('resize', () => {
    resizeRenderer();
  });
}

function getThreeAspect() {
  const w = threeContainer.clientWidth || window.innerWidth * 0.66;
  const h = threeContainer.clientHeight || window.innerHeight * 0.66;
  return w / h;
}

function resizeRenderer() {
  const width = threeContainer.clientWidth || window.innerWidth * 0.66;
  const height = threeContainer.clientHeight || window.innerHeight * 0.66;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function startAnimation() {
  if (animationId) return;
  const animate = () => {
    animationId = requestAnimationFrame(animate);
    if (cube) {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.015;
    }
    renderer.render(scene, camera);
  };
  animate();
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

// ---------- Handle button events from controller ----------

function handleButtonEvent(id) {
  if (!cube) return;

  const step = 0.3;
  switch (id) {
    case 1: cube.position.x -= step; break;
    case 2: cube.position.x += step; break;
    case 3: cube.position.y += step; break;
    case 4: cube.position.y -= step; break;
    case 5: cube.position.z += step; break;
    case 6: cube.position.z -= step; break;
    case 7: cube.rotation.x += 0.2; break;
    case 8: cube.rotation.y += 0.2; break;
    case 9: cube.rotation.z += 0.2; break;
    case 10:
    default:
      cube.material.wireframe = !cube.material.wireframe;
      break;
  }
}

// ---------- Logging ----------

function log(message) {
  if (!logEl) return;
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.appendChild(line);
}
