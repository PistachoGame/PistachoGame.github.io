// ========================================
// CONFIGURACIÓN Y CONSTANTES
// ========================================

const AVATARS = [
    '😀', '😎', '🤖', '👾', '🎮', '🎨',
    '🌈', '⭐', '🌟', '💎', '🔮', '🎭',
    '🎪', '🚀', '🛸', '🤿', '🏄', '🧙',
    '🧝', '🦸', '🦹', '🧞', '🧚', '🧙‍♀️'
];

const STORAGE_KEYS = {
    PLAYER_NAME: 'colorGame_playerName',
    PLAYER_AVATAR: 'colorGame_playerAvatar',
    PLAYER_ID: 'colorGame_playerId'
};

// Estado global del juego
const gameState = {
    player: {
        id: null,
        name: '',
        avatar: AVATARS[0],
        isHost: false
    },
    peer: null,
    connections: new Map(),
    room: {
        code: null,
        hostId: null,
        players: new Map()
    },
    currentScreen: 'home'
};

// Elementos DOM
const elements = {};

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    setupEventListeners();
    loadSavedPlayerData();
    renderAvatars();
    updateCreateRoomButton();
    
    // Verificar parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    const hostId = urlParams.get('host');
    
    if (roomCode && hostId) {
        // Llegada por enlace de invitación completo
        showJoinModal(roomCode.toUpperCase(), hostId);
    } else if (roomCode) {
        // Solo código (modo legacy - pedir host ID)
        showJoinModal(roomCode.toUpperCase());
    }
});

function cacheElements() {
    elements.homeScreen = document.getElementById('home-screen');
    elements.waitingScreen = document.getElementById('waiting-screen');
    elements.guestWaitingScreen = document.getElementById('guest-waiting-screen');
    
    elements.avatarGrid = document.getElementById('avatar-grid');
    elements.playerNameInput = document.getElementById('player-name');
    elements.createRoomBtn = document.getElementById('create-room-btn');
    elements.joinRoomBtn = document.getElementById('join-room-btn');
    
    elements.joinModal = document.getElementById('join-modal');
    elements.roomCodeInput = document.getElementById('room-code-input');
    elements.cancelJoinBtn = document.getElementById('cancel-join-btn');
    elements.confirmJoinBtn = document.getElementById('confirm-join-btn');
    
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.roomCodeDisplay = document.getElementById('room-code');
    elements.copyLinkBtn = document.getElementById('copy-link-btn');
    elements.adPlaceholder = document.getElementById('ad-placeholder');
    elements.playersList = document.getElementById('players-list');
    elements.startGameBtn = document.getElementById('start-game-btn');
    elements.minPlayersMsg = document.querySelector('.min-players-msg');
}

function setupEventListeners() {
    elements.playerNameInput.addEventListener('input', updateCreateRoomButton);
    elements.createRoomBtn.addEventListener('click', handleCreateRoom);
    elements.joinRoomBtn.addEventListener('click', () => showJoinModal());
    
    elements.cancelJoinBtn.addEventListener('click', hideJoinModal);
    elements.confirmJoinBtn.addEventListener('click', handleJoinRoom);
    elements.roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleJoinRoom();
    });
    elements.joinModal.addEventListener('click', (e) => {
        if (e.target === elements.joinModal) hideJoinModal();
    });
    
    elements.copyLinkBtn.addEventListener('click', copyRoomLink);
    elements.startGameBtn.addEventListener('click', handleStartGame);
    elements.settingsBtn.addEventListener('click', handleSettings);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.joinModal.classList.contains('hidden')) {
            hideJoinModal();
        }
    });
}

// ========================================
// GESTIÓN DE PANTALLAS
// ========================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });
    const screen = document.getElementById(screenId);
    screen.classList.remove('hidden');
    screen.classList.add('active');
    gameState.currentScreen = screenId;
}

// ========================================
// AVATARES
// ========================================

function renderAvatars() {
    elements.avatarGrid.innerHTML = '';
    AVATARS.forEach((avatar, index) => {
        const btn = document.createElement('button');
        btn.className = 'avatar-option';
        btn.textContent = avatar;
        btn.dataset.index = index;
        btn.addEventListener('click', () => selectAvatar(index));
        if (index === 0) btn.classList.add('selected');
        elements.avatarGrid.appendChild(btn);
    });
}

