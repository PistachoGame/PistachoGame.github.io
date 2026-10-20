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
    debugInfo: [],
    // Propiedades de la partida y el juego
    currentFigure: null,
    currentRound: 0,
    totalRounds: 0,
    roundDuration: 0,
    timeRemaining: 0,
    timerInterval: null,
    countdownInterval: null,
    playerRgb: { r: 128, g: 128, b: 128 },
    targetLab: { L: 50, a: 0, b: 0 },
    roundActive: false,
    turnEnded: false,
    scores: {},
    roundResults: [],
    allFigures: [],
    isGyroActive: false,
    gyroAlpha: 0,
    gyroBeta: 0,
    gyroGamma: 0,
    gyroPermissionGranted: false
};

const elements = {};

// ========================================
// INICIO
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    cacheFiguresElements() // <--- Añadir esto aquí previene futuros errores de elementos no cacheados
    setupEventListeners();
    loadSavedPlayerData();
    renderAvatars('avatar-grid');
    renderAvatars('guest-avatar-grid');
    updateCreateButton();
    updateGuestConfirmButton();

    // Cargar las figuras guardadas o locales al iniciar la app
    try {
        await loadFigures();
    } catch (e) {
        addDebug('⚠️ No se pudieron precargar las figuras al iniciar');
    }
    
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
    
    // ➕ AGREGAR ESTO: Registrarse a sí mismo en el mapa local de jugadores del invitado
    gameState.room.players.set(gameState.player.id, {
        id: gameState.player.id,
        name: gameState.player.name,
        avatar: gameState.player.avatar,
        isHost: false,
        confirmed: true
    });
    
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

// En handlePeerMessage, actualiza gameTypes para que procese todos los mensajes del juego:
function handlePeerMessage(from, data) {
    addDebug(`📨 ${from.substring(0,8)}: ${data.type}`);
    
    // Game messages (incluyendo figure-data, round-results y game-results)
    const gameTypes = ['player-rgb', 'start-round', 'end-round', 'game-ended', 'figure-data', 'round-results', 'game-results'];
    if (gameTypes.includes(data.type)) {
        handleGameMessage(from, data);
        return;
    }
    
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
    
    elements.startGameBtn.disabled = confirmed < 1; //jugadoresminimos
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
    if (confirmed < 1) return; //jugadoresminimos
    
    precalculateRoundDurations();
    
    broadcast('start-game', {
        config: gameState.room.config,
        roundDurations: gameState.room.roundDurations,
        totalRounds: gameState.room.totalRounds,
        baseDuration: gameState.room.baseDuration
    });
    
    addDebug('🚀 Iniciando partida con config:', gameState.room.config);
    startGame();
}

function handleStartGameSignal(data) {
    addDebug('🎮 Inicio recibido con config');
    
    gameState.room.config = data.config;
    gameState.room.roundDurations = data.roundDurations;
    gameState.room.totalRounds = data.totalRounds;
    gameState.room.baseDuration = data.baseDuration;
    
    // Start the game screen
    startGame();
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
            const size = 500;
            const minDim = Math.min(img.naturalWidth, img.naturalHeight);
            const sx = (img.naturalWidth - minDim) / 2;
            const sy = (img.naturalHeight - minDim) / 2;

            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            const originalDataUrl = canvas.toDataURL('image/png');
            
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = size;
            maskCanvas.height = size;
            const mctx = maskCanvas.getContext('2d');
            mctx.drawImage(canvas, 0, 0);
            
            const origImgData = ctx.getImageData(0, 0, size, size);
            const maskImgData = mctx.getImageData(0, 0, size, size);
            const srcData = origImgData.data;
            const dstData = maskImgData.data;
            
            // Usar RGB directamente en lugar de LAB
            const targetRgb = config.rgb || { r: 255, g: 255, b: 255 };
            const tolerance = config.tolerance || 50;
            const tolSq = tolerance * tolerance;
            
            for (let i = 0; i < srcData.length; i += 4) {
                const r = srcData[i];
                const g = srcData[i+1];
                const b = srcData[i+2];
                const a = srcData[i+3];
                
                if (a === 0) {
                    dstData[i+3] = 0;
                    continue;
                }
                
                const dr = r - targetRgb.r;
                const dg = g - targetRgb.g;
                const db = b - targetRgb.b;
                const distSq = dr*dr + dg*dg + db*db;
                
                if (distSq <= tolSq) {
                    dstData[i] = 255;
                    dstData[i+1] = 255;
                    dstData[i+2] = 255;
                    dstData[i+3] = 255;
                } else {
                    dstData[i+3] = 0;
                }
            }
            
            mctx.putImageData(maskImgData, 0, 0);
            const maskDataUrl = maskCanvas.toDataURL('image/png');
            
            const figure = {
                id: config.id || 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: config.name || 'Figura local',
                original: originalDataUrl,
                mask: maskDataUrl,
                targetColor: {
                    rgb: targetRgb
                },
                tolerance: tolerance,
                isLocal: true,
                localUrl: config.url,
                createdAt: Date.now()
            };
            
            figuresState.figures.push(figure);
            saveFigureToDB(figure);
            resolve();
        };
        img.onerror = () => resolve();
        img.src = config.url;
    });
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
    
    const size = 500;
    canvas.width = size;
    canvas.height = size;
    
    // Recorte cuadrado centrado (cover)
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - minDim) / 2;
    const sy = (img.naturalHeight - minDim) / 2;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
    
    figuresState.maskCanvas = canvas;
    figuresState.maskCtx = ctx;
    
    figuresState.originalImageData = ctx.getImageData(0, 0, size, size);
    figuresState.maskImageData = ctx.getImageData(0, 0, size, size);
    
    figuresElements.toleranceSlider.value = figuresState.tolerance;
    figuresElements.toleranceValue.textContent = figuresState.tolerance;
    
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
    
    saveHistoryState();
    
    // Guardar directamente los valores RGB
    figuresState.pickedColor = { r, g, b };
    
    // Actualizar UI con formato RGB en lugar de LAB
    figuresElements.pickedColorBox.style.background = `rgb(${r},${g},${b})`;
    figuresElements.pickedColorLab.textContent = `R: ${r} G: ${g} B: ${b}`;
    figuresElements.maskStatus.textContent = `Color seleccionado: R:${r} G:${g} B:${b}`;
    figuresElements.maskStatus.style.color = 'var(--success-color)';
    figuresElements.maskSaveBtn.disabled = false;
    
    applyMask();
}

