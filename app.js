// ========================================
// CONFIGURACIÓN
// ========================================

const AVATARS = [
    '😀', '😎', '🤖', '👾', '🎮', '🎨',
    '🌈', '⭐', '🌟', '💎', '🔮', '🎭',
    '🎪', '🚀', '🛸', '🤿', '🏄', '🧙',
    '🧝', '🦸', '🦹', '🧞', '🧚', '🧙‍♀️'
];

const STORAGE_KEYS = {
    PLAYER_NAME: 'colorGame_playerName',
    PLAYER_AVATAR: 'colorGame_playerAvatar'
};

const gameState = {
    player: { id: null, name: '', avatar: AVATARS[0], isHost: false, confirmed: false },
    peer: null,
    connections: new Map(),
    room: { code: null, hostId: null, players: new Map() },
    currentScreen: 'home',
    inviteHostId: null,
    debugInfo: []
};

const elements = {};

// ========================================
// INICIO
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    setupEventListeners();
    loadSavedPlayerData();
    renderAvatars('avatar-grid');
    renderAvatars('guest-avatar-grid');
    updateCreateButton();
    updateGuestConfirmButton();
    
    // 1. Si hay hostId en URL → es invitado, conectar YA
    extractInviteHostId();
    
    if (gameState.inviteHostId) {
        addDebug(`🔗 Invitación detectada. Conectando a host...`);
        await joinAsGuest();
    } else {
        addDebug('📄 Home - esperando acción del host');
    }
});

function cacheElements() {
    // Home
    elements.homeScreen = document.getElementById('home-screen');
    elements.avatarGrid = document.getElementById('avatar-grid');
    elements.playerNameInput = document.getElementById('player-name');
    elements.createRoomBtn = document.getElementById('create-room-btn');
    
    // Waiting Host
    elements.waitingHostScreen = document.getElementById('waiting-host-screen');
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.roomCodeDisplay = document.getElementById('room-code');
    elements.inviteLinkInput = document.getElementById('invite-link');
    elements.copyLinkBtn = document.getElementById('copy-link-btn');
    elements.adPlaceholder = document.getElementById('ad-placeholder');
    elements.playersList = document.getElementById('players-list');
    elements.startGameBtn = document.getElementById('start-game-btn');
    elements.minPlayersMsg = document.querySelector('.min-players-msg');
    
    // Guest Join
    elements.guestJoinScreen = document.getElementById('guest-join-screen');
    elements.guestAvatarGrid = document.getElementById('guest-avatar-grid');
    elements.guestPlayerNameInput = document.getElementById('guest-player-name');
    elements.guestRoomInfo = document.getElementById('guest-room-info');
    elements.guestConfirmBtn = document.getElementById('guest-confirm-btn');
    
    // Guest Waiting
    elements.guestWaitingScreen = document.getElementById('guest-waiting-screen');
    elements.guestHostName = document.getElementById('guest-host-name');
    elements.guestConfirmedAvatar = document.getElementById('guest-confirmed-avatar');
    
    // Debug
    elements.debugPanel = document.getElementById('debug-panel');
    elements.debugLog = document.getElementById('debug-log');
    elements.debugToggle = document.getElementById('debug-toggle');
}

function setupEventListeners() {
    // Home
    elements.playerNameInput.addEventListener('input', updateCreateButton);
    elements.createRoomBtn.addEventListener('click', handleCreateRoom);
    
    // Waiting Host
    elements.copyLinkBtn.addEventListener('click', copyInviteLink);
    elements.startGameBtn.addEventListener('click', handleStartGame);
    elements.settingsBtn.addEventListener('click', handleSettings);
    
    // Guest Join
    elements.guestPlayerNameInput.addEventListener('input', updateGuestConfirmButton);
    elements.guestConfirmBtn.addEventListener('click', handleGuestConfirm);
    
    // Debug
    if (elements.debugToggle) {
        elements.debugToggle.addEventListener('click', toggleDebug);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
            e.preventDefault();
            toggleDebug();
        }
    });
}

