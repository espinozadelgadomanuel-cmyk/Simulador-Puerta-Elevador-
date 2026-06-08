// ==================== STATE ====================
const state = {
  doorOpen: false,
  doorMoving: false,
  doorState: 'CERRADA', // CERRADA, ABRIENDO, ABIERTA, CERRANDO
  currentFloor: 1,
  targetFloor: 1,
  cycles: 0,
  emergency: false,
  safetyOk: true,
  photoOk: true,
  timerVal: 0,
  timerInterval: null,
  holdTimer: null,
  openDuration: 3000,
  closeDuration: 3000,
  holdDuration: 5000,
  motorSpeed: 80,
  logCount: 0,
};

// ==================== CLOCK ====================
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('clock-display').textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

// ==================== LOGGING ====================
function addLog(msg, type='') {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const container = document.getElementById('log-entries');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${ts}</span><span class="log-msg ${type}">${msg}</span>`;
  container.insertBefore(entry, container.firstChild);
  state.logCount++;
  document.getElementById('log-count').textContent = `${state.logCount} eventos`;
  while (container.children.length > 50) container.removeChild(container.lastChild);
}

// ==================== CIRCUIT HELPERS ====================
function setWire(id, active, blue=false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (active) {
    el.setAttribute('class', blue ? 'flowing-blue' : 'flowing-live');
  } else {
    el.setAttribute('class', 'wire-off');
    el.style.animation = '';
  }
}

function setContact(ids, active) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (active) {
      el.setAttribute('stroke', '#00ff88');
      el.setAttribute('stroke-width', '1.5');
    } else {
      el.setAttribute('stroke', '#2a3555');
      el.setAttribute('stroke-width', '1');
    }
  });
}

function setCoil(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  if (active) {
    el.setAttribute('stroke', '#ff6b35');
    el.setAttribute('fill', 'rgba(255,107,53,0.15)');
    el.setAttribute('stroke-width', '2');
  } else {
    el.setAttribute('stroke', '#2a3555');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-width', '1.5');
  }
}

function setLadderRung(rung, active) {
  const color = active ? '#00ff88' : '#2a3555';
  const els = document.querySelectorAll(`[id^="r${rung}-"]`);
  els.forEach(el => {
    if (el.tagName === 'line') el.setAttribute('stroke', color);
  });
}

function setLadderCoil(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('stroke', active ? '#ff6b35' : '#2a3555');
  if (active) el.setAttribute('fill', 'rgba(255,107,53,.15)');
  else el.setAttribute('fill', 'none');
}

function setNode(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('fill', active ? '#ff6b35' : '#2a3555');
  el.style.filter = active ? 'drop-shadow(0 0 4px #ff6b35)' : '';
}

function setIO(id, on, label) {
  const el = document.getElementById(id);
  if (!el) return;
  const led = el.querySelector('.led');
  if (on) {
    el.className = 'io-state-on';
    led.className = 'led led-on';
  } else {
    el.className = 'io-state-off';
    led.className = 'led led-off';
  }
  el.innerHTML = `<span class="led ${on ? 'led-on' : 'led-off'}"></span>${label}`;
}

function activateLiveBus(active) {
  const bus = document.getElementById('bus-live');
  const flow = document.getElementById('flow-live');
  if (active) {
    bus.setAttribute('class', 'wire-on');
    flow.style.opacity = '1';
  } else {
    bus.setAttribute('class', 'wire-off');
    flow.style.opacity = '0';
  }
  setNode('n1', active);
  setNode('n2', active);
  setNode('n3', active);
}

// ==================== CIRCUIT STATES ====================
function circuitOpenState() {
  activateLiveBus(true);
  setWire('b1-top', true);
  setWire('b1-h', true);
  setWire('b1-h2', true);
  setWire('b1-h3', true);
  setWire('b1-bot', true, true);
  setContact(['pb-open-box', 'seal-box'], true);
  setContact(['ls-open-box'], false);
  setCoil('coil-open', true);
  setWire('b2-top', false);
  setWire('b2-h', false);
  setWire('pb-close-r', false);
  setWire('b2-bot', false);
  setCoil('coil-close', false);
  setWire('b3-top', true);
  setWire('b3-h', true);
  setWire('photo-r', true);
  setWire('b3-bot', true, true);
  setCoil('coil-safe', true);
  setLadderRung(1, true);
  setLadderCoil('lad-coil-open', true);
  setLadderRung(2, false);
  setLadderCoil('lad-coil-close', false);
  setLadderRung(3, true);
  setLadderCoil('lad-coil-safe', true);
  setIO('io-pb-open', true, 'ON');
  setIO('io-pb-close', false, 'OFF');
  setIO('io-ls-open', false, 'OFF');
  setIO('io-ls-close', true, 'ON');
  setIO('io-m-open', true, 'ACTIVO');
  setIO('io-m-close', false, 'OFF');
  setIO('io-safe', true, 'OK');
  setIO('io-photo', true, 'LIBRE');
  setIO('io-alarm', false, 'OFF');
}

function circuitOpenedState() {
  activateLiveBus(true);
  setWire('b1-top', true);
  setWire('b1-h', false);
  setWire('b1-h2', false);
  setWire('b1-h3', false);
  setWire('b1-bot', false);
  setContact(['ls-open-box'], true);
  setContact(['pb-open-box', 'seal-box'], false);
  setCoil('coil-open', false);
  setLadderRung(1, false);
  setLadderCoil('lad-coil-open', false);
  setIO('io-pb-open', false, 'OFF');
  setIO('io-ls-open', true, 'ACTIVO');
  setIO('io-ls-close', false, 'OFF');
  setIO('io-m-open', false, 'OFF');
}

function circuitCloseState() {
  activateLiveBus(true);
  setWire('b1-top', false);
  setWire('b1-h', false);
  setWire('b1-h2', false);
  setWire('b1-h3', false);
  setWire('b1-bot', false);
  setCoil('coil-open', false);
  setContact(['pb-open-box', 'seal-box', 'ls-open-box'], false);
  setWire('b2-top', true);
  setWire('b2-down', true);
  setWire('b2-h', true);
  setWire('ilk-r', true);
  setWire('pb-close-r', true);
  setWire('b2-bot', true, true);
  setContact(['ls-close-box', 'ilk-box', 'pb-close-box'], true);
  setCoil('coil-close', true);
  setLadderRung(1, false);
  setLadderCoil('lad-coil-open', false);
  setLadderRung(2, true);
  setLadderCoil('lad-coil-close', true);
  setIO('io-pb-open', false, 'OFF');
  setIO('io-pb-close', true, 'ON');
  setIO('io-ls-open', true, 'ACTIVO');
  setIO('io-ls-close', false, 'OFF');
  setIO('io-m-open', false, 'OFF');
  setIO('io-m-close', true, 'ACTIVO');
}

function circuitClosedState() {
  activateLiveBus(true);
  setWire('b2-top', false);
  setWire('b2-h', false);
  setWire('pb-close-r', false);
  setWire('b2-bot', false);
  setContact(['ls-close-box'], true);
  setContact(['ilk-box', 'pb-close-box'], false);
  setCoil('coil-close', false);
  setLadderRung(2, false);
  setLadderCoil('lad-coil-close', false);
  setIO('io-pb-close', false, 'OFF');
  setIO('io-ls-close', true, 'ACTIVO');
  setIO('io-m-close', false, 'OFF');
}

function circuitIdleState() {
  activateLiveBus(true);
  ['b1-top','b1-h','b1-h2','b1-h3','b1-bot','b2-top','b2-down','b2-h','ilk-r','pb-close-r','b2-bot'].forEach(id => setWire(id, false));
  ['coil-open','coil-close'].forEach(id => setCoil(id, false));
  ['pb-open-box','seal-box','ls-open-box','ls-close-box','ilk-box','pb-close-box'].forEach(id => setContact([id], false));
  setLadderRung(1, false); setLadderCoil('lad-coil-open', false);
  setLadderRung(2, false); setLadderCoil('lad-coil-close', false);
  setIO('io-pb-open', false, 'OFF');
  setIO('io-pb-close', false, 'OFF');
  setIO('io-ls-open', false, 'OFF');
  setIO('io-ls-close', true, 'ON');
  setIO('io-m-open', false, 'OFF');
  setIO('io-m-close', false, 'OFF');
  setWire('b3-top', true);
  setWire('b3-down', true);
  setWire('b3-h', true);
  setWire('photo-r', true);
  setWire('b3-bot', true, true);
  setCoil('coil-safe', true);
  setLadderRung(3, true);
  setLadderCoil('lad-coil-safe', true);
  setIO('io-safe', true, 'OK');
  setIO('io-photo', true, 'LIBRE');
  setIO('io-alarm', false, 'OFF');
}

// ==================== TIMER ====================
let timerStart = 0;
let timerTarget = 0;
function startTimer(duration, cb) {
  clearTimer();
  timerStart = Date.now();
  timerTarget = duration;
  state.timerInterval = setInterval(() => {
    const elapsed = Date.now() - timerStart;
    const remaining = Math.max(0, (timerTarget - elapsed) / 1000);
    document.getElementById('m-timer').textContent = remaining.toFixed(1) + 's';
    if (elapsed >= timerTarget) {
      clearTimer();
      if (cb) cb();
    }
  }, 50);
}

function clearTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  document.getElementById('m-timer').textContent = '0.0s';
}

// ==================== DOOR CONTROL ====================
function setDoorStatus(txt, color='') {
  state.doorState = txt;
  const el = document.getElementById('m-door-state');
  el.textContent = txt;
  el.className = 'metric-value ' + color;
  document.getElementById('door-status-txt').textContent = `PUERTA ${txt}`;
  const dot = document.getElementById('door-dot');
  if (txt === 'ABIERTA') { dot.className = 'dot'; }
  else if (txt === 'CERRADA') { dot.className = 'dot yellow'; }
  else { dot.className = 'dot'; dot.style.background = '#ffcc00'; }
}

function setDoorDisplay(txt) {
  document.getElementById('door-display').textContent = txt;
}

function openDoor() {
  if (state.doorMoving || state.doorOpen || state.emergency) return;
  state.doorMoving = true;
  state.cycles++;
  document.getElementById('m-cycles').textContent = String(state.cycles).padStart(3, '0');

  addLog('Iniciando apertura de puerta', 'ok');
  setDoorStatus('ABRIENDO', 'yellow');
  setDoorDisplay('◁◁');

  circuitOpenState();

  document.getElementById('door-right').classList.add('open');
  document.getElementById('beam').classList.add('active');
  document.getElementById('btn-open-door').classList.add('active');

  startTimer(state.openDuration, () => {
    state.doorOpen = true;
    state.doorMoving = false;
    setDoorStatus('ABIERTA', 'green');
    setDoorDisplay('◁  ▷');
    document.getElementById('btn-open-door').classList.remove('active');
    circuitOpenedState();
    addLog('Puerta completamente abierta — LS-Abierto activado', 'ok');

    state.holdTimer = setTimeout(() => {
      closeDoor();
    }, state.holdDuration);
  });
}

function closeDoor() {
  if (state.doorMoving || !state.doorOpen || state.emergency) return;
  if (state.holdTimer) { clearTimeout(state.holdTimer); state.holdTimer = null; }

  state.doorMoving = true;
  addLog('Iniciando cierre de puerta', 'warn');
  setDoorStatus('CERRANDO', 'yellow');
  setDoorDisplay('▷▷');

  circuitCloseState();
  document.getElementById('btn-close-door').classList.add('active');

  setTimeout(() => {
    document.getElementById('beam').classList.remove('active');
  }, 500);

  document.getElementById('door-right').classList.remove('open');

  startTimer(state.closeDuration, () => {
    state.doorOpen = false;
    state.doorMoving = false;
    setDoorStatus('CERRADA', '');
    setDoorDisplay('▶◀');
    document.getElementById('btn-close-door').classList.remove('active');
    circuitClosedState();
    addLog('Puerta completamente cerrada — LS-Cerrado activado', 'ok');

    setTimeout(() => {
      circuitIdleState();
    }, 500);
  });
}

function emergencyStop() {
  if (state.holdTimer) { clearTimeout(state.holdTimer); state.holdTimer = null; }
  clearTimer();

  state.emergency = !state.emergency;

  if (state.emergency) {
    state.doorMoving = false;
    addLog('⚠ PARO DE EMERGENCIA ACTIVADO', 'err');
    setDoorStatus('EMERGENCIA', 'red');
    setDoorDisplay('⚠');
    document.getElementById('sys-status').textContent = 'EMERGENCIA';
    document.getElementById('sys-dot').className = 'dot red';
    setIO('io-alarm', true, 'ALARM');

    const doorRight = document.getElementById('door-right');
    const computed = window.getComputedStyle(doorRight);
    doorRight.style.transition = 'none';
    doorRight.style.transform = computed.transform;

    activateLiveBus(false);
    setLadderRung(1, false); setLadderCoil('lad-coil-open', false);
    setLadderRung(2, false); setLadderCoil('lad-coil-close', false);
    setLadderRung(3, false); setLadderCoil('lad-coil-safe', false);
  } else {
    state.emergency = false;
    addLog('Sistema restablecido — paro de emergencia desactivado', 'ok');
    document.getElementById('sys-status').textContent = 'SISTEMA OK';
    document.getElementById('sys-dot').className = 'dot';
    setIO('io-alarm', false, 'OFF');
    const doorRight = document.getElementById('door-right');
    doorRight.style.transition = `transform ${state.closeDuration/1000}s cubic-bezier(0.4,0,0.2,1)`;
    doorRight.classList.remove('open');
    state.doorOpen = false;
    setDoorStatus('CERRADA', '');
    setDoorDisplay('▶◀');
    circuitIdleState();
  }
}

// ==================== FLOOR CONTROL ====================
function goFloor(floor) {
  if (state.doorOpen) closeDoor();
  state.currentFloor = floor;
  document.getElementById('floor-num').textContent = String(floor).padStart(2, '0');
  document.getElementById('m-floor').textContent = String(floor).padStart(2, '0');
  document.getElementById('fl-label').textContent = `PISO ${floor} ↑`;

  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById(`fbtn-${i}`);
    if (btn) btn.className = 'floor-btn' + (i === floor ? ' active' : '');
  }

  addLog(`Moviendo a piso ${floor}`, '');

  setTimeout(() => {
    addLog(`Llegó a piso ${floor}`, 'ok');
    openDoor();
  }, 1200);
}

// ==================== PARAMS ====================
function applyParams() {
  state.openDuration = parseFloat(document.getElementById('p-open').value) * 1000;
  state.closeDuration = parseFloat(document.getElementById('p-close').value) * 1000;
  state.holdDuration = parseFloat(document.getElementById('p-hold').value) * 1000;
  state.motorSpeed = parseInt(document.getElementById('p-speed').value);
  addLog(`Parámetros actualizados: Apertura=${state.openDuration/1000}s, Cierre=${state.closeDuration/1000}s, Espera=${state.holdDuration/1000}s`, 'ok');
  document.getElementById('door-right').style.transition = `transform ${state.closeDuration/1000}s cubic-bezier(0.4,0,0.2,1)`;
}

// ==================== INIT ====================
circuitIdleState();
addLog('Sistema iniciado — PLC listo', 'ok');
addLog('Puerta en posición cerrada', 'ok');
addLog('Todos los sensores OK', 'ok');