function applyMask() {
    if (!figuresState.pickedColor || !figuresState.originalImageData) return;
    
    const { r: tr, g: tg, b: tb } = figuresState.pickedColor;
    const tolerance = figuresState.tolerance;
    const tolSq = tolerance * tolerance;
    
    const srcData = figuresState.originalImageData.data;
    const dstData = figuresState.maskImageData.data;
    
    for (let i = 0; i < srcData.length; i += 4) {
        const r = srcData[i];
        const g = srcData[i+1];
        const b = srcData[i+2];
        const a = srcData[i+3];
        
        if (a === 0) {
            dstData[i+3] = 0;
            continue;
        }
        
        const dr = r - tr, dg = g - tg, db = b - tb;
        const distSq = dr*dr + dg*dg + db*db;
        
        if (distSq <= tolSq) {
            // Píxel dentro de la tolerancia: blanco opaco (forma la máscara)
            dstData[i] = 255;
            dstData[i+1] = 255;
            dstData[i+2] = 255;
            dstData[i+3] = 255;
        } else {
            // Píxel fuera de la tolerancia: transparente (oculta el resto de la imagen)
            dstData[i] = 0;
            dstData[i+1] = 0;
            dstData[i+2] = 0;
            dstData[i+3] = 0;
        }
    }
    
    figuresState.maskCtx.putImageData(figuresState.maskImageData, 0, 0);
}

// ========================================
// CONVERSIÓN RGB → CIELAB (D65, 2° observer) (obsoleto?)
// ========================================


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
    
    const size = 500;

    // Máscara cuadrada
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = size;
    maskCanvas.height = size;
    const mctx = maskCanvas.getContext('2d');
    mctx.putImageData(figuresState.maskImageData, 0, 0);
    const maskDataUrl = maskCanvas.toDataURL('image/png');
    
    // Imagen original cuadrada
    const origCanvas = document.createElement('canvas');
    origCanvas.width = size;
    origCanvas.height = size;
    const octx = origCanvas.getContext('2d');
    const minDim = Math.min(figuresState.sourceImage.naturalWidth, figuresState.sourceImage.naturalHeight);
    const sx = (figuresState.sourceImage.naturalWidth - minDim) / 2;
    const sy = (figuresState.sourceImage.naturalHeight - minDim) / 2;
    octx.drawImage(figuresState.sourceImage, sx, sy, minDim, minDim, 0, 0, size, size);
    const originalDataUrl = origCanvas.toDataURL('image/png');
    
    const figure = {
        id: 'fig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: 'Figura ' + (figuresState.figures.length + 1),
        original: originalDataUrl,
        mask: maskDataUrl,
        targetColor: {
            rgb: { r: figuresState.pickedColor.r, g: figuresState.pickedColor.g, b: figuresState.pickedColor.b }
        },
        tolerance: figuresState.tolerance,
        createdAt: Date.now()
    };
    
    try {
        await saveFigureToDB(figure);
        figuresState.figures.push(figure);
        renderFiguresList();
        resetMaskEditor();
        
        figuresElements.saveStatus.textContent = '✅ Guardada';
        setTimeout(() => figuresElements.saveStatus.textContent = '', 2000);
        addDebug(`💾 Figura guardada en formato cuadrado perfecto`);
        
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
    // Si no estamos en la pantalla de figuras, el elemento no existe; salimos de forma segura
    if (!figuresElements.list) return;
    
    figuresElements.list.innerHTML = '';
    
    if (figuresState.figures.length === 0) {
        if (figuresElements.empty) figuresElements.empty.style.display = 'block';
        return;
    }
    if (figuresElements.empty) figuresElements.empty.style.display = 'none';
    
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
        item.addEventListener('click', (event) => selectFigure(fig, event));
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

// ========================================
// PANTALLA DE JUEGO
// ========================================

const gameElements = {};

function cacheGameElements() {
    gameElements.exitBtn = document.getElementById('game-exit-btn');
    gameElements.timer = document.getElementById('game-timer');
    gameElements.roundInfo = document.getElementById('game-round-info');
    gameElements.countdownOverlay = document.getElementById('countdown-overlay');
    gameElements.countdownNumber = document.getElementById('countdown-number');
    gameElements.canvas = document.getElementById('game-canvas');
    gameElements.figureLabel = document.getElementById('figure-label');
    
    // Knobs
    gameElements.knobL = { 
        canvas: document.getElementById('knob-l-canvas'),
        input: document.getElementById('knob-l-input'),
        value: document.getElementById('knob-l-value')
    };
    gameElements.knobA = { 
        canvas: document.getElementById('knob-a-canvas'),
        input: document.getElementById('knob-a-input'),
        value: document.getElementById('knob-a-value')
    };
    gameElements.knobB = { 
        canvas: document.getElementById('knob-b-canvas'),
        input: document.getElementById('knob-b-input'),
        value: document.getElementById('knob-b-value')
    };
    
    gameElements.endTurnBtn = document.getElementById('game-end-turn-btn');
    
    // Results
    gameElements.roundResultsOverlay = document.getElementById('round-results-overlay');
    gameElements.resultsRoundNum = document.getElementById('results-round-num');
    gameElements.resultsList = document.getElementById('results-list');
    gameElements.resultsTotal = document.getElementById('results-total');
    gameElements.nextRoundBtn = document.getElementById('next-round-btn');
    
    gameElements.gameEndOverlay = document.getElementById('game-end-overlay');
    gameElements.finalScores = document.getElementById('final-scores');
    gameElements.winnerAnnouncement = document.getElementById('winner-announcement');
    gameElements.backToHomeBtn = document.getElementById('back-to-home-btn');
}

function setupGameListeners() {
    gameElements.exitBtn.addEventListener('click', handleGameExit);
    gameElements.endTurnBtn.addEventListener('click', handleEndTurn);
    // gameElements.nextRoundBtn.addEventListener('click', handleNextRound);
    gameElements.backToHomeBtn.addEventListener('click', handleGameExit);
    
    // Knob listeners
    //setupKnob(gameElements.knobL, 'L');
    //setupKnob(gameElements.knobA, 'a');
    //setupKnob(gameElements.knobB, 'b');
}

// ========================================
// CUBO 3D RGB Y ROTACIÓN LIBRE (TRACKBALL)
// ========================================

const cubeState = {
    // Matriz de rotación inicial (Identidad 3x3)
    matrix: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    ],
    isDragging: false,
    startX: 0,
    startY: 0
};

