// ========================================
// CONFIGURACIÓN
// ========================================

const AVATARS = [
    '😎', '🤖', '👾', 
    '⭐', '🔮', '🛸', '🏄', '🧙',
    '🧝', '💩', '🧚'
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
    
    // Custom avatar buttons (se crean dinámicamente, usar delegación)
    document.addEventListener('click', (e) => {
        const customBtn = e.target.closest('.avatar-custom-btn');
        if (customBtn) {
            const grid = customBtn.closest('.avatar-grid');
            if (grid) handleAddCustomAvatar(grid.id);
        }
    });
    
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

function getRandomAvatarIndex() {
    return Math.floor(Math.random() * AVATARS.length);
}

function isValidEmoji(str) {
    if (!str || str.length === 0) return false;
    // Verificar que sea un emoji válido (tiene code points en rangos de emoji)
    // Excluir texto normal, números, letras
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F300}-\u{1F3FF}\u{1F400}-\u{1F4FF}\u{1F500}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]+$/u;
    return emojiRegex.test(str);
}

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
        grid.appendChild(btn);
    });
    
    // Botón para añadir emoji personalizado
    const customBtn = document.createElement('button');
    customBtn.className = 'avatar-option avatar-custom-btn';
    customBtn.innerHTML = '<span class="custom-avatar-plus">+</span>';
    customBtn.title = 'Añadir emoji personalizado';
    customBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAddCustomAvatar(gridId);
    });
    grid.appendChild(customBtn);
    
    // Seleccionar avatar aleatorio por defecto (si no hay guardado)
    const savedAvatar = localStorage.getItem(STORAGE_KEYS.PLAYER_AVATAR);
    const defaultIndex = savedAvatar && AVATARS.includes(savedAvatar) 
        ? AVATARS.indexOf(savedAvatar) 
        : getRandomAvatarIndex();
    
    const options = grid.querySelectorAll('.avatar-option:not(.avatar-custom-btn)');
    if (options[defaultIndex]) {
        options[defaultIndex].classList.add('selected');
        gameState.player.avatar = AVATARS[defaultIndex];
    }
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

function handleAddCustomAvatar(gridId) {
    const isGuest = gridId === 'guest-avatar-grid';
    const input = prompt('Introduce un emoji:');
    if (!input) return;
    
    const trimmed = input.trim();
    if (!isValidEmoji(trimmed)) {
        alert('Por favor, introduce solo un emoji válido (ej: 😀, 🎮, 🌈)');
        return;
    }
    
    // Añadir al array si no existe
    if (!AVATARS.includes(trimmed)) {
        AVATARS.push(trimmed);
    }
    
    // Re-renderizar ambos grids
    renderAvatars('avatar-grid');
    renderAvatars('guest-avatar-grid');
    
    // Seleccionar el nuevo emoji
    const newIndex = AVATARS.indexOf(trimmed);
    selectAvatar(newIndex, gridId);
    
    addDebug(`✨ Emoji personalizado añadido: ${trimmed}`);
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
    // elements.minPlayersMsg.style.display = confirmed < 2 ? 'block' : 'none';
    // elements.minPlayersMsg.textContent = confirmed < 2 
    //    ? `Mínimo 2 jugadores listos (${confirmed}/2)` : '';
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
    rounds: { mode: 'few', custom: 6 },
    duration: { mode: 'long', custom: 9 },
    timeBonus: 'sometimes',
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
    configElements.goFiguresBtn = document.getElementById('config-go-figures-btn');
    
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
    
    if (configElements.goFiguresBtn) {
        configElements.goFiguresBtn.addEventListener('click', openFiguresScreen);
    }
    
    configElements.roundsMode.forEach(r => r.addEventListener('change', () => toggleCustomInput('rounds')));
    configElements.durationMode.forEach(r => r.addEventListener('change', () => toggleCustomInput('duration')));
    
    configElements.gyroMode.forEach(r => r.addEventListener('change', updateGyroWarning));
}