function selectAvatar(index) {
    gameState.player.avatar = AVATARS[index];
    document.querySelectorAll('.avatar-option').forEach((btn, i) => {
        btn.classList.toggle('selected', i === index);
    });
    savePlayerData();
}

function loadSavedPlayerData() {
    const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    const savedAvatar = localStorage.getItem(STORAGE_KEYS.PLAYER_AVATAR);
    
    if (savedName) {
        gameState.player.name = savedName;
        elements.playerNameInput.value = savedName;
    }
    
    if (savedAvatar && AVATARS.includes(savedAvatar)) {
        gameState.player.avatar = savedAvatar;
        const index = AVATARS.indexOf(savedAvatar);
        document.querySelectorAll('.avatar-option').forEach((btn, i) => {
            btn.classList.toggle('selected', i === index);
        });
    }
}

function savePlayerData() {
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, gameState.player.name);
    localStorage.setItem(STORAGE_KEYS.PLAYER_AVATAR, gameState.player.avatar);
}

function updateCreateRoomButton() {
    const name = elements.playerNameInput.value.trim();
    gameState.player.name = name;
    elements.createRoomBtn.disabled = name.length === 0;
    if (name) savePlayerData();
}

// ========================================
// PEER.JS Y CONEXIONES
// ========================================

function initPeerJS(customId = null) {
    return new Promise((resolve, reject) => {
        const peerOptions = {
            host: '0.peerjs.com',
            port: 443,
            secure: true,
            path: '/',
            debug: 2
        };
        
        if (customId) {
            peerOptions.config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        }
        
        gameState.peer = new Peer(customId, peerOptions);
        
        gameState.peer.on('open', (id) => {
            console.log('PeerJS conectado, ID:', id);
            gameState.player.id = id;
            localStorage.setItem(STORAGE_KEYS.PLAYER_ID, id);
            resolve(id);
        });
        
        gameState.peer.on('error', (err) => {
            console.error('Error PeerJS:', err);
            if (err.type === 'unavailable-id' && customId) {
                // ID personalizado no disponible, usar aleatorio
                console.log('ID personalizado no disponible, usando aleatorio...');
                initPeerJS().then(resolve).catch(reject);
            } else if (err.type === 'unavailable-id') {
                initPeerJS().then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
        
        gameState.peer.on('connection', (conn) => {
            handleIncomingConnection(conn);
        });
        
        gameState.peer.on('disconnected', () => {
            console.log('PeerJS desconectado, reconectando...');
            gameState.peer.reconnect();
        });
        
        gameState.peer.on('close', () => {
            console.log('PeerJS cerrado');
        });
    });
}

function handleIncomingConnection(conn) {
    console.log('Conexión entrante de:', conn.peer);
    
    conn.on('open', () => {
        sendRoomInfo(conn);
        gameState.connections.set(conn.peer, { conn, playerInfo: null });
        conn.on('data', (data) => handlePeerMessage(conn.peer, data));
        conn.on('close', () => handlePeerDisconnect(conn.peer));
    });
    
    conn.on('error', (err) => {
        console.error('Error en conexión:', err);
    });
}

function connectToHost(hostId) {
    return new Promise((resolve, reject) => {
        const conn = gameState.peer.connect(hostId, { reliable: true });
        
        conn.on('open', () => {
            console.log('Conectado al host:', hostId);
            gameState.connections.set(hostId, { conn, playerInfo: null });
            conn.on('data', (data) => handlePeerMessage(hostId, data));
            conn.on('close', () => handlePeerDisconnect(hostId));
            resolve(conn);
        });
        
        conn.on('error', (err) => {
            console.error('Error conectando al host:', err);
            reject(err);
        });
        
        // Timeout de conexión
        setTimeout(() => {
            if (!conn.open) {
                reject(new Error('Timeout de conexión'));
            }
        }, 15000);
    });
}

// ========================================
// MANEJO DE MENSAJES P2P
// ========================================

function handlePeerMessage(senderId, data) {
    console.log('Mensaje recibido de', senderId, ':', data);
    
    switch (data.type) {
        case 'room-info':
            handleRoomInfo(data);
            break;
        case 'player-joined':
            handlePlayerJoined(data);
            break;
        case 'player-left':
            handlePlayerLeft(data);
            break;
        case 'player-info':
            handlePlayerInfo(senderId, data);
            break;
        case 'start-game':
            handleStartGameSignal();
            break;
        case 'settings':
            handleSettingsSignal(data);
            break;
    }
}

function handleRoomInfo(data) {
    gameState.room.code = data.roomCode;
    gameState.room.hostId = data.hostId;
    gameState.room.players.clear();
    
    gameState.room.players.set(data.hostId, data.hostInfo);
    data.players.forEach(p => {
        gameState.room.players.set(p.id, p);
    });
    
    if (gameState.player.isHost) {
        updatePlayersList();
    } else {
        showScreen('guest-waiting-screen');
    }
}

function handlePlayerJoined(data) {
    gameState.room.players.set(data.player.id, data.player);
    if (gameState.player.isHost) {
        updatePlayersList();
    }
}

function handlePlayerLeft(data) {
    gameState.room.players.delete(data.playerId);
    gameState.connections.delete(data.playerId);
    if (gameState.player.isHost) {
        updatePlayersList();
    }
}

function handlePlayerInfo(senderId, data) {
    const connData = gameState.connections.get(senderId);
    if (connData) {
        connData.playerInfo = data;
        gameState.room.players.set(senderId, data);
        if (gameState.player.isHost) {
            updatePlayersList();
        }
    }
}

function handleStartGameSignal() {
    console.log('¡Iniciando partida!');
    // TODO: Transición a pantalla de juego
    alert('Partida iniciada - Próximamente pantalla de juego');
}

function handleSettingsSignal(data) {
    console.log('Configuración recibida:', data);
}

// ========================================
// ENVIAR MENSAJES
// ========================================

function broadcastToAll(type, data) {
    const message = { type, ...data };
    gameState.connections.forEach(({ conn }) => {
        if (conn.open) {
            conn.send(message);
        }
    });
}

function sendToPeer(peerId, type, data) {
    const connData = gameState.connections.get(peerId);
    if (connData && connData.conn.open) {
        connData.conn.send({ type, ...data });
    }
}

function sendRoomInfo(conn) {
    const players = [];
    gameState.room.players.forEach((player, id) => {
        if (id !== gameState.player.id) {
            players.push(player);
        }
    });
    
    conn.send({
        type: 'room-info',
        roomCode: gameState.room.code,
        hostId: gameState.player.id,
        hostInfo: {
            id: gameState.player.id,
            name: gameState.player.name,
            avatar: gameState.player.avatar,
            isHost: true
        },
        players
    });
}

function sendPlayerInfo(targetId = null) {
    const playerInfo = {
        id: gameState.player.id,
        name: gameState.player.name,
        avatar: gameState.player.avatar,
        isHost: false
    };
    
    if (targetId) {
        sendToPeer(targetId, 'player-info', playerInfo);
    } else {
        broadcastToAll('player-info', playerInfo);
    }
}

// ========================================
// CREAR SALA (HOST)
// ========================================

async function handleCreateRoom() {
    const name = elements.playerNameInput.value.trim();
    if (!name) {
        alert('Por favor ingresa tu nombre');
        return;
    }
    
    gameState.player.name = name;
    gameState.player.isHost = true;
    savePlayerData();
    
    elements.createRoomBtn.disabled = true;
    elements.createRoomBtn.innerHTML = '<span class="btn-icon">⏳</span> Creando sala...';
    
    try {
        // Generar código de sala legible
        gameState.room.code = generateRoomCode();
        
        // Iniciar PeerJS (ID aleatorio del servidor cloud)
        await initPeerJS();
        
        // El hostId es el ID completo de PeerJS
        gameState.room.hostId = gameState.player.id;
        
        // Añadir host a la lista
        gameState.room.players.set(gameState.player.id, {
            id: gameState.player.id,
            name: gameState.player.name,
            avatar: gameState.player.avatar,
            isHost: true
        });
        
        showScreen('waiting-screen');
        elements.roomCodeDisplay.textContent = gameState.room.code;
        updatePlayersList();
        updateStartButton();
        
    } catch (error) {
        console.error('Error creando sala:', error);
        alert('Error al crear la sala. Inténtalo de nuevo.');
        elements.createRoomBtn.disabled = false;
        elements.createRoomBtn.innerHTML = '<span class="btn-icon">➕</span> Crear Sala';
    }
}

// ========================================
// UNIRSE A SALA (INVITADO)
// ========================================

function showJoinModal(prefillCode = '', prefillHostId = '') {
    elements.roomCodeInput.value = prefillCode;
    elements.roomCodeInput.dataset.hostId = prefillHostId || '';
    elements.joinModal.classList.remove('hidden');
    setTimeout(() => elements.roomCodeInput.focus(), 100);
}

function hideJoinModal() {
    elements.joinModal.classList.add('hidden');
    elements.roomCodeInput.value = '';
    elements.roomCodeInput.dataset.hostId = '';
}

async function handleJoinRoom() {
    const roomCode = elements.roomCodeInput.value.trim().toUpperCase();
    const hostId = elements.roomCodeInput.dataset.hostId || '';
    
    if (roomCode.length !== 6) {
        alert('El código debe tener 6 caracteres');
        return;
    }
    
    const name = elements.playerNameInput.value.trim();
    if (!name) {
        alert('Por favor ingresa tu nombre primero');
        return;
    }
    
    if (!hostId) {
        alert('Falta el ID del host. Usa el enlace completo de invitación.');
        return;
    }
    
    gameState.player.name = name;
    gameState.player.isHost = false;
    savePlayerData();
    
    hideJoinModal();
    elements.joinRoomBtn.disabled = true;
    elements.joinRoomBtn.innerHTML = '<span class="btn-icon">⏳</span> Conectando...';
    
    try {
        await initPeerJS();
        await connectToHost(hostId);
        sendPlayerInfo(hostId);
        showScreen('guest-waiting-screen');
        
    } catch (error) {
        console.error('Error uniéndose a sala:', error);
        alert('No se pudo conectar a la sala. Verifica que el host esté en la sala de espera y el enlace sea correcto.');
        elements.joinRoomBtn.disabled = false;
        elements.joinRoomBtn.innerHTML = '<span class="btn-icon">🔗</span> Unirse a Sala';
    }
}

// ========================================
// PANTALLA DE ESPERA (HOST)
// ========================================

function updatePlayersList() {
    elements.playersList.innerHTML = '';
    
    gameState.room.players.forEach((player, id) => {
        const avatarEl = document.createElement('div');
        avatarEl.className = 'player-avatar' + (player.isHost ? ' host' : '');
        avatarEl.textContent = player.avatar;
        avatarEl.title = player.name + (player.isHost ? ' (Anfitrión)' : '');
        
        const nameEl = document.createElement('span');
        nameEl.className = 'player-avatar-name';
        nameEl.textContent = player.name;
        avatarEl.appendChild(nameEl);
        
        elements.playersList.appendChild(avatarEl);
    });
    
    updateStartButton();
}

function updateStartButton() {
    const playerCount = gameState.room.players.size;
    elements.startGameBtn.disabled = playerCount < 2;
    elements.minPlayersMsg.style.display = playerCount < 2 ? 'block' : 'none';
    elements.minPlayersMsg.textContent = playerCount < 2 
        ? `Se necesitan al menos 2 jugadores (${playerCount}/2)`
        : '';
}

function copyRoomLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    const roomUrl = `${baseUrl}?room=${gameState.room.code}&host=${gameState.player.id}`;
    
    navigator.clipboard.writeText(roomUrl).then(() => {
        const originalText = elements.copyLinkBtn.textContent;
        elements.copyLinkBtn.textContent = '✅';
        setTimeout(() => {
            elements.copyLinkBtn.textContent = originalText;
        }, 1500);
    }).catch(() => {
        prompt('Copia este enlace:', roomUrl);
    });
}

function handleSettings() {
    alert('Configuración - Próximamente');
}

function handleStartGame() {
    if (gameState.room.players.size < 2) return;
    
    broadcastToAll('start-game', {});
    console.log('Iniciando juego con', gameState.room.players.size, 'jugadores');
    alert('¡Partida iniciada! Próximamente: pantalla de juego');
}

function handlePeerDisconnect(peerId) {
    console.log('Jugador desconectado:', peerId);
    gameState.connections.delete(peerId);
    gameState.room.players.delete(peerId);
    
    if (gameState.player.isHost) {
        updatePlayersList();
    }
}

// ========================================
// UTILIDADES
// ========================================

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Debug
window.gameState = gameState;
window.debug = {
    getState: () => gameState,
    getConnections: () => gameState.connections,
    getPlayers: () => Array.from(gameState.room.players.values())
};