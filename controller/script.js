// Controller logic: connects to simulator via PeerJS, sends button events,
// receives video stream, supports two control layouts with toggle.

const statusEl = document.getElementById('status');
const videoEl = document.getElementById('sim-video');
const hintEl = document.getElementById('hint');

const controlsSection = document.getElementById('controls-section');
const layoutA = document.getElementById('layout-a');
const layoutB = document.getElementById('layout-b');
const toggleLayoutBtn = document.getElementById('toggle-layout');

const params = new URLSearchParams(window.location.search);
const simulatorId = params.get('simId');

let peer;
let dataConn = null;
let currentCall = null;
let isLayoutA = true; // default

// ---------- Init ----------

window.addEventListener('load', () => {
  if (!simulatorId) {
    status('No simulator ID in URL', '#7f1d1d');
    hintEl.textContent = 'Open this page by scanning the QR code from the Simulator.';
    disableAllButtons();
    return;
  }

  hintEl.textContent = `Binding to simulator: ${simulatorId}`;
  initPeer();
  setupButtons();
  setupLayoutToggle();
});

// ---------- PeerJS setup ----------

function initPeer() {
  peer = new Peer({
    // configure peer server if needed
  });

  peer.on('open', (id) => {
    status(`Controller ID: ${id}`, '#4b5563');
    connectToSimulator(id);
  });

  peer.on('call', (call) => {
    // Receive video stream from simulator
    if (currentCall) {
      try { currentCall.close(); } catch (_) {}
    }
    currentCall = call;
    call.answer(); // no local stream
    call.on('stream', (remoteStream) => {
      attachStream(remoteStream);
    });
    call.on('close', () => {
      if (videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(t => t.stop());
      }
      videoEl.srcObject = null;
      status('Media call closed', '#7f1d1d');
    });
    call.on('error', (err) => {
      console.error(err);
      status('Media call error', '#7f1d1d');
    });
  });

  peer.on('error', (err) => {
    console.error(err);
    status(`Peer error: ${err.type || err}`, '#7f1d1d');
  });
}

function connectToSimulator(controllerPeerId) {
  dataConn = peer.connect(simulatorId);

  dataConn.on('open', () => {
    status('Connected to simulator', '#065f46');
    // Tell simulator where to call for video
    dataConn.send({ type: 'registerViewer', peerId: controllerPeerId });
  });

  dataConn.on('close', () => {
    status('Simulator disconnected', '#7f1d1d');
    if (currentCall) {
      try { currentCall.close(); } catch (_) {}
      currentCall = null;
    }
  });

  dataConn.on('error', (err) => {
    console.error(err);
    status('Data connection error', '#7f1d1d');
  });

  dataConn.on('data', (msg) => {
    // Placeholder for future messages from simulator
    console.log('From simulator:', msg);
  });
}

// ---------- Buttons & Layout ----------

function setupButtons() {
  // Delegate clicks from both layouts
  controlsSection.addEventListener('click', (e) => {
    const btn = e.target;
    if (!(btn instanceof HTMLButtonElement)) return;
    const id = parseInt(btn.dataset.id, 10);
    if (!Number.isInteger(id)) return;

    sendButtonPress(id);
    flashButton(btn);
  });
}

function setupLayoutToggle() {
  toggleLayoutBtn.addEventListener('click', () => {
    isLayoutA = !isLayoutA;
    if (isLayoutA) {
      layoutA.classList.remove('hidden');
      layoutB.classList.add('hidden');
    } else {
      layoutA.classList.add('hidden');
      layoutB.classList.remove('hidden');
    }
  });
}

function sendButtonPress(id) {
  if (!dataConn || !dataConn.open) {
    status('Not connected to simulator', '#7f1d1d');
    return;
  }
  dataConn.send({ type: 'button', id });
}

function flashButton(btn) {
  const original = btn.style.transform;
  btn.style.transform = 'scale(0.96)';
  setTimeout(() => {
    btn.style.transform = original || '';
  }, 80);
}

function disableAllButtons() {
  const buttons = controlsSection.querySelectorAll('button[data-id]');
  buttons.forEach((b) => {
    b.disabled = true;
    b.style.opacity = '0.4';
  });
}

// ---------- Video helpers ----------

function attachStream(remoteStream) {
  videoEl.srcObject = remoteStream;
  videoEl.play().catch(() => {});
  status('Receiving video from simulator', '#065f46');
}

// ---------- Status helper ----------

function status(text, color) {
  statusEl.textContent = text;
  if (color) {
    statusEl.style.background = color;
  }
}