// Solo leer hostId de la URL (lo único que sirve para conectar)
function extractInviteHostId() {
    const urlParams = new URLSearchParams(window.location.search);
    const hostId = urlParams.get('host');
    if (hostId) {
        gameState.inviteHostId = hostId;
        // history.replaceState({}, '', window.location.pathname);
    }
}

// ========================================
// DEBUG
// ========================================

function addDebug(msg) {
    const ts = new Date().toLocaleTimeString();
    gameState.debugInfo.push(`[${ts}] ${msg}`);
    if (elements.debugLog) {
        elements.debugLog.textContent = gameState.debugInfo.join('\n');
        elements.debugLog.scrollTop = elements.debugLog.scrollHeight;
    }
    console.log(`[DEBUG] ${msg}`);
}

function toggleDebug() {
    elements.debugPanel.classList.toggle('hidden');
}

// ========================================
// PANTALLAS
// ========================================

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('active');
        gameState.currentScreen = id;
        addDebug(`🖥️ Pantalla: ${id}`);
    }
}

// ========================================
// AVATARES Y DATOS LOCALES
// ========================================

function renderAvatars(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';
    AVATARS.forEach((avatar, i) => {
        const btn = document.createElement('button');
        btn.className = 'avatar-option';
        btn.textContent = avatar;
        btn.dataset.index = i;
        btn.addEventListener('click', () => selectAvatar(i, gridId));
        if (i === 0) btn.classList.add('selected');
        grid.appendChild(btn);
    });
}

function selectAvatar(index, gridId) {
    const isGuest = gridId === 'guest-avatar-grid';
    gameState.player.avatar = AVATARS[index];
    
    const selector = isGuest ? '#guest-avatar-grid' : '#avatar-grid';
    document.querySelectorAll(`${selector} .avatar-option`).forEach((b, i) => {
        b.classList.toggle('selected', i === index);
    });
    
    if (!isGuest) savePlayerData();
    updateGuestConfirmButton();
}

function loadSavedPlayerData() {
    const n = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    const a = localStorage.getItem(STORAGE_KEYS.PLAYER_AVATAR);
    if (n) { gameState.player.name = n; elements.playerNameInput.value = n; }
    if (a && AVATARS.includes(a)) {
        gameState.player.avatar = a;
        const i = AVATARS.indexOf(a);
        document.querySelectorAll('#avatar-grid .avatar-option').forEach((b, idx) => {
            b.classList.toggle('selected', idx === i);
        });
    }
}

function savePlayerData() {
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, gameState.player.name);
    localStorage.setItem(STORAGE_KEYS.PLAYER_AVATAR, gameState.player.avatar);
}

function updateCreateButton() {
    const name = elements.playerNameInput.value.trim();
    gameState.player.name = name;
    elements.createRoomBtn.disabled = !name;
    if (name) savePlayerData();
}

function updateGuestConfirmButton() {
    const name = elements.guestPlayerNameInput?.value?.trim() || '';
    elements.guestConfirmBtn.disabled = !name;
}

// ========================================
// HOST: CREAR SALA
// ========================================

async function handleCreateRoom() {
    const name = elements.playerNameInput.value.trim();
    if (!name) return alert('Ingresa tu nombre');
    
    gameState.player.name = name;
    gameState.player.isHost = true;
    gameState.player.confirmed = true;
    savePlayerData();
    
    elements.createRoomBtn.disabled = true;
    elements.createRoomBtn.innerHTML = '<span class="btn-icon">⏳</span> Creando...';
    addDebug('🎯 HOST: Creando sala...');
    
    try {
        gameState.room.code = generateRoomCode();
        await initPeerJS();
        
        gameState.room.hostId = gameState.player.id;
        gameState.room.players.set(gameState.player.id, {
            id: gameState.player.id,
            name: gameState.player.name,
            avatar: gameState.player.avatar,
            isHost: true,
            confirmed: true
        });
        
        showScreen('waiting-host-screen');
        elements.roomCodeDisplay.textContent = gameState.room.code;
        
        const base = window.location.origin + window.location.pathname;
        const fullLink = `${base}?host=${encodeURIComponent(gameState.player.id)}`;
        elements.inviteLinkInput.value = fullLink;
        elements.inviteLinkInput.placeholder = '';
        
        updatePlayersList();
        updateStartButton();
        addDebug(`🎉 Sala creada. Código: ${gameState.room.code}. Enlace: ${fullLink}`);
        
    } catch (err) {
        addDebug(`💥 Error: ${err.message}`);
        alert('Error: ' + err.message);
        elements.createRoomBtn.disabled = false;
        elements.createRoomBtn.innerHTML = '<span class="btn-icon">➕</span> Crear Sala';
    }
}