// Multiplicación de matrices 3x3 para acumular rotaciones libres
function multiplyMatrices(a, b) {
    let res = [0,0,0, 0,0,0, 0,0,0];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            res[i*3 + j] = a[i*3+0]*b[0*3+j] + a[i*3+1]*b[1*3+j] + a[i*3+2]*b[2*3+j];
        }
    }
    return res;
}

function rotateMatrix(matrix, dx, dy) {
    const alpha = dx * 0.01; // Movimiento horizontal en pantalla
    const beta = -dy * 0.01; // Movimiento vertical en pantalla

    // Rotación incremental en X
    const cosB = Math.cos(beta), sinB = Math.sin(beta);
    const rx = [
        1, 0, 0,
        0, cosB, -sinB,
        0, sinB, cosB
    ];

    // Rotación incremental en Y
    const cosA = Math.cos(alpha), sinA = Math.sin(alpha);
    const ry = [
        cosA, 0, sinA,
        0, 1, 0,
        -sinA, 0, cosA
    ];

    // Acumular la rotación libremente multiplicando las matrices
    let delta = multiplyMatrices(ry, rx);
    return multiplyMatrices(delta, matrix);
}

function initRgbCube() {
    const container = document.getElementById('rgb-cube-container');
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
        if (!gameState.roundActive || gameState.turnEnded) return;
        cubeState.isDragging = true;
        cubeState.startX = e.clientX;
        cubeState.startY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!cubeState.isDragging) return;
        const dx = e.clientX - cubeState.startX;
        const dy = e.clientY - cubeState.startY;
        cubeState.startX = e.clientX;
        cubeState.startY = e.clientY;

        cubeState.matrix = rotateMatrix(cubeState.matrix, dx, dy);
        renderRgbCube();
    });

    window.addEventListener('mouseup', () => { cubeState.isDragging = false; });

    container.addEventListener('touchstart', (e) => {
        if (!gameState.roundActive || gameState.turnEnded) return;
        cubeState.isDragging = true;
        cubeState.startX = e.touches[0].clientX;
        cubeState.startY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!cubeState.isDragging) return;
        const dx = e.touches[0].clientX - cubeState.startX;
        const dy = e.touches[0].clientY - cubeState.startY;
        cubeState.startX = e.touches[0].clientX;
        cubeState.startY = e.touches[0].clientY;

        cubeState.matrix = rotateMatrix(cubeState.matrix, dx, dy);
        renderRgbCube();
    }, { passive: true });

    window.addEventListener('touchend', () => { cubeState.isDragging = false; });

    renderRgbCube();
}