function toggleCustomInput(type) {
    const mode = type === 'rounds' 
        ? document.querySelector('input[name="rounds-mode"]:checked').value
        : document.querySelector('input[name="duration-mode"]:checked').value;
    
    const customDiv = type === 'rounds' ? configElements.roundsCustom : configElements.durationCustom;
    const customInput = type === 'rounds' ? configElements.roundsCustomValue : configElements.durationCustomValue;
    const isCustom = mode === 'custom';
    
    customDiv.classList.toggle('hidden', !isCustom);
    customInput.disabled = !isCustom;
}

function checkGyroscopeSupport() {
    const hasOrientationSupport = 'DeviceOrientationEvent' in window;
    gameState.room.config._gyroSupported = hasOrientationSupport;
    
    const gyroSection = document.getElementById('gyro-section');
    
    if (!hasOrientationSupport) {
        // Ocultar toda la sección de giroscopio si no hay soporte
        gyroSection.classList.add('gyro-disabled');
        gameState.room.config.gyro = 'no';
    } else {
        gyroSection.classList.remove('gyro-disabled');
    }
}

function updateGyroWarning() {
    const supported = gameState.room.config._gyroSupported;
    const gyroSection = document.getElementById('gyro-section');
    
    if (!supported) {
        gyroSection.classList.add('gyro-disabled');
        gameState.room.config.gyro = 'no';
    } else {
        gyroSection.classList.remove('gyro-disabled');
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
    
    // Solo cargar gyro si la sección no está oculta
    const gyroSection = document.getElementById('gyro-section');
    if (!gyroSection.classList.contains('gyro-disabled')) {
        document.querySelector(`input[name="gyro-mode"][value="${c.gyro}"]`).checked = true;
    }
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

// ========================================
// PANTALLA DE AGREGAR FIGURAS
// ========================================

// Estado de figuras
const figuresState = {
    figures: [],           // Array de figuras guardadas
    currentFigure: null,   // Figura en edición
    history: [],           // Historial para undo
    historyIndex: -1,
    maskCanvas: null,
    maskCtx: null,
    sourceImage: null,
    maskImageData: null,
    pickedColor: null,     // {r,g,b, lab}
    tolerance: 50
};

// DB para figuras (IndexedDB)
const FIGURES_DB_NAME = 'colorGameFigures';
const FIGURES_STORE = 'figures';

// Inicializar IndexedDB
function initFiguresDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(FIGURES_DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(FIGURES_STORE)) {
                db.createObjectStore(FIGURES_STORE, { keyPath: 'id' });
            }
        };
    });
}

// Cargar figuras al iniciar
async function loadFigures() {
    try {
        const db = await initFiguresDB();
        const tx = db.transaction(FIGURES_STORE, 'readonly');
        const store = tx.objectStore(FIGURES_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            figuresState.figures = request.result || [];
            // Cargar también figuras locales predefinidas
            loadLocalFigures();
            renderFiguresList();
        };
    } catch (e) {
        addDebug('Error cargando figuras: ' + e.message);
        figuresState.figures = [];
        loadLocalFigures();
        renderFiguresList();
    }
}

// Cargar figuras locales desde /img/game/ y figures-config.js
async function loadLocalFigures() {
    try {
        // Intentar cargar el archivo de configuración del desarrollador
        const configResponse = await fetch('img/game/figures-config.js');
        if (configResponse.ok) {
            const configText = await configResponse.text();
            // Evaluar el config para obtener FIGURES_CONFIG
            eval(configText);
            if (typeof FIGURES_CONFIG !== 'undefined' && Array.isArray(FIGURES_CONFIG)) {
                for (const figConfig of FIGURES_CONFIG) {
                    // Verificar si ya existe en IndexedDB
                    const exists = figuresState.figures.some(f => f.id === figConfig.id || f.original === figConfig.url);
                    if (!exists) {
                        // Cargar la imagen y crear figura
                        await loadLocalFigureFromConfig(figConfig);
                    }
                }
            }
        }
    } catch (e) {
        addDebug('No se pudo cargar figures-config.js: ' + e.message);
    }
    
    // También escanear la carpeta img/game/ por imágenes (fallback)
    // Nota: En entorno web no se puede listar directorios, así que dependemos del config
}