// ========================================
// INVITADO: CONEXIÓN AUTOMÁTICA AL ENTRAR
// ========================================

async function joinAsGuest() {
    gameState.player.isHost = false;
    gameState.player.confirmed = false;
    
    try {
        await initPeerJS();
        await connectToHost(gameState.inviteHostId);
        
        // Conectado: mostrar pantalla para elegir nombre/avatar
        showScreen('guest-join-screen');
        elements.guestRoomInfo.textContent = 'Conectado. Configura tu perfil.';
        addDebug('✅ Invitado conectado. Esperando confirmación de perfil.');
        
        // Cargar datos guardados si los hay
        const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
        const savedAvatar = localStorage.getItem(STORAGE_KEYS.PLAYER_AVATAR);
        if (savedName) {
            gameState.player.name = savedName;
            elements.guestPlayerNameInput.value = savedName;
        }
        if (savedAvatar && AVATARS.includes(savedAvatar)) {
            gameState.player.avatar = savedAvatar;
            const i = AVATARS.indexOf(savedAvatar);
            document.querySelectorAll('#guest-avatar-grid .avatar-option').forEach((b, idx) => {
                b.classList.toggle('selected', idx === i);
            });
        }
        updateGuestConfirmButton();
        
    } catch (err) {
        addDebug(`💥 Error conectando: ${err.message}`);
        elements.guestRoomInfo.textContent = 'Error: ' + err.message;
        elements.guestRoomInfo.style.color = 'var(--error-color)';
        elements.guestConfirmBtn.disabled = true;
        elements.guestConfirmBtn.textContent = 'No se pudo conectar';
    }
}

// ========================================
// INVITADO: CONFIRMAR PERFIL Y ENVIAR AL HOST
// ========================================

function handleGuestConfirm() {
    const name = elements.guestPlayerNameInput.value.trim();
    if (!name) return alert('Ingresa tu nombre');
    
    gameState.player.name = name;
    gameState.player.confirmed = true;
    savePlayerData();
    
    elements.guestConfirmBtn.disabled = true;
    elements.guestConfirmBtn.innerHTML = '<span class="btn-icon">⏳</span> Uniéndose...';
    addDebug(`🎯 Invitado confirma: ${name} (${gameState.player.avatar})`);
    
    // Enviar info al host
    sendPlayerInfo(gameState.room.hostId);
    
    // Cambiar a pantalla de espera
    showScreen('guest-waiting-screen');
    
    // Mostrar avatar confirmado
    elements.guestConfirmedAvatar.innerHTML = `
        <div class="player-avatar-large" style="background: var(--surface);">
            ${gameState.player.avatar}
        </div>
        <p class="confirmed-name">${gameState.player.name}</p>
        <p class="confirmed-label">Tu perfil está listo</p>
    `;
    
    addDebug('⏳ Invitado en espera de inicio...');
}

// ========================================
// PEERJS
// ========================================