function renderRgbCube() {
    const canvas = document.getElementById('rgb-cube-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const cx = width / 2;
    const cy = height / 2;
    const scale = 75;

    // Obtener la matriz transpuesta (inversa para rotaciones ortogonales)
    const m = cubeState.matrix;
    const mt = [
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8]
    ];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const nx = (x - cx) / scale;
            const ny = (y - cy) / scale;
            const distSq = nx * nx + ny * ny;
            const index = (y * width + x) * 4;

            if (distSq <= 1.5) {
                let z = Math.sqrt(Math.max(0, 1.5 - distSq));

                // Mapeo libre usando la matriz acumulada
                let rx = mt[0]*nx + mt[1]*ny + mt[2]*z;
                let ry = mt[3]*nx + mt[4]*ny + mt[5]*z;
                let rz = mt[6]*nx + mt[7]*ny + mt[8]*z;

                let red = Math.max(0, Math.min(255, Math.round(((rx + 0.5) / 1) * 255)));
                let green = Math.max(0, Math.min(255, Math.round(((ry + 0.5) / 1) * 255)));
                let blue = Math.max(0, Math.min(255, Math.round(((rz + 0.5) / 1) * 255)));

                data[index]     = red;
                data[index + 1] = green;
                data[index + 2] = blue;
                data[index + 3] = 255;
            } else {
                data[index + 3] = 0;
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    updateSelectedColorFromCube();
}

function updateSelectedColorFromCube() {
    // El punto blanco está fijo exactamente en el centro (nx = 0, ny = 0)
    let nx = 0, ny = 0;
    let z = Math.sqrt(Math.max(0, 1.5 - (nx*nx + ny*ny)));

    const m = cubeState.matrix;
    const mt = [
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8]
    ];

    let rx = mt[0]*nx + mt[1]*ny + mt[2]*z;
    let ry = mt[3]*nx + mt[4]*ny + mt[5]*z;
    let rz = mt[6]*nx + mt[7]*ny + mt[8]*z;

    const clampedX = Math.max(-0.5, Math.min(0.5, rx));
    const clampedY = Math.max(-0.5, Math.min(0.5, ry));
    const clampedZ = Math.max(-0.5, Math.min(0.5, rz));

    gameState.playerRgb = {
        r: Math.round((clampedX + 0.5) * 255),
        g: Math.round((clampedY + 0.5) * 255),
        b: Math.round((clampedZ + 0.5) * 255)
    };
    
    updateFigureMaskWithCurrentColor();
}


function initGameScreen() {
    cacheGameElements();
    setupGameListeners();
    resetGameState();
}

function resetGameState() {
    gameState.currentRound = 0;
    gameState.totalRounds = gameState.room.totalRounds || 5;
    gameState.roundDuration = gameState.room.baseDuration || 10;
    gameState.timeRemaining = gameState.roundDuration;
    gameState.playerRgb = { r: 128, g: 128, b: 128 };
    gameState.targetLab = { L: 50, a: 0, b: 0 };
    gameState.roundActive = false;
    gameState.turnEnded = false;
    gameState.scores = {};
    gameState.roundResults = [];
    gameState.isGyroActive = false;
    
    // Initialize scores for all players
    gameState.room.players.forEach((p, id) => {
        gameState.scores[id] = { roundScores: [], total: 0 };
    });
    
    // Reset knobs
    //meElements.knobL._setValue) gameElements.knobL._setValue(50);
    //if (gameElements.knobA._setValue) gameElements.knobA._setValue(0);
    //if (gameElements.knobB._setValue) gameElements.knobB._setValue(0);
    gameState.playerLab = { L: 50, a: 0, b: 0 };
}

async function startGame() {
    initGameScreen();
    showScreen('game-screen');
    initRgbCube();
    
    // Load all figures (preloaded + local)
    await loadAllFigures();
    
    // Initialize scores for all players
    gameState.scores = {};
    gameState.room.players.forEach((p, id) => {
        gameState.scores[id] = { roundScores: [], total: 0 };
    });
    
    // Start countdown
    await runCountdown();
    
    // Start first round
    startRound();
}

async function loadAllFigures() {
    // Si aún no se han cargado las figuras, cargarlas de emergencia
    if (!figuresState.figures || figuresState.figures.length === 0) {
        await loadFigures();
    }
    const preloaded = window.figuresAPI?.getFigures() || [];
    const localFigures = figuresState.figures || [];
    gameState.allFigures = [...preloaded, ...localFigures];
    addDebug(`🎮 Figuras disponibles: ${gameState.allFigures.length}`);
}