async function loadLocalFigureFromConfig(config) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const originalDataUrl = canvas.toDataURL('image/png');
            
            // Crear máscara blanca simple (se editará después si se quiere)
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = img.naturalWidth;
            maskCanvas.height = img.naturalHeight;
            const mctx = maskCanvas.getContext('2d');
            mctx.drawImage(img, 0, 0);
            const maskDataUrl = maskCanvas.toDataURL('image/png');
            
            const figure = {
                id: config.id || 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: config.name || 'Figura local',
                original: originalDataUrl,
                mask: maskDataUrl,
                targetColor: {
                    rgb: config.lab ? labToRgb(config.lab.L, config.lab.a, config.lab.b) : { r: 255, g: 255, b: 0 },
                    lab: config.lab || { L: 50, a: 0, b: 0 }
                },
                tolerance: config.tolerance || 50,
                isLocal: true,
                localUrl: config.url,
                createdAt: Date.now()
            };
            
            figuresState.figures.push(figure);
            saveFigureToDB(figure); // Guardar también en IndexedDB para consistencia
            resolve();
        };
        img.onerror = () => {
            addDebug('Error cargando imagen local: ' + config.url);
            resolve();
        };
        img.src = config.url;
    });
}

// Conversión CIELAB a RGB (para figuras locales)
function labToRgb(L, a, b) {
    // L*a*b* a XYZ (D65)
    const fy = (L + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;
    
    const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
    const X = Xn * labInvF(fx);
    const Y = Yn * labInvF(fy);
    const Z = Zn * labInvF(fz);
    
    // XYZ a sRGB
    let r = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
    let g = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
    let bVal = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252; // Renombrado de 'let b' a 'let bVal'
    
    // Gamma correction
    const toSRGB = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1/2.4) - 0.055;
    r = Math.round(Math.max(0, Math.min(255, toSRGB(r) * 255)));
    g = Math.round(Math.max(0, Math.min(255, toSRGB(g) * 255)));
    bVal = Math.round(Math.max(0, Math.min(255, toSRGB(bVal) * 255))); // Actualizado a bVal
    
    return { r, g, b: bVal }; // Retorna usando bVal
}

function labInvF(t) {
    const delta = 6/29;
    return t > delta ? t*t*t : 3*delta*delta*(t - 4/29);
}