function initPeerJS() {
    return new Promise((resolve, reject) => {
        addDebug('🔌 Iniciando PeerJS...');
        
        gameState.peer = new Peer({
            host: '0.peerjs.com',
            port: 443,
            secure: true,
            path: '/',
            debug: 3,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    { urls: 'stun:stun.cloudflare.com:3478' }
                ],
                iceCandidatePoolSize: 10
            }
        });
        
        gameState.peer.on('open', id => {
            addDebug(`✅ PeerJS OK. Mi ID: ${id}`);
            gameState.player.id = id;
            resolve(id);
        });
        
        gameState.peer.on('error', err => {
            addDebug(`❌ PeerJS: ${err.type} - ${err.message}`);
            if (err.type === 'unavailable-id') {
                initPeerJS().then(resolve).catch(reject);
            } else if (err.type === 'peer-unavailable') {
                reject(new Error('Host no disponible (¿cerró la pestaña?)'));
            } else if (err.type === 'network') {
                reject(new Error('Error de red - ¿HTTPS? ¿Firewall/VPN?'));
            } else {
                reject(err);
            }
        });
        
        gameState.peer.on('connection', conn => handleIncomingConnection(conn));
        gameState.peer.on('disconnected', () => {
            addDebug('🔌 Reconectando...');
            gameState.peer.reconnect();
        });
    });
}

function handleIncomingConnection(conn) {
    addDebug(`📥 Conexión entrante: ${conn.peer}`);
    conn.on('open', () => {
        sendRoomInfo(conn);
        gameState.connections.set(conn.peer, { conn, playerInfo: null });
        conn.on('data', data => handlePeerMessage(conn.peer, data));
        conn.on('close', () => handlePeerDisconnect(conn.peer));
    });
}

function connectToHost(hostId) {
    return new Promise((resolve, reject) => {
        addDebug(`🔗 Conectando a ${hostId.substring(0,12)}...`);
        const conn = gameState.peer.connect(hostId, { reliable: true });
        const t = setTimeout(() => {
            if (!conn.open) reject(new Error('Timeout 15s - ¿Host en sala?'));
        }, 15000);
        
        conn.on('open', () => {
            clearTimeout(t);
            addDebug('✅ Conectado al host');
            gameState.connections.set(hostId, { conn, playerInfo: null });
            gameState.room.hostId = hostId;
            conn.on('data', data => handlePeerMessage(hostId, data));
            conn.on('close', () => handlePeerDisconnect(hostId));
            resolve(conn);
        });
        conn.on('error', err => {
            clearTimeout(t);
            addDebug(`❌ Error: ${err.type} - ${err.message}`);
            reject(err);
        });
    });
}

// ========================================
// MENSAJES P2P
// ========================================

function handlePeerMessage(from, data) {
    addDebug(`📨 ${from.substring(0,8)}: ${data.type}`);
    switch (data.type) {
        case 'room-info': handleRoomInfo(data); break;
        case 'player-joined': handlePlayerJoined(data); break;
        case 'player-left': handlePlayerLeft(data); break;
        case 'player-info': handlePlayerInfo(from, data); break;
        case 'start-game': handleStartGameSignal(data); break;
        case 'settings': handleSettingsSignal(data); break;
    }
}

// Host recibe info de sala (solo host la envía)
function handleRoomInfo(data) {
    gameState.room.code = data.roomCode;
    gameState.room.hostId = data.hostId;
    gameState.room.players.clear();
    gameState.room.players.set(data.hostId, data.hostInfo);
    data.players.forEach(p => gameState.room.players.set(p.id, p));
    
    addDebug(`🏠 Sala ${data.roomCode} - ${gameState.room.players.size} jugadores`);
    
    if (gameState.player.isHost) {
        updatePlayersList();
    } else {
        // Invitado: actualizar info de sala en pantalla de join
        if (elements.guestRoomInfo) {
            elements.guestRoomInfo.textContent = `Sala de ${data.hostInfo.name} (${data.roomCode})`;
            elements.guestRoomInfo.style.color = 'var(--text-secondary)';
        }
        if (elements.guestHostName) {
            elements.guestHostName.textContent = `Sala de ${data.hostInfo.name} (${data.roomCode})`;
        }
    }
}

// Host recibe nuevo jugador confirmado
function handlePlayerJoined(data) {
    gameState.room.players.set(data.player.id, data.player);
    addDebug(`👋 ${data.player.name} confirmado (${gameState.room.players.size})`);
    if (gameState.player.isHost) updatePlayersList();
}