async function runCountdown() {
    gameElements.countdownOverlay.classList.remove('hidden');
    
    for (let i = 3; i >= 1; i--) {
        gameElements.countdownNumber.textContent = i;
        await sleep(1000);
    }
    
    gameElements.countdownOverlay.classList.add('hidden');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function startRound() {
    gameState.currentRound++;
    gameState.roundActive = true;
    gameState.turnEnded = false;
    gameState.timeRemaining = getRoundDuration(gameState.currentRound);
    
    // Update UI
    gameElements.roundInfo.textContent = `Ronda ${gameState.currentRound} / ${gameState.totalRounds}`;
    gameElements.endTurnBtn.disabled = false;
    
    // 1. Seleccionar figura (Solo el host decide qué figura toca en esta ronda)
    if (gameState.player.isHost) {
        selectFigureForRound();
        
        // 2. Broadcast de la figura elegida a TODOS los invitados
        if (gameState.currentFigure) {
            broadcast('figure-data', {
                round: gameState.currentRound,
                figure: gameState.currentFigure
            });
        }
    }
    
    // Dibujar la figura en el canvas local
    drawFigureWithMask();
    
    // Reset player knobs
    gameState.playerLab = { L: 50, a: 0, b: 0 };
    //if (gameElements.knobL._setValue) gameElements.knobL._setValue(50);
    //if (gameElements.knobA._setValue) gameElements.knobA._setValue(0);
    //if (gameElements.knobB._setValue) gameElements.knobB._setValue(0);
    
    // Start timer
    startTimer();
    
    addDebug(`🎮 Ronda ${gameState.currentRound} iniciada - ${gameState.timeRemaining}s`);
}

function getRoundDuration(roundNum) {
    if (gameState.room.roundDurations && gameState.room.roundDurations[roundNum - 1]) {
        return gameState.room.roundDurations[roundNum - 1].duration;
    }
    return gameState.roundDuration;
}

function selectFigureForRound() {
    if (gameState.allFigures.length === 0) return;
    
    // Use selected figure if exists, otherwise random
    let figure = gameState.room.selectedFigure || gameState.allFigures[Math.floor(Math.random() * gameState.allFigures.length)];
    gameState.currentFigure = figure;
    gameState.targetRgb = figure.targetColor.rgb;
    
    // Update label
    gameElements.figureLabel.textContent = figure.name || 'Figura';
}

function drawFigureWithMask() {
    if (!gameState.currentFigure) {
        addDebug('⚠️ No hay figura actual para dibujar en el canvas');
        return;
    }
    
    const canvas = gameElements.canvas;
    const ctx = canvas.getContext('2d');
    const figure = gameState.currentFigure;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        canvas.width = 500;
        canvas.height = 500;
        ctx.clearRect(0, 0, 500, 500);
        
        // Draw original image centered (cover)
        const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
        const drawW = Math.round(img.naturalWidth * scale);
        const drawH = Math.round(img.naturalHeight * scale);
        const drawX = Math.round((canvas.width - drawW) / 2);
        const drawY = Math.round((canvas.height - drawH) / 2);
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        
        if (figure.mask) {
            const maskImg = new Image();
            maskImg.crossOrigin = 'anonymous';
            maskImg.onload = () => {
                ctx.save();
                
                if (gameState.playerRgb) {
                    // Create a proper alpha mask from the mask image
                    // The mask image has white where target color was detected
                    // We need to create an alpha mask: opaque where mask is white, transparent elsewhere
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // 1. Draw the mask image at correct position/scale
                    tempCtx.drawImage(maskImg, drawX, drawY, drawW, drawH);
                    
                    // 2. Convert to alpha mask: white becomes opaque, everything else transparent
                    const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        //const r = data[i], g = data[i+1], b = data[i+2];
                        // If pixel is white (or near white), make it opaque; else transparent
                        //const isWhite = r > 200 && g > 200 && b > 200;
                        //data[i+3] = isWhite ? 255 : 0; // Alpha channel
                        // En lugar de comprobar la blancura RGB, comprueba el canal alfa
                        const alpha = data[i+3];
                        data[i+3] = alpha > 128 ? 255 : 0;  // Opaco -> totalmente opaco, transparente -> totalmente transparente
                    }
                    tempCtx.putImageData(imageData, 0, 0);
                    
                    // 2. Fill with player's color
                    tempCtx.fillStyle = `rgb(${gameState.playerRgb.r}, ${gameState.playerRgb.g}, ${gameState.playerRgb.b})`;
                    tempCtx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // 3. Apply the alpha mask using destination-in
                    tempCtx.globalCompositeOperation = 'destination-in';
                    // The tempCanvas already has the alpha mask, just fill with color
                    tempCtx.globalCompositeOperation = 'source-over';
                    tempCtx.fillStyle = `rgb(${gameState.playerRgb.r}, ${gameState.playerRgb.g}, ${gameState.playerRgb.b})`;
                    tempCtx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Actually, simpler: just use the alpha mask as a clipping path
                    // Reset and do it properly
                    tempCtx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Redraw the alpha mask
                    tempCtx.drawImage(maskImg, drawX, drawY, drawW, drawH);
                    const imageData2 = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
                    const data2 = imageData2.data;
                    for (let i = 0; i < data2.length; i += 4) {
                        const r = data2[i], g = data2[i+1], b = data2[i+2];
                        const isWhite = r > 200 && g > 200 && b > 200;
                        data2[i+3] = isWhite ? 255 : 0;
                    }
                    tempCtx.putImageData(imageData2, 0, 0);
                    
                    // Now fill with color using the alpha mask
                    tempCtx.globalCompositeOperation = 'source-in';
                    tempCtx.fillStyle = `rgb(${gameState.playerRgb.r}, ${gameState.playerRgb.g}, ${gameState.playerRgb.b})`;
                    tempCtx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // 3. Draw the colored mask over the original image
                    ctx.globalAlpha = 0.9; //opacidad mascara de color
                    ctx.drawImage(tempCanvas, 0, 0);
                    ctx.globalAlpha = 1.0;
                } else {
                    // Fallback: draw mask in white at the correct position
                    ctx.globalAlpha = 0.9;
                    ctx.drawImage(maskImg, drawX, drawY, drawW, drawH);
                    ctx.globalAlpha = 1.0;
                }
                
                ctx.restore();
            };
            maskImg.src = figure.mask;
        }
    };
    img.onerror = () => {
        addDebug('❌ Error al cargar la imagen original de la figura');
    };
    img.src = figure.original;
}

// ========================================
// ACTUALIZACIÓN EN TIEMPO REAL DE LA MÁSCARA CON COLOR SELECCIONADO
// ========================================