// Guardar figura en DB
async function saveFigureToDB(figure) {
    const db = await initFiguresDB();
    const tx = db.transaction(FIGURES_STORE, 'readwrite');
    const store = tx.objectStore(FIGURES_STORE);
    store.put(figure);
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

// Eliminar figura de DB
async function deleteFigureFromDB(id) {
    const db = await initFiguresDB();
    const tx = db.transaction(FIGURES_STORE, 'readwrite');
    const store = tx.objectStore(FIGURES_STORE);
    store.delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

// Elementos DOM de figures
const figuresElements = {};

function cacheFiguresElements() {
    figuresElements.backBtn = document.getElementById('figures-back-btn');
    figuresElements.saveStatus = document.getElementById('figures-save-status');
    figuresElements.list = document.getElementById('figures-list');
    figuresElements.empty = document.getElementById('figures-empty');
    
    // Tabs
    figuresElements.tabs = document.querySelectorAll('.figures-tab');
    figuresElements.tabFile = document.getElementById('tab-file');
    figuresElements.tabUrl = document.getElementById('tab-url');
    
    // File input
    figuresElements.dropZone = document.getElementById('drop-zone');
    figuresElements.fileInput = document.getElementById('figure-file-input');
    figuresElements.filePreview = document.getElementById('file-preview');
    figuresElements.filePreviewImg = document.getElementById('file-preview-img');
    figuresElements.fileClearBtn = document.getElementById('file-clear-btn');
    
    // URL input
    figuresElements.urlInput = document.getElementById('figure-url-input');
    figuresElements.urlFetchBtn = document.getElementById('figure-url-fetch-btn');
    figuresElements.urlPreview = document.getElementById('url-preview');
    figuresElements.urlPreviewImg = document.getElementById('url-preview-img');
    figuresElements.urlClearBtn = document.getElementById('url-clear-btn');
    
    // Mask editor
    figuresElements.maskSection = document.getElementById('mask-editor-section');
    figuresElements.maskCanvas = document.getElementById('mask-canvas');
    figuresElements.maskStatus = document.getElementById('mask-status');
    figuresElements.toleranceSlider = document.getElementById('tolerance-slider');
    figuresElements.toleranceValue = document.getElementById('tolerance-value');
    figuresElements.pickedColorBox = document.getElementById('picked-color-box');
    figuresElements.pickedColorLab = document.getElementById('picked-color-lab');
    figuresElements.maskUndoBtn = document.getElementById('mask-undo-btn');
    figuresElements.maskSaveBtn = document.getElementById('mask-save-btn');
}

function setupFiguresListeners() {
    // Back button
    figuresElements.backBtn.addEventListener('click', () => {
        showScreen('waiting-host-screen');
    });
    
    // Tabs
    figuresElements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchFiguresTab(tab.dataset.tab));
    });
    
    // File drop zone
    figuresElements.dropZone.addEventListener('click', () => figuresElements.fileInput.click());
    figuresElements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        figuresElements.dropZone.classList.add('drag-over');
    });
    figuresElements.dropZone.addEventListener('dragleave', () => {
        figuresElements.dropZone.classList.remove('drag-over');
    });
    figuresElements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        figuresElements.dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    });
    figuresElements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFileSelect(e.target.files[0]);
    });
    figuresElements.fileClearBtn.addEventListener('click', clearFileInput);
    
    // URL fetch
    figuresElements.urlFetchBtn.addEventListener('click', fetchImageFromUrl);
    figuresElements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchImageFromUrl();
    });
    figuresElements.urlClearBtn.addEventListener('click', clearUrlInput);
    
    // Mask editor
    figuresElements.toleranceSlider.addEventListener('input', (e) => {
        // Guardar estado anterior solo si hay color seleccionado y la tolerancia cambió significativamente
        if (figuresState.pickedColor) {
            saveHistoryState();
        }
        figuresState.tolerance = parseInt(e.target.value);
        figuresElements.toleranceValue.textContent = figuresState.tolerance;
        if (figuresState.sourceImage) applyMask();
    });
    
    figuresElements.maskUndoBtn.addEventListener('click', undoMask);
    figuresElements.maskSaveBtn.addEventListener('click', saveCurrentFigure);
    
    // Canvas click for color picking
    figuresElements.maskCanvas.addEventListener('click', pickColorFromCanvas);
}

function switchFiguresTab(tab) {
    figuresElements.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    figuresElements.tabFile.classList.toggle('active', tab === 'file');
    figuresElements.tabUrl.classList.toggle('active', tab === 'url');
    figuresElements.tabFile.classList.toggle('hidden', tab !== 'file');
    figuresElements.tabUrl.classList.toggle('hidden', tab !== 'url');
}

function initFiguresScreen() {
    cacheFiguresElements();
    setupFiguresListeners();
    loadFigures();
}

function openFiguresScreen() {
    if (!gameState.player.isHost) return;
    initFiguresScreen();
    showScreen('figures-screen');
}

// ========================================
// MANEJO DE ARCHIVOS
// ========================================

function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona una imagen válida');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        alert('La imagen no debe superar 2 MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        loadSourceImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

function clearFileInput() {
    figuresElements.fileInput.value = '';
    figuresElements.filePreview.classList.add('hidden');
    figuresElements.dropZone.querySelector('.drop-zone-content').style.display = 'flex';
    figuresElements.filePreviewImg.src = '';
}

// ========================================
// FETCH DESDE URL
// ========================================