function handlePlayerLeft(data) {
    gameState.room.players.delete(data.playerId);
    gameState.connections.delete(data.playerId);
    addDebug(`👋 Salió (${gameState.room.players.size} quedan)`);
    if (gameState.player.isHost) updatePlayersList();
}

// Host recibe info de perfil de invitado
function handlePlayerInfo(from, data) {
    const c = gameState.connections.get(from);
    if (c) {
        c.playerInfo = data;
        // Solo añadir a lista si ya confirmó
        if (data.confirmed) {
            gameState.room.players.set(from, data);
            if (gameState.player.isHost) updatePlayersList();
        }
    }
}

function handleStartGameSignal() {
    addDebug('🎮 Inicio recibido');
    // TODO: ir a pantalla de juego
    alert('¡Partida iniciada! Próximamente: pantalla de juego');
}

function handleSettingsSignal(data) {
    addDebug('⚙️ Config recibida');
}

// ========================================
// ENVÍO
// ========================================

function broadcast(type, data) {
    const msg = { type, ...data };
    let n = 0;
    gameState.connections.forEach(({ conn }) => { if (conn.open) { conn.send(msg); n++; } });
    addDebug(`📤 ${type} → ${n}`);
}

function sendToPeer(id, type, data) {
    const c = gameState.connections.get(id);
    if (c && c.conn.open) c.conn.send({ type, ...data });
}

function sendRoomInfo(conn) {
    const players = [];
    gameState.room.players.forEach((p, id) => { if (id !== gameState.player.id) players.push(p); });
    conn.send({
        type: 'room-info',
        roomCode: gameState.room.code,
        hostId: gameState.player.id,
        hostInfo: { id: gameState.player.id, name: gameState.player.name, avatar: gameState.player.avatar, isHost: true, confirmed: true },
        players
    });
}

function sendPlayerInfo(targetId = null) {
    const info = {
        id: gameState.player.id,
        name: gameState.player.name,
        avatar: gameState.player.avatar,
        isHost: false,
        confirmed: gameState.player.confirmed
    };
    if (targetId) sendToPeer(targetId, 'player-info', info);
    else broadcast('player-info', info);
}

// ========================================
// HOST: SALA DE ESPERA
// ========================================

function updatePlayersList() {
    elements.playersList.innerHTML = '';
    gameState.room.players.forEach((p, id) => {
        const el = document.createElement('div');
        el.className = 'player-avatar' + (p.isHost ? ' host' : '');
        // Si no ha confirmado, mostrar estado
        if (!p.confirmed && !p.isHost) {
            el.classList.add('pending');
            el.textContent = '⏳';
            el.title = `${p.name || 'Jugador'} - Configurando perfil...`;
        } else {
            el.textContent = p.avatar;
            el.title = p.name + (p.isHost ? ' (Host)' : '');
        }
        const n = document.createElement('span');
        n.className = 'player-avatar-name';
        n.textContent = p.name || 'Esperando...';
        el.appendChild(n);
        elements.playersList.appendChild(el);
    });
    updateStartButton();
}

function updateStartButton() {
    // Contar solo confirmados
    let confirmed = 0;
    gameState.room.players.forEach(p => { if (p.confirmed) confirmed++; });
    
    elements.startGameBtn.disabled = confirmed < 2;
    elements.minPlayersMsg.style.display = confirmed < 2 ? 'block' : 'none';
    elements.minPlayersMsg.textContent = confirmed < 2 
        ? `Mínimo 2 jugadores listos (${confirmed}/2)` : '';
}

function copyInviteLink() {
    const link = elements.inviteLinkInput.value;
    if (!link || link.includes('Creando')) return;
    navigator.clipboard.writeText(link).then(() => {
        const o = elements.copyLinkBtn.textContent;
        elements.copyLinkBtn.textContent = '✅';
        setTimeout(() => elements.copyLinkBtn.textContent = o, 1500);
        addDebug('📋 Enlace copiado');
    }).catch(() => prompt('Copia:', link));
}

