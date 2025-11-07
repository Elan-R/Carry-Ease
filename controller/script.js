// Controller logic: connect to simulator via PeerJS, send button presses,
// receive video stream from simulator.

const statusEl = document.getElementById('status');
const videoEl = document.getElementById('sim-video');
const buttonsGrid = document.getElementById('buttons-grid');
const hintEl = document.getElementById('hint');

const params = new URLSearchParams(window.location.search);
const simulatorId = params.get('simId');

let peer;
let dataConn = null;
let currentCall = null;

// ---------- Init ----------

window.addEventListener('load', () => {
  if (!simulatorId) {
    statusEl.textContent = 'No simulator ID';
    statusEl.style.background = '#7f1d1d';
    hintEl.textContent = 'Open this page by scanning the QR code from the Simulator.';
    disableButtons();
    return;
  }

  hintEl.textContent = `Binding to simulator: ${simulatorId}`;
  initPeer();
  setupButtons();
});

// ---------- PeerJS ----------

function initPeer() {
  peer = new Peer({
    // Configure your own PeerJS server here if needed.
  });

  peer.on('open', (id) => {
    status(`Controller ID: ${id}`, '#4b5563');
    connectToSimulator(id);
  });

  peer.on('call', (call) => {
    // Expect call from simulator carrying its Three.js canvas stream
    if (currentCall) {
      try { currentCall.close(); } catch (_) {}
    }
    currentCall = call;
    call.answer(); // no local stream; just receive
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
    // Tell simulator how to reach us for media
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
    // Reserved for future feedback from simulator if desired
    console.log('From simulator:', msg);
  });
}

// ---------- UI: Buttons ----------

function setupButtons() {
  buttonsGrid.addEventListener('click', (e) => {
    if (!(e.target instanceof HTMLButtonElement)) return;
    const id = parseInt(e.target.dataset.id, 10);
    if (!Number.isInteger(id)) return;
    sendButtonPress(id);
    flashButton(e.target);
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
  btn.style.transform = 'scale(0.96)';
  setTimeout(() => {
    btn.style.transform = '';
  }, 80);
}

function disableButtons() {
  const buttons = buttonsGrid.querySelectorAll('button');
  buttons.forEach(b => {
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