function updateFigureMaskWithCurrentColor() {
    if (!gameState.currentFigure || !gameState.playerRgb) return;
    
    const canvas = gameElements.canvas;
    const ctx = canvas.getContext('2d');
    const figure = gameState.currentFigure;
    
    // Redibujar la imagen original centrada (cover)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        canvas.width = 500;
        canvas.height = 500;
        ctx.clearRect(0, 0, 500, 500);
        
        // Draw original image centered (cover) - same as drawFigureWithMask
        const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
        const drawW = Math.round(img.naturalWidth * scale);
        const drawH = Math.round(img.naturalHeight * scale);
        const drawX = Math.round((canvas.width - drawW) / 2);
        const drawY = Math.round((canvas.height - drawH) / 2);
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        
        // Dibujar la máscara con el color actual seleccionado por el jugador
        if (figure.mask && gameState.playerRgb) {
            const maskImg = new Image();
            maskImg.crossOrigin = 'anonymous';
            maskImg.onload = () => {
                // Create a proper alpha mask from the mask image
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // 1. Draw the mask image at correct position/scale
                tempCtx.drawImage(maskImg, drawX, drawY, drawW, drawH);
                
                // 2. Convert to alpha mask: white becomes opaque, everything else transparent
                const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    //const r = data[i], g = data[i+1], b = data[i+2];
                    //const isWhite = r > 200 && g > 200 && b > 200;
                    //data[i+3] = isWhite ? 255 : 0; // Alpha channel
                    // En lugar de comprobar la blancura RGB, comprueba el canal alfa
                    const alpha = data[i+3];
                    data[i+3] = alpha > 128 ? 255 : 0;  // Opaco -> totalmente opaco, transparente -> totalmente transparente
                }
                tempCtx.putImageData(imageData, 0, 0);
                
                // Now fill with color using the alpha mask
                tempCtx.globalCompositeOperation = 'source-in';
                tempCtx.fillStyle = `rgb(${gameState.playerRgb.r}, ${gameState.playerRgb.g}, ${gameState.playerRgb.b})`;
                tempCtx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw the colored mask over the original image with transparency
                ctx.globalAlpha = 0.9;  //opacidad mascara de color
                ctx.drawImage(tempCanvas, 0, 0);
                ctx.globalAlpha = 1.0;
            };
            maskImg.src = figure.mask;
        }
    };
    img.src = figure.original;
}