function handleSettings() { openConfigScreen(); }

function handlePeerDisconnect(id) {
    addDebug(`🔌 Desconectado: ${id.substring(0,8)}`);
    gameState.connections.delete(id);
    gameState.room.players.delete(id);
    if (gameState.player.isHost) updatePlayersList();
}

// ========================================
// UTILIDADES
// ========================================

function generateRoomCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r = '';
    for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
    return r; // Solo visual
}

window.gameState = gameState;
window.debug = {
    state: () => gameState,
    conns: () => gameState.connections,
    players: () => Array.from(gameState.room.players.values()),
    log: () => gameState.debugInfo
};

// ========================================
// CONFIGURACIÓN DE PARTIDA
// ========================================

const CONFIG_DEFAULTS = {
    rounds: { mode: 'few', custom: 5 },
    duration: { mode: 'short', custom: 10 },
    timeBonus: 'yes',
    acceleration: 'yes',
    gyro: 'no'
};

// Estado de config en gameState.room.config
gameState.room.config = { ...CONFIG_DEFAULTS };

// Elementos de config
const configElements = {};

function initConfigScreen() {
    cacheConfigElements();
    setupConfigListeners();
    loadConfigToUI();
    checkGyroscopeSupport();
}

function cacheConfigElements() {
    configElements.backBtn = document.getElementById('config-back-btn');
    configElements.saveBtn = document.getElementById('config-save-btn');
    configElements.saveStatus = document.getElementById('config-save-status');
    configElements.form = document.getElementById('config-form');
    
    configElements.roundsMode = document.querySelectorAll('input[name="rounds-mode"]');
    configElements.durationMode = document.querySelectorAll('input[name="duration-mode"]');
    configElements.timeBonusMode = document.querySelectorAll('input[name="timebonus-mode"]');
    configElements.accelMode = document.querySelectorAll('input[name="accel-mode"]');
    configElements.gyroMode = document.querySelectorAll('input[name="gyro-mode"]');
    
    configElements.roundsCustom = document.getElementById('rounds-custom');
    configElements.roundsCustomValue = document.getElementById('rounds-custom-value');
    configElements.durationCustom = document.getElementById('duration-custom');
    configElements.durationCustomValue = document.getElementById('duration-custom-value');
    
    configElements.gyroWarning = document.getElementById('gyro-warning');
    configElements.gyroYesOpt = document.getElementById('gyro-yes-option');
    configElements.gyroSometimesOpt = document.getElementById('gyro-sometimes-option');
}

function setupConfigListeners() {
    configElements.backBtn.addEventListener('click', () => {
        showScreen('waiting-host-screen');
    });
    
    configElements.saveBtn.addEventListener('click', saveConfig);
    
    configElements.roundsMode.forEach(r => r.addEventListener('change', () => toggleCustomInput('rounds')));
    configElements.durationMode.forEach(r => r.addEventListener('change', () => toggleCustomInput('duration')));
    
    configElements.gyroMode.forEach(r => r.addEventListener('change', updateGyroWarning));
}

function toggleCustomInput(type) {
    const mode = type === 'rounds' 
        ? document.querySelector('input[name="rounds-mode"]:checked').value
        : document.querySelector('input[name="duration-mode"]:checked').value;
    
    const customDiv = type === 'rounds' ? configElements.roundsCustom : configElements.durationCustom;
    customDiv.classList.toggle('hidden', mode !== 'custom');
}

function checkGyroscopeSupport() {
    const hasOrientationSupport = 'DeviceOrientationEvent' in window;
    gameState.room.config._gyroSupported = hasOrientationSupport;
    
    if (!hasOrientationSupport) {
        disableGyroOptions();
        configElements.gyroWarning.classList.remove('hidden');
        configElements.gyroWarning.textContent = '⚠️ Tu navegador no soporta giroscopio. Opción deshabilitada.';
    } else {
        configElements.gyroWarning.classList.add('hidden');
    }
}