async function fetchImageFromUrl() {
    const url = figuresElements.urlInput.value.trim();
    if (!url) return alert('Ingresa una URL válida');
    
    figuresElements.urlFetchBtn.disabled = true;
    figuresElements.urlFetchBtn.innerHTML = '<span class="btn-icon">⏳</span> Buscando...';
    
    try {
        // Primero intentar si es una URL directa de imagen
        const isDirectImage = /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url);
        
        if (isDirectImage) {
            // URL directa a imagen - intentar cargar directamente
            await loadImageWithCors(url);
        } else {
            // URL de página web - intentar extraer imagen
            const imageUrl = await extractImageFromUrl(url);
            if (!imageUrl) throw new Error('No se encontró imagen en la página');
            await loadImageWithCors(imageUrl);
        }
        
    } catch (err) {
        addDebug('Error fetch URL: ' + err.message);
        alert('No se pudo obtener la imagen: ' + err.message);
    } finally {
        figuresElements.urlFetchBtn.disabled = false;
        figuresElements.urlFetchBtn.innerHTML = '<span class="btn-icon">🔍</span> Buscar';
    }
}

async function extractImageFromUrl(pageUrl) {
    // Usar textise dot iitty o similar para extraer meta tags
    // Por simplicidad, intentamos fetch directo con modo no-cors y luego fallback
    try {
        // Proxy CORS gratuito para leer HTML
        const proxyUrl = `https://r.jina.ai/http://${pageUrl.replace(/^https?:\/\//, '')}`;
        const response = await fetch(proxyUrl);
        const text = await response.text();
        
        // Buscar og:image, twitter:image, o primera img grande
        const ogMatch = text.match(/<meta property="og:image" content="([^"]+)"/i) ||
                       text.match(/<meta name="twitter:image" content="([^"]+)"/i);
        if (ogMatch) return ogMatch[1];
        
        // Buscar primera imagen grande en el HTML
        const imgMatches = [...text.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
        for (const match of imgMatches) {
            const src = match[1];
            if (src.startsWith('http') || src.startsWith('//')) {
                return src.startsWith('//') ? 'https:' + src : src;
            }
        }
    } catch (e) {
        addDebug('Error extrayendo imagen: ' + e.message);
    }
    return null;
}

function loadImageWithCors(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Convertir a data URL para evitar problemas de CORS después
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            loadSourceImage(dataUrl);
            resolve();
        };
        img.onerror = () => reject(new Error('No se pudo cargar la imagen (CORS)'));
        img.src = imageUrl;
    });
}

function clearUrlInput() {
    figuresElements.urlInput.value = '';
    figuresElements.urlPreview.classList.add('hidden');
    figuresElements.urlPreviewImg.src = '';
}

// ========================================
// CARGA DE IMAGEN FUENTE
// ========================================

function loadSourceImage(dataUrl) {
    figuresElements.dropZone.querySelector('.drop-zone-content').style.display = 'none';
    figuresElements.filePreview.classList.remove('hidden');
    figuresElements.filePreviewImg.src = dataUrl;
    
    // Cargar en canvas para editor de máscara
    const img = new Image();
    img.onload = () => {
        setupMaskEditor(img);
        figuresElements.maskSection.classList.remove('hidden');
        figuresElements.maskStatus.textContent = 'Haz clic en el color a ocultar';
        figuresElements.maskStatus.style.color = 'var(--primary-color)';
        figuresElements.maskSaveBtn.disabled = true;
        figuresElements.maskUndoBtn.disabled = true;
        figuresState.history = [];
        figuresState.historyIndex = -1;
    };
    img.src = dataUrl;
    figuresState.sourceImage = img;
}