function startTimer() {
    updateTimerDisplay();
    gameState.timerInterval = setInterval(() => {
        gameState.timeRemaining--;
        updateTimerDisplay();
        
        if (gameState.timeRemaining <= 0) {
            endRound();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(gameState.timeRemaining / 60);
    const secs = gameState.timeRemaining % 60;
    gameElements.timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    // Warning colors
    gameElements.timer.classList.remove('warning', 'danger');
    if (gameState.timeRemaining <= 5) gameElements.timer.classList.add('danger');
    else if (gameState.timeRemaining <= 10) gameElements.timer.classList.add('warning');
}

function handleEndTurn() {
    if (!gameState.roundActive || gameState.turnEnded) return;
    gameState.turnEnded = true;
    gameElements.endTurnBtn.disabled = true;
    
    // Send player's lab to host
    sendPlayerRgb();
    
    // Calculate score locally for immediate feedback
    const score = calculateRgbSimilarity(r.rgb, gameState.targetRgb);
    addDebug(`✅ Turno terminado - Similitud: ${score}%`);
}

function sendPlayerRgb() {
    const data = {
        type: 'player-rgb', // Cambiado de lab a rgb
        playerId: gameState.player.id,
        rgb: gameState.playerRgb, // Enviamos RGB directamente
        round: gameState.currentRound
    };
    
    if (gameState.player.isHost) {
        handlePlayerRgb(data); // Función receptora para el host
    } else {
        const hostConn = gameState.connections.get(gameState.room.hostId);
        if (hostConn && hostConn.conn.open) {
            hostConn.conn.send(data);
        }
    }
}
/*
function handlePlayerLab(data) {
    if (!gameState.roundResults[data.round]) {
        gameState.roundResults[data.round] = [];
    }
    
    const playerData = {
        playerId: data.playerId,
        lab: data.lab,
        name: gameState.room.players.get(data.playerId)?.name || 'Jugador'
    };

    // 🛡️ Verificar si el jugador ya había enviado su resultado en esta ronda
    const existingIndex = gameState.roundResults[data.round].findIndex(r => r.playerId === data.playerId);
    
    if (existingIndex !== -1) {
        // Si ya existía, actualizamos su valor por si acaso (evita duplicados en la lista)
        gameState.roundResults[data.round][existingIndex] = playerData;
    } else {
        // Si no existía, lo agregamos normalmente
        gameState.roundResults[data.round].push(playerData);
    }
    
    // Si soy el host, verificar si todos ya enviaron para cerrar la ronda antes de que acabe el tiempo
    if (gameState.player.isHost) {
        const expected = gameState.room.players.size;
        const received = gameState.roundResults[data.round].length;
        if (received >= expected) {
            endRound();
        }
    }
}*/

function handlePlayerRgb(data) {
    if (!gameState.roundResults[data.round]) {
        gameState.roundResults[data.round] = [];
    }
    
    const playerData = {
        playerId: data.playerId,
        rgb: data.rgb, // Guardamos rgb
        name: gameState.room.players.get(data.playerId)?.name || 'Jugador'
    };

    const existingIndex = gameState.roundResults[data.round].findIndex(r => r.playerId === data.playerId);
    if (existingIndex !== -1) {
        gameState.roundResults[data.round][existingIndex] = playerData;
    } else {
        gameState.roundResults[data.round].push(playerData);
    }
    
    if (gameState.player.isHost) {
        const expected = gameState.room.players.size;
        const received = gameState.roundResults[data.round].length;
        if (received >= expected) {
            endRound();
        }
    }
}

function endRound() {
    if (!gameState.roundActive) return;
    gameState.roundActive = false;
    clearInterval(gameState.timerInterval);
    gameElements.endTurnBtn.disabled = true;
    
    // 💡 1. Si el tiempo se agotó y el jugador no había dado a "Terminar turno", enviarlo automáticamente con su valor actual
    if (!gameState.turnEnded) {
        gameState.turnEnded = true;
        sendPlayerRgb();
    }
    
    // 🛡️ 2. Si somos el host, asegurarnos de que ningún jugador se quede sin registrar en la ronda
    if (gameState.player.isHost) {
        if (!gameState.roundResults[gameState.currentRound]) {
            gameState.roundResults[gameState.currentRound] = [];
        }
        
        gameState.room.players.forEach((p, id) => {
            const alreadySubmitted = gameState.roundResults[gameState.currentRound].some(r => r.playerId === id);
            if (!alreadySubmitted) {
                gameState.roundResults[gameState.currentRound].push({
                    playerId: id,
                    rgb: { r: 128, g: 128, b: 128 }, // 👈 Cambiar 'lab: { ... }' por 'rgb: { r: 128, g: 128, b: 128 }'
                    name: p.name || 'Jugador'
                });
            }
        });
    }
    
    // Calculate scores for all players
    calculateRoundScores();
    
    // Broadcast results to all players
    broadcastRoundResults();
    
    // Show results locally
    showRoundResults();
    
    // Auto-advance after 5 seconds
    gameState.countdownInterval = setTimeout(() => {
        handleNextRoundAuto();
    }, 5000);
    
    addDebug(`🏁 Ronda ${gameState.currentRound} terminada`);
}

function broadcastRoundResults() {
    const results = gameState.roundResults[gameState.currentRound] || [];
    const scoresData = {};
    Object.entries(gameState.scores).forEach(([id, data]) => {
        scoresData[id] = { total: data.total, roundScores: [...data.roundScores] };
    });
    
    broadcast('round-results', {
        round: gameState.currentRound,
        results: results.map(r => ({
            playerId: r.playerId,
            name: r.name,
            lab: r.lab,
            score: r.score,
            baseScore: r.baseScore
        })),
        scores: scoresData,
        targetLab: gameState.targetLab,
        currentFigure: gameState.currentFigure ? {
            id: gameState.currentFigure.id,
            name: gameState.currentFigure.name,
            original: gameState.currentFigure.original,
            mask: gameState.currentFigure.mask,
            targetColor: gameState.currentFigure.targetColor
        } : null
    });
}

function calculateRgbSimilarity(playerRgb, targetRgb) {
    const dr = playerRgb.r - targetRgb.r;
    const dg = playerRgb.g - targetRgb.g;
    const db = playerRgb.b - targetRgb.b;
    const distance = Math.sqrt(dr*dr + dg*dg + db*db);
    const maxDist = Math.sqrt(255*255 * 3); // Distancia máxima en espacio RGB
    const similarity = Math.max(0, Math.min(100, 100 - (distance / maxDist) * 100));
    return Math.round(similarity);
}

function calculateRoundScores() {
    const results = gameState.roundResults[gameState.currentRound] || [];
    const timeBonusActive = gameState.room.config?.timeBonus === 'yes' || 
                           (gameState.room.config?.timeBonus === 'sometimes' && Math.random() < 0.5);
    
    results.forEach(r => {
        // r.rgb ya contiene los valores correctos enviados por el usuario
        const baseScore = calculateRgbSimilarity(r.rgb, gameState.targetRgb);
        let finalScore = baseScore;
        
        if (timeBonusActive && r.timeRemaining !== undefined) {
            const ratio = Math.max(0, Math.min(1, r.timeRemaining / getRoundDuration(gameState.currentRound)));
            const bonusPercent = ratio * 0.2;
            finalScore = Math.round(baseScore * (1 + bonusPercent));
        }
        
        if (gameState.scores[r.playerId]) {
            gameState.scores[r.playerId].roundScores.push(finalScore);
            gameState.scores[r.playerId].total += finalScore;
        }
        
        r.score = finalScore;
        r.baseScore = baseScore;
    });
    
    results.sort((a, b) => b.score - a.score);
}

function showRoundResults() {
    gameElements.resultsRoundNum.textContent = gameState.currentRound;
    gameElements.resultsList.innerHTML = '';
    gameElements.resultsTotal.innerHTML = '';
    
    const results = gameState.roundResults[gameState.currentRound] || [];
    
    results.forEach((r, index) => {
        const isWinner = index === 0;
        const isCurrentPlayer = r.playerId === gameState.player.id;
        
        const item = document.createElement('div');
        item.className = `result-item ${isWinner ? 'winner' : ''} ${isCurrentPlayer ? 'current-player' : ''}`;
        item.innerHTML = `
            <div class="result-info">
                <div class="result-avatar">${gameState.room.players.get(r.playerId)?.avatar || '😀'}</div>
                <span class="result-name">${r.name}${isCurrentPlayer ? ' (Tú)' : ''}</span>
                ${isWinner ? '<span class="result-badge">👑 Ganador</span>' : ''}
            </div>
            <span class="result-score">${r.score}%</span>
        `;
        gameElements.resultsList.appendChild(item);
    });
    
    // Show totals
    let totalHtml = 'Totales: ';
    Object.entries(gameState.scores).forEach(([id, data]) => {
        const p = gameState.room.players.get(id);
        totalHtml += `<span style="margin: 0 0.5rem;">${p?.name || 'Jugador'}: ${data.total}</span>`;
    });
    gameElements.resultsTotal.innerHTML = totalHtml;
    
    gameElements.roundResultsOverlay.classList.remove('hidden');
}

 /*function handleNextRound() {
    clearTimeout(gameState.countdownInterval);
    gameElements.roundResultsOverlay.classList.add('hidden');
    
    if (gameState.currentRound >= gameState.totalRounds) {
        endGame();
    } else {
        startRound();
    }
} */

function handleNextRoundAuto() {
    clearTimeout(gameState.countdownInterval);
    gameElements.roundResultsOverlay.classList.add('hidden');
    
    if (gameState.currentRound >= gameState.totalRounds) {
        endGame();
    } else {
        // Host starts next round and broadcasts
        if (gameState.player.isHost) {
            startRound();
            broadcast('start-round', { round: gameState.currentRound });
        }
    }
}

function endGame() {
    // Calculate final winner
    const scores = Object.entries(gameState.scores)
        .map(([id, data]) => ({
            id,
            name: gameState.room.players.get(id)?.name || 'Jugador',
            avatar: gameState.room.players.get(id)?.avatar || '😀',
            total: data.total
        }))
        .sort((a, b) => b.total - a.total);
    
    const winner = scores[0];
    
    // Build final scores display
    gameElements.finalScores.innerHTML = '';
    scores.forEach((s, index) => {
        const item = document.createElement('div');
        item.className = `final-score-item ${index === 0 ? 'winner' : ''}`;
        item.innerHTML = `
            <span class="final-rank">${index + 1}</span>
            <div class="final-info">
                <div class="final-avatar">${s.avatar}</div>
                <span class="final-name">${s.name}</span>
            </div>
            <span class="final-score">${s.total}</span>
        `;
        gameElements.finalScores.appendChild(item);
    });
    
    gameElements.winnerAnnouncement.textContent = `🏆 ¡${winner.name} ha ganado con ${winner.total} puntos!`;
    
    gameElements.roundResultsOverlay.classList.add('hidden');
    gameElements.gameEndOverlay.classList.remove('hidden');
    
    // Broadcast final scores to all players
    broadcast('game-results', {
        scores: scores.map(s => ({
            id: s.id,
            name: s.name,
            avatar: s.avatar,
            total: s.total
        })),
        winner: winner.id
    });
    
    addDebug(`🏆 Partida finalizada - Ganador: ${winner.name} (${winner.total} pts)`);
}

function handleGameExit() {
    if (gameState.player.isHost) {
        // Host ends game immediately
        broadcast('game-ended', {});
        showScreen('waiting-host-screen');
    } else {
        // Guest leaves game
        showScreen('guest-waiting-screen');
    }
    cleanupGame();
}

function cleanupGame() {
    clearInterval(gameState.timerInterval);
    clearInterval(gameState.countdownInterval);
    gameState.roundActive = false;
    gameState.turnEnded = false;
}

// Handle incoming game messages
function handleGameMessage(from, data) {
    switch (data.type) {
        case 'player-rgb':
            handlePlayerRgb(data);
            break;
        case 'start-round':
            if (!gameState.player.isHost) startRound();
            break;
        case 'figure-data':
            handleFigureData(data);
            break;
        case 'end-round':
            if (!gameState.player.isHost) endRound();
            break;
        case 'game-ended':
            if (gameState.player.isHost) {
                showScreen('waiting-host-screen');
            } else {
                showScreen('guest-waiting-screen');
            }
            cleanupGame();
            break;
        case 'round-results':
            handleRoundResults(data);
            break;
        case 'game-results':
            handleGameResults(data);
            break;
        case 'start-game':
            if (data.config) {
                gameState.room.config = data.config;
                gameState.room.roundDurations = data.roundDurations;
                gameState.room.totalRounds = data.totalRounds;
                gameState.room.baseDuration = data.baseDuration;
            }
            startGame();
            break;
    }
}

function handleFigureData(data) {
    if (data.figure) {
        gameState.currentFigure = data.figure;
        gameState.targetLab = data.figure.targetColor.lab; // Asegurar que apunte al lab correcto
        
        // Actualizar el título/etiqueta con el nombre de la figura para el invitado
        if (gameElements.figureLabel) {
            gameElements.figureLabel.textContent = data.figure.name || 'Figura';
        }
        
        // Dibujar la imagen recibida en el canvas del invitado
        drawFigureWithMask();
        addDebug(`🖼️ Figura recibida y cargada: ${data.figure.name}`);
    }
}

function handleRoundResults(data) {
    // Update local state with broadcasted results
    gameState.roundResults[data.round] = data.results;
    
    // Update scores
    Object.entries(data.scores).forEach(([id, scoreData]) => {
        if (!gameState.scores[id]) gameState.scores[id] = { roundScores: [], total: 0 };
        gameState.scores[id].total = scoreData.total;
        gameState.scores[id].roundScores = scoreData.roundScores;
    });
    
    gameState.targetLab = data.targetLab;
    
    // If we have figure data, update current figure
    if (data.currentFigure) {
        gameState.currentFigure = data.currentFigure;
    }
    
    // Show results
    showRoundResults();
    
    // Auto-advance after 5 seconds (guest side)
    gameState.countdownInterval = setTimeout(() => {
        handleNextRoundAuto();
    }, 5000);
}

function handleGameResults(data) {
    // Build final scores display
    gameElements.finalScores.innerHTML = '';
    data.scores.forEach((s, index) => {
        const item = document.createElement('div');
        item.className = `final-score-item ${index === 0 ? 'winner' : ''}`;
        item.innerHTML = `
            <span class="final-rank">${index + 1}</span>
            <div class="final-info">
                <div class="final-avatar">${s.avatar}</div>
                <span class="final-name">${s.name}</span>
            </div>
            <span class="final-score">${s.total}</span>
        `;
        gameElements.finalScores.appendChild(item);
    });
    
    const winner = data.scores.find(s => s.id === data.winner);
    gameElements.winnerAnnouncement.textContent = winner 
        ? `🏆 ¡${winner.name} ha ganado con ${winner.total} puntos!`
        : '🏆 Partida finalizada';
    
    gameElements.roundResultsOverlay.classList.add('hidden');
    gameElements.gameEndOverlay.classList.remove('hidden');
}


// Expose game API
window.gameAPI = {
    startGame,
    handleGameMessage
};