function disableGyroOptions() {
    configElements.gyroMode.forEach(r => {
        r.disabled = r.value !== 'no';
        if (r.value !== 'no') {
            r.parentElement.style.opacity = '0.5';
            r.parentElement.style.cursor = 'not-allowed';
        }
    });
    document.querySelector('input[name="gyro-mode"][value="no"]').checked = true;
}

function updateGyroWarning() {
    const selected = document.querySelector('input[name="gyro-mode"]:checked').value;
    const supported = gameState.room.config._gyroSupported;
    
    if (!supported && selected !== 'no') {
        configElements.gyroWarning.classList.remove('hidden');
        configElements.gyroWarning.textContent = '⚠️ Giroscopio no disponible. Forzando "No".';
        document.querySelector('input[name="gyro-mode"][value="no"]').checked = true;
    } else {
        configElements.gyroWarning.classList.add('hidden');
    }
}

function loadConfigToUI() {
    const c = gameState.room.config;
    
    document.querySelector(`input[name="rounds-mode"][value="${c.rounds.mode}"]`).checked = true;
    configElements.roundsCustomValue.value = c.rounds.custom;
    toggleCustomInput('rounds');
    
    document.querySelector(`input[name="duration-mode"][value="${c.duration.mode}"]`).checked = true;
    configElements.durationCustomValue.value = c.duration.custom;
    toggleCustomInput('duration');
    
    document.querySelector(`input[name="timebonus-mode"][value="${c.timeBonus}"]`).checked = true;
    document.querySelector(`input[name="accel-mode"][value="${c.acceleration}"]`).checked = true;
    document.querySelector(`input[name="gyro-mode"][value="${c.gyro}"]`).checked = true;
    updateGyroWarning();
}

function saveConfig() {
    const c = gameState.room.config;
    
    const roundsMode = document.querySelector('input[name="rounds-mode"]:checked').value;
    const durationMode = document.querySelector('input[name="duration-mode"]:checked').value;
    
    if (roundsMode === 'custom') {
        const val = parseInt(configElements.roundsCustomValue.value);
        if (isNaN(val) || val < 1 || val > 50) return alert('Rondas: 1-50');
        c.rounds.custom = val;
    }
    c.rounds.mode = roundsMode;
    
    if (durationMode === 'custom') {
        const val = parseInt(configElements.durationCustomValue.value);
        if (isNaN(val) || val < 3 || val > 120) return alert('Duración: 3-120 seg');
        c.duration.custom = val;
    }
    c.duration.mode = durationMode;
    
    c.timeBonus = document.querySelector('input[name="timebonus-mode"]:checked').value;
    c.acceleration = document.querySelector('input[name="accel-mode"]:checked').value;
    c.gyro = document.querySelector('input[name="gyro-mode"]:checked').value;
    
    if (!c._gyroSupported && c.gyro !== 'no') {
        c.gyro = 'no';
        loadConfigToUI();
        return alert('Giroscopio no soportado. Forzado a "No".');
    }
    
    configElements.saveStatus.textContent = '✅ Guardado';
    setTimeout(() => configElements.saveStatus.textContent = '', 2000);
    
    addDebug(`⚙️ Config guardada: ${JSON.stringify(c)}`);
    showScreen('waiting-host-screen');
}

function openConfigScreen() {
    if (!gameState.player.isHost) return;
    initConfigScreen();
    showScreen('config-screen');
}

// ========================================
// FUNCIONES DE CÁLCULO SEGÚN CONFIG
// ========================================

function calculateTotalRounds() {
    const { mode, custom } = gameState.room.config.rounds;
    switch (mode) {
        case 'few': return Math.floor(Math.random() * 3) + 3;
        case 'many': return Math.floor(Math.random() * 3) + 7;
        case 'custom': return custom;
        default: return 5;
    }
}

function calculateBaseRoundDuration() {
    const { mode, custom } = gameState.room.config.duration;
    switch (mode) {
        case 'short': return Math.floor(Math.random() * 5) + 6;
        case 'long': return Math.floor(Math.random() * 6) + 13;
        case 'custom': return custom;
        default: return 10;
    }
}

function isTimeBonusActive(roundNumber) {
    const mode = gameState.room.config.timeBonus;
    if (mode === 'yes') return true;
    if (mode === 'no') return false;
    return Math.random() < 0.5;
}

function calculateRoundDuration(roundNumber, baseDuration) {
    const mode = gameState.room.config.acceleration;
    
    if (mode === 'no') return baseDuration;
    
    if (mode === 'yes') {
        if (roundNumber <= 2) return baseDuration;
        let duration = baseDuration;
        for (let r = 3; r <= roundNumber; r++) {
            duration *= 0.86;
        }
        return Math.max(3, Math.round(duration * 10) / 10);
    }
    
    if (mode === 'sometimes') {
        let duration = baseDuration;
        for (let r = 1; r <= roundNumber; r++) {
            const seeded = Math.sin(roundNumber * 1000 + r * 100) * 10000;
            const rand = seeded - Math.floor(seeded);
            if (rand < 0.33) {
                duration *= 0.67;
            }
        }
        return Math.max(3, Math.round(duration * 10) / 10);
    }
    
    return baseDuration;
}

function calculateTimeBonus(baseScore, timeRemaining, totalTime) {
    if (totalTime <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, timeRemaining / totalTime));
    const bonusPercent = ratio * 0.2;
    return Math.round(baseScore * bonusPercent);
}

function isGyroModeActive(roundNumber) {
    const mode = gameState.room.config.gyro;
    if (mode === 'yes') return true;
    if (mode === 'no') return false;
    const seeded = Math.sin(roundNumber * 2000 + 42) * 10000;
    const rand = seeded - Math.floor(seeded);
    return rand < 0.25;
}

function precalculateRoundDurations() {
    const totalRounds = calculateTotalRounds();
    const baseDuration = calculateBaseRoundDuration();
    const durations = [];
    
    for (let r = 1; r <= totalRounds; r++) {
        const dur = calculateRoundDuration(r, baseDuration);
        const bonus = isTimeBonusActive(r);
        const gyro = isGyroModeActive(r);
        durations.push({ round: r, duration: dur, timeBonus: bonus, gyro: gyro });
    }
    
    gameState.room.roundDurations = durations;
    gameState.room.totalRounds = totalRounds;
    gameState.room.baseDuration = baseDuration;
    
    addDebug(`📊 Precalculado: ${totalRounds} rondas, base ${baseDuration}s`);
    durations.forEach(d => addDebug(`  R${d.round}: ${d.duration}s ${d.timeBonus?'⚡':''} ${d.gyro?'📱':''}`));
    
    return durations;
}

// ========================================
// INTEGRACIÓN CON INICIO DE PARTIDA
// ========================================

function handleStartGame() {
    let confirmed = 0;
    gameState.room.players.forEach(p => { if (p.confirmed) confirmed++; });
    if (confirmed < 2) return;
    
    precalculateRoundDurations();
    
    broadcast('start-game', {
        config: gameState.room.config,
        roundDurations: gameState.room.roundDurations,
        totalRounds: gameState.room.totalRounds,
        baseDuration: gameState.room.baseDuration
    });
    
    addDebug('🚀 Iniciando partida con config:', gameState.room.config);
    alert('¡Partida iniciada! Config enviada a todos. Próximamente: pantalla de juego');
}

function handleStartGameSignal(data) {
    addDebug('🎮 Inicio recibido con config');
    
    gameState.room.config = data.config;
    gameState.room.roundDurations = data.roundDurations;
    gameState.room.totalRounds = data.totalRounds;
    gameState.room.baseDuration = data.baseDuration;
    
    alert('¡Partida iniciada! Config recibida. Próximamente: pantalla de juego');
}

// Exponer para pantalla de juego
window.gameConfig = {
    calculateTotalRounds,
    calculateBaseRoundDuration,
    calculateRoundDuration,
    isTimeBonusActive,
    calculateTimeBonus,
    isGyroModeActive,
    precalculateRoundDurations,
    getConfig: () => gameState.room.config
};