function setupMaskEditor(img) {
    const canvas = figuresElements.maskCanvas;
    const ctx = canvas.getContext('2d');
    
    // Canvas FIJO de 600x500 - la imagen se centra y escala para llenar
    const canvasW = 600;
    const canvasH = 500;
    canvas.width = canvasW;
    canvas.height = canvasH;
    
    // Calcular escala para que la imagen cubra todo el canvas (cover)
    const scale = Math.max(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
    const drawW = Math.round(img.naturalWidth * scale);
    const drawH = Math.round(img.naturalHeight * scale);
    const drawX = Math.round((canvasW - drawW) / 2);
    const drawY = Math.round((canvasH - drawH) / 2);
    
    // Fondo negro (para transparencias)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasW, canvasH);
    
    // Dibujar imagen centrada y escalada (cover)
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    
    figuresState.maskCanvas = canvas;
    figuresState.maskCtx = ctx;
    
    // GUARDAR IMAGEN ORIGINAL LIMPIA (sin máscara) - base para recalcular
    figuresState.originalImageData = ctx.getImageData(0, 0, canvasW, canvasH);
    figuresState.maskImageData = ctx.getImageData(0, 0, canvasW, canvasH);
    
    // Sincronizar slider de tolerancia con el valor actual
    figuresElements.toleranceSlider.value = figuresState.tolerance;
    figuresElements.toleranceValue.textContent = figuresState.tolerance;
    
    // Guardar estado inicial en historial (solo la imagen original)
    saveHistoryState();
}

function saveHistoryState() {
    // Guardar estado del editor (color seleccionado + tolerancia)
    // No guardamos imagen - se recalcula siempre desde original
    figuresState.history = figuresState.history.slice(0, figuresState.historyIndex + 1);
    figuresState.history.push({
        pickedColor: figuresState.pickedColor ? {...figuresState.pickedColor} : null,
        tolerance: figuresState.tolerance
    });
    figuresState.historyIndex = figuresState.history.length - 1;
    figuresElements.maskUndoBtn.disabled = figuresState.historyIndex <= 0;
}

function undoMask() {
    if (figuresState.historyIndex <= 0) return;
    figuresState.historyIndex--;
    const state = figuresState.history[figuresState.historyIndex];
    
    figuresState.pickedColor = state.pickedColor ? {...state.pickedColor} : null;
    figuresState.tolerance = state.tolerance;
    
    // Actualizar UI
    figuresElements.toleranceSlider.value = figuresState.tolerance;
    figuresElements.toleranceValue.textContent = figuresState.tolerance;
    
    if (figuresState.pickedColor) {
        figuresElements.pickedColorBox.style.background = `rgb(${figuresState.pickedColor.r},${figuresState.pickedColor.g},${figuresState.pickedColor.b})`;
        const lab = figuresState.pickedColor.lab;
        figuresElements.pickedColorLab.textContent = lab ? `L: ${lab.L.toFixed(1)} a: ${lab.a.toFixed(1)} b: ${lab.b.toFixed(1)}` : 'L: — a: — b: —';
        figuresElements.maskStatus.textContent = lab ? `Color seleccionado: L${lab.L.toFixed(0)} a${lab.a.toFixed(0)} b${lab.b.toFixed(0)}` : 'Haz clic en el color a ocultar';
        figuresElements.maskStatus.style.color = 'var(--success-color)';
        figuresElements.maskSaveBtn.disabled = false;
    } else {
        figuresElements.pickedColorBox.style.background = 'var(--surface)';
        figuresElements.pickedColorLab.textContent = 'L: — a: — b: —';
        figuresElements.maskStatus.textContent = 'Haz clic en el color a ocultar';
        figuresElements.maskStatus.style.color = 'var(--primary-color)';
        figuresElements.maskSaveBtn.disabled = true;
    }
    
    // Reaplicar máscara con estado restaurado
    applyMask();
    
    figuresElements.maskUndoBtn.disabled = figuresState.historyIndex <= 0;
}

// ========================================
// COLOR PICKING Y MÁSCARA
// ========================================

function pickColorFromCanvas(e) {
    if (!figuresState.maskCtx) return;
    
    const rect = figuresElements.maskCanvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    
    if (x < 0 || x >= figuresState.maskCanvas.width || y < 0 || y >= figuresState.maskCanvas.height) return;
    
    const pixel = figuresState.maskCtx.getImageData(x, y, 1, 1).data;
    const r = pixel[0], g = pixel[1], b = pixel[2], a = pixel[3];
    
    if (a === 0) return; // Transparente
    
    // Guardar estado anterior en historial antes de cambiar
    saveHistoryState();
    
    figuresState.pickedColor = { r, g, b };
    const lab = rgbToLab(r, g, b);
    figuresState.pickedColor.lab = lab;
    
    // Actualizar UI
    figuresElements.pickedColorBox.style.background = `rgb(${r},${g},${b})`;
    figuresElements.pickedColorLab.textContent = `L: ${lab.L.toFixed(1)} a: ${lab.a.toFixed(1)} b: ${lab.b.toFixed(1)}`;
    figuresElements.maskStatus.textContent = `Color seleccionado: L${lab.L.toFixed(0)} a${lab.a.toFixed(0)} b${lab.b.toFixed(0)}`;
    figuresElements.maskStatus.style.color = 'var(--success-color)';
    figuresElements.maskSaveBtn.disabled = false;
    
    // Aplicar máscara automáticamente
    applyMask();
}

function applyMask() {
    if (!figuresState.pickedColor || !figuresState.originalImageData) return;
    
    const { r: tr, g: tg, b: tb } = figuresState.pickedColor;
    const tolerance = figuresState.tolerance;
    const tolSq = tolerance * tolerance;
    
    // SIEMPRE trabajar desde la imagen original limpia
    const srcData = figuresState.originalImageData.data;
    const dstData = figuresState.maskImageData.data;
    const width = figuresState.maskCanvas.width;
    const height = figuresState.maskCanvas.height;
    
    // Copiar original a máscara y aplicar filtro
    for (let i = 0; i < srcData.length; i += 4) {
        const r = srcData[i];
        const g = srcData[i+1];
        const b = srcData[i+2];
        const a = srcData[i+3];
        
        dstData[i] = r;
        dstData[i+1] = g;
        dstData[i+2] = b;
        dstData[i+3] = a;
        
        if (a === 0) continue;
        
        // Distancia euclidiana en RGB
        const dr = r - tr, dg = g - tg, db = b - tb;
        const distSq = dr*dr + dg*dg + db*db;
        
        if (distSq <= tolSq) {
            // Enmascarar: blanco con alpha original
            dstData[i] = 255;
            dstData[i+1] = 255;
            dstData[i+2] = 255;
            // alpha se mantiene
        }
    }
    
    figuresState.maskCtx.putImageData(figuresState.maskImageData, 0, 0);
    // NO guardar en historial aquí - la máscara se recalcula en tiempo real
}

// ========================================
// CONVERSIÓN RGB → CIELAB (D65, 2° observer)
// ========================================

function rgbToLab(r, g, b) {
    // sRGB a XYZ (D65)
    let [sr, sg, sb] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    // Matriz sRGB → XYZ (D65)
    const X = sr * 0.4124564 + sg * 0.3575761 + sb * 0.1804375;
    const Y = sr * 0.2126729 + sg * 0.7151522 + sb * 0.0721750;
    const Z = sr * 0.0193339 + sg * 0.1191920 + sb * 0.9503041;
    
    // Normalizar por blanco D65
    const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
    const fx = f(X / Xn);
    const fy = f(Y / Yn);
    const fz = f(Z / Zn);
    
    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bVal = 200 * (fy - fz); // Renombrado de 'b' a 'bVal' para evitar el conflicto
    
    return { L: Math.max(0, Math.min(100, L)), a, b: bVal };
}

function f(t) {
    return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
}

// ========================================
// GUARDAR FIGURA
// ========================================

async function saveCurrentFigure() {
    if (!figuresState.pickedColor || !figuresState.sourceImage) {
        alert('Primero selecciona un color en la imagen');
        return;
    }
    
    // Generar máscara final (imagen con zona enmascarada en blanco)
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = figuresState.maskCanvas.width;
    maskCanvas.height = figuresState.maskCanvas.height;
    const mctx = maskCanvas.getContext('2d');
    mctx.putImageData(figuresState.maskImageData, 0, 0);
    const maskDataUrl = maskCanvas.toDataURL('image/png');
    
    // Imagen original
    const origCanvas = document.createElement('canvas');
    origCanvas.width = figuresState.sourceImage.naturalWidth;
    origCanvas.height = figuresState.sourceImage.naturalHeight;
    const octx = origCanvas.getContext('2d');
    octx.drawImage(figuresState.sourceImage, 0, 0);
    const originalDataUrl = origCanvas.toDataURL('image/png');
    
    // Crear objeto figura
    const figure = {
        id: 'fig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: 'Figura ' + (figuresState.figures.length + 1),
        original: originalDataUrl,
        mask: maskDataUrl,
        targetColor: {
            rgb: { r: figuresState.pickedColor.r, g: figuresState.pickedColor.g, b: figuresState.pickedColor.b },
            lab: figuresState.pickedColor.lab
        },
        tolerance: figuresState.tolerance,
        createdAt: Date.now()
    };
    
    try {
        await saveFigureToDB(figure);
        figuresState.figures.push(figure);
        renderFiguresList();
        
        // Reset editor
        resetMaskEditor();
        
        figuresElements.saveStatus.textContent = '✅ Guardada';
        setTimeout(() => figuresElements.saveStatus.textContent = '', 2000);
        addDebug(`💾 Figura guardada: ${figure.id} - Color objetivo: L${figure.targetColor.lab.L.toFixed(1)}`);
        
    } catch (err) {
        addDebug('Error guardando figura: ' + err.message);
        alert('Error al guardar: ' + err.message);
    }
}

function resetMaskEditor() {
    figuresElements.maskSection.classList.add('hidden');
    figuresElements.filePreview.classList.add('hidden');
    figuresElements.dropZone.querySelector('.drop-zone-content').style.display = 'flex';
    figuresElements.filePreviewImg.src = '';
    figuresElements.fileInput.value = '';
    figuresState.sourceImage = null;
    figuresState.pickedColor = null;
    figuresState.maskImageData = null;
    figuresState.history = [];
    figuresState.historyIndex = -1;
    figuresElements.pickedColorBox.style.background = 'var(--surface)';
    figuresElements.pickedColorLab.textContent = 'L: — a: — b: —';
    figuresElements.maskUndoBtn.disabled = true;
    figuresElements.maskSaveBtn.disabled = true;
}

// ========================================
// RENDER LISTA DE FIGURAS
// ========================================

function renderFiguresList() {
    figuresElements.list.innerHTML = '';
    
    if (figuresState.figures.length === 0) {
        figuresElements.empty.style.display = 'block';
        return;
    }
    figuresElements.empty.style.display = 'none';
    
    figuresState.figures.forEach(fig => {
        const item = document.createElement('div');
        item.className = 'figure-item';
        item.innerHTML = `
            <img src="${fig.mask}" alt="${fig.name}">
            <button class="figure-item-delete" data-id="${fig.id}" title="Eliminar">✕</button>
        `;
        item.querySelector('.figure-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFigure(fig.id);
        });
        item.addEventListener('click', () => selectFigure(fig));
        figuresElements.list.appendChild(item);
    });
}

async function deleteFigure(id) {
    if (!confirm('¿Eliminar esta figura?')) return;
    try {
        await deleteFigureFromDB(id);
        figuresState.figures = figuresState.figures.filter(f => f.id !== id);
        renderFiguresList();
        addDebug('🗑️ Figura eliminada: ' + id);
    } catch (err) {
        alert('Error eliminando: ' + err.message);
    }
}

function selectFigure(fig) {
    // Para uso futuro en la partida
    gameState.room.selectedFigure = fig;
    addDebug(`🎯 Figura seleccionada para partida: ${fig.id}`);
    // Feedback visual
    document.querySelectorAll('.figure-item').forEach(el => el.classList.remove('figure-item-selected'));
    event.currentTarget.classList.add('figure-item-selected');
}

// ========================================
// EXPONER PARA PANTALLA DE JUEGO
// ========================================

window.figuresAPI = {
    getFigures: () => figuresState.figures,
    getSelectedFigure: () => gameState.room.selectedFigure,
    loadFigures: loadFigures
};

// Integrar botón en waiting-host-screen (se hace en setupEventListeners principal)
// Agregar al setupEventListeners existente:
// elements.figuresBtn?.addEventListener('click', openFiguresScreen);