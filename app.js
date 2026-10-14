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
        case 'start-game': handleStartGameSignal(); break;
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

function handleSettings() { alert('Configuración - Próximamente'); }

function handleStartGame() {
    let confirmed = 0;
    gameState.room.players.forEach(p => { if (p.confirmed) confirmed++; });
    if (confirmed < 2) return;
    
    broadcast('start-game', {});
    addDebug('🚀 Iniciando partida');
    alert('¡Partida iniciada! Próximamente pantalla de juego');
}

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