let currentUser = null;
let currentChatPartner = null;
let conversations = [];
let messageSubscription = null;
let isSendingMessage = false;

let presenceInterval = null;
let statusRefreshInterval = null;

async function updateMyLastSeen() {

    if (!currentUser || !window.supabaseClient) return;

    const { error } = await window.supabaseClient
        .from('profiles')
        .update({
            last_seen: new Date().toISOString()
        })
        .eq('id', currentUser.id);

    if (error) {
        console.error('❌ Erreur mise à jour last_seen :', error);
    }
}

// Vérifier si un profil est en ligne
function isProfileOnline(profile) {

    if (!profile || !profile.last_seen) {
        return false;
    }

    const lastSeen = new Date(profile.last_seen).getTime();
    const now = Date.now();

    // 🟢 Moins de 2 minutes = en ligne
    return (now - lastSeen) < 2 * 60 * 1000;
}

// Démarrer la présence
function startPresence() {

    // Première mise à jour immédiatement
    updateMyLastSeen();

    // Éviter plusieurs intervalles
    if (presenceInterval) {
        clearInterval(presenceInterval);
    }

    presenceInterval = setInterval(() => {
        updateMyLastSeen();
    }, 30 * 1000);

    // Quand l'utilisateur revient sur la page
    document.addEventListener('visibilitychange', () => {

        if (!document.hidden) {
            updateMyLastSeen();
            refreshConversationStatuses();
        }

    });

    // Quand la fenêtre reprend le focus
    window.addEventListener('focus', () => {
        updateMyLastSeen();
        refreshConversationStatuses();
    });
}

function getDefaultAvatar() {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
            <rect width="150" height="150" fill="#e5e7eb"/>
            <circle cx="75" cy="58" r="28" fill="#9ca3af"/>
            <path d="M30 130c5-28 22-42 45-42s40 14 45 42" fill="#9ca3af"/>
        </svg>
    `);
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', async () => {

    console.log('🚀 messages.js démarré');

        // 🌍 Attendre le chargement des traductions
    if (window.i18nReady) {
        await window.i18nReady;
    }

   if (!window.supabaseClient) {
    console.error('❌ Client Supabase introuvable');
    showAlert(
        t(
            'messages.supabase_unavailable',
            "Erreur : Supabase n'est pas disponible"
        ),
        'error'
    );
    return;
}

    console.log('✅ Client Supabase détecté');

    // ===== AUTO-RESIZE DE LA ZONE DE MESSAGE =====
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        function resizeInput() {
            messageInput.style.height = 'auto';
            const newHeight = Math.min(messageInput.scrollHeight, 200);
            messageInput.style.height = newHeight + 'px';
        }

        messageInput.addEventListener('input', resizeInput);
        resizeInput();
        
        // ===== GÉRER LA TOUCHE ENTRÉE =====
        messageInput.addEventListener('keydown', handleKeyPress);
    }

  currentUser = await requireAuth();
if (!currentUser) return;

console.log('👤 Utilisateur connecté :', currentUser.id);

// 🟢 Démarrer le système de présence
startPresence();

initializeCallChannel();

    // Charger les conversations
    await loadConversations();

    // Vérifier s'il y a un partenaire dans les paramètres d'URL
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user');
    const userName = params.get('name');

    if (userId) {
        await selectConversation(userId, userName);
    }

    // Événement de déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // ===== BOUTON D'ENVOI =====
    const sendButton = document.querySelector('.send-message-btn');
    if (messageInput && sendButton) {
        function updateSendButton() {
            if (messageInput.value.trim() !== '') {
                sendButton.classList.add('active');
            } else {
                sendButton.classList.remove('active');
            }
        }

        messageInput.addEventListener('input', updateSendButton);
        updateSendButton();
        
        sendButton.addEventListener('click', sendMessage);
    }
});

// ===== BADGE PROFIL CERTIFIÉ =====
function getVerifiedBadge(isVerified) {
    if (!isVerified) return '';

    return `
        <span
            class="verified-badge-message"
            title="Profil certifié"
            aria-label="Profil certifié"
        >
            <svg
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
            >
                <path
                    fill="#1877F2"
                    d="M12 1.5 L14.2 3.1 L16.9 2.9 L18.1 5.3
                    L20.5 6.5 L20.3 9.2 L21.9 11.4 L20.3 13.6
                    L20.5 16.3 L18.1 17.5 L16.9 19.9 L14.2 19.7
                    L12 21.5 L9.8 19.7 L7.1 19.9 L5.9 17.5
                    L3.5 16.3 L3.7 13.6 L2.1 11.4 L3.7 9.2
                    L3.5 6.5 L5.9 5.3 L7.1 2.9 L9.8 3.1 Z"
                />
                <path
                    d="M7.2 11.5 L10.2 14.5 L16.8 7.9"
                    fill="none"
                    stroke="#fff"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </span>
    `;
}

// ===== CHARGER LES CONVERSATIONS =====
async function loadConversations() {
    try {
        const client = window.supabaseClient;

        // Récupérer les messages envoyés
        const { data: sent, error: sentError } = await client
            .from('messages')
            .select('receiver_id, created_at')
            .eq('sender_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (sentError) {
            console.error('❌ Erreur messages envoyés:', sentError);
            throw sentError;
        }

        // Récupérer les messages reçus
        const { data: received, error: receivedError } = await client
            .from('messages')
            .select('sender_id, created_at')
            .eq('receiver_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (receivedError) {
            console.error('❌ Erreur messages reçus:', receivedError);
            throw receivedError;
        }

        // Récupérer les IDs des partenaires
        const partnerIds = new Set();

        if (sent) {
            sent.forEach(msg => {
                if (msg.receiver_id) {
                    partnerIds.add(msg.receiver_id);
                }
            });
        }

        if (received) {
            received.forEach(msg => {
                if (msg.sender_id) {
                    partnerIds.add(msg.sender_id);
                }
            });
        }
 if (partnerIds.size === 0) {
    document.getElementById('conversationsList').innerHTML =
        `<p style="padding: 1rem; text-align: center; color: var(--text-color);">
            ${t(
                'messages.no_conversations',
                'Aucune conversation pour le moment.'
            )}
        </p>`;
    return;
}

        // Récupérer les profils des partenaires
        const { data: profiles, error: profilesError } = await client
            .from('profiles')
           .select('id, first_name, photo_url, is_verified, last_seen')
            .in('id', Array.from(partnerIds));

        if (profilesError) {
            console.error('❌ Erreur profils:', profilesError);
            throw profilesError;
        }

        if (profiles) {
            const conversationsList = document.getElementById('conversationsList');
            conversationsList.innerHTML = '';

            for (const profile of profiles) {
                // Récupérer le dernier message
                const { data: lastMessages, error: lastMessageError } = await client
                    .from('messages')
                    .select('content, created_at')
                    .or(
                        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${currentUser.id})`
                    )
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (lastMessageError) {
                    console.error('❌ Erreur dernier message:', lastMessageError);
                }

                const lastMessage = lastMessages && lastMessages.length > 0 ? lastMessages[0] : null;
                const conversationItem = document.createElement('div');
                conversationItem.className = 'conversation-item';
                conversationItem.onclick = () => selectConversation(profile.id, profile.first_name);

                const photoUrl = profile.photo_url || getDefaultAvatar();
                const preview = lastMessage
                    ? lastMessage.content.substring(0, 30) + (lastMessage.content.length > 30 ? '...' : '')
                    : 'Pas de message';

                conversationItem.innerHTML = `
                    <img
                        src="${photoUrl}"
                        alt="${profile.first_name}"
                        class="conversation-avatar"
                        onerror="this.src='${getDefaultAvatar()}'"
                    >
                    <div class="conversation-info">
                        <div class="conversation-name">
                            ${escapeHtml(profile.first_name)}
                            ${getVerifiedBadge(profile.is_verified)}
                        </div>
                        <div class="conversation-preview">
                            ${escapeHtml(preview)}
                        </div>
                    </div>
                `;

                conversationsList.appendChild(conversationItem);
            }
        }

    } catch (error) {
        console.error('❌ Erreur loadConversations:', error);
        showAlert('Erreur lors du chargement des conversations', 'error');
    }
}

// ===== SÉLECTIONNER UNE CONVERSATION =====
async function selectConversation(partnerId, partnerName) {
    currentChatPartner = partnerId;

    // Marquer l'item actif
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });

    const conversationItems = document.querySelectorAll('.conversation-item');
    conversationItems.forEach(item => {
        if (item.textContent.includes(partnerName)) {
            item.classList.add('active');
        }
    });

    // Afficher la zone de chat
    document.getElementById('chatContainer').style.display = 'none';
    document.getElementById('chatWindow').style.display = 'flex';

    // ===== RÉCUPÉRER LE PROFIL DU PARTENAIRE =====
    const { data: partnerProfile, error } = await window.supabaseClient
        .from('profiles')
      .select('id, first_name, photo_url, is_verified, last_seen')
        .eq('id', partnerId)
        .single();

    if (error || !partnerProfile) {
        console.error('❌ Erreur profil partenaire:', error);
        document.getElementById('chatPartnerName').textContent = partnerName;
    } else {
     const online = isProfileOnline(partnerProfile);

document.getElementById('chatPartnerName').innerHTML = `
    <span class="chat-partner-name-with-status">

        <span
            class="online-status-dot ${online ? 'online' : 'offline'}"
            id="chatPartnerStatusDot"
            title="${online ? 'En ligne' : 'Hors ligne'}">
        </span>

        <span>
            ${escapeHtml(partnerProfile.first_name)}
            ${getVerifiedBadge(partnerProfile.is_verified)}
        </span>

    </span>

    <span
        id="chatPartnerStatusText"
        class="chat-partner-status-text">
        ${online ? 'En ligne' : 'Hors ligne'}
    </span>
`;
    }

    // Charger les messages
    await loadMessages();

    // Se désabonner de l'ancienne souscription
    if (messageSubscription) {
        await window.supabaseClient.removeChannel(messageSubscription);
        messageSubscription = null;
    }

    // Écouter les nouveaux messages
    subscribeToMessages();

    // Focus input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.focus();
    }
}

// ===== 🔄 ACTUALISER LES STATUTS DES CONVERSATIONS =====

async function refreshConversationStatuses() {

    const statusElements = document.querySelectorAll(
        '.online-status-dot[data-profile-status-id]'
    );

    const chatStatusDot =
        document.getElementById('chatPartnerStatusDot');

    if (
        statusElements.length === 0 &&
        !chatStatusDot
    ) {
        return;
    }

    const profileIds = [
        ...new Set([
            ...[...statusElements].map(
                element => element.dataset.profileStatusId
            ),
            currentChatPartner
        ].filter(Boolean))
    ];

    if (profileIds.length === 0) return;

    try {

        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('id, last_seen')
            .in('id', profileIds);

        if (error) {
            console.error(
                '❌ Erreur actualisation statuts :',
                error
            );
            return;
        }

        const profilesById = {};

        (data || []).forEach(profile => {
            profilesById[profile.id] = profile;
        });

        // 🔄 Liste des conversations
        statusElements.forEach(statusElement => {

            const profile =
                profilesById[
                    statusElement.dataset.profileStatusId
                ];

            if (!profile) return;

            const online = isProfileOnline(profile);

            statusElement.classList.toggle(
                'online',
                online
            );

            statusElement.classList.toggle(
                'offline',
                !online
            );

            statusElement.title =
                online
                    ? 'En ligne'
                    : 'Hors ligne';
        });

        // 🔄 Conversation actuellement ouverte
        if (
            chatStatusDot &&
            currentChatPartner &&
            profilesById[currentChatPartner]
        ) {

            const partner =
                profilesById[currentChatPartner];

            const online = isProfileOnline(partner);

            chatStatusDot.classList.toggle(
                'online',
                online
            );

            chatStatusDot.classList.toggle(
                'offline',
                !online
            );

            chatStatusDot.title =
                online
                    ? 'En ligne'
                    : 'Hors ligne';

            const statusText =
                document.getElementById(
                    'chatPartnerStatusText'
                );

            if (statusText) {
                statusText.textContent =
                    online
                        ? 'En ligne'
                        : 'Hors ligne';
            }
        }

    } catch (error) {

        console.error(
            '❌ Erreur refreshConversationStatuses:',
            error
        );
    }
}

// 🔄 Actualiser les statuts toutes les 30 secondes
if (!statusRefreshInterval) {

    statusRefreshInterval = setInterval(() => {
        refreshConversationStatuses();
    }, 30 * 1000);

}

// ===== CHARGER LES MESSAGES =====
async function loadMessages() {
    try {
        const client = window.supabaseClient;

        const { data, error } = await client
            .from('messages')
            .select('*')
            .or(
                `and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatPartner}),and(sender_id.eq.${currentChatPartner},receiver_id.eq.${currentUser.id})`
            )
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Erreur messages:', error);
            showAlert('Impossible de charger les messages', 'error');
            return;
        }

        const messagesList = document.getElementById('messagesList');
        messagesList.innerHTML = '';

        if (!data || data.length === 0) {
            messagesList.innerHTML =
                '<p style="text-align: center; color: var(--text-color); margin: auto;">Aucun message. Commencez la conversation !</p>';
            return;
        }

        data.forEach(msg => {
            displayMessage(msg);
        });

        messagesList.scrollTop = messagesList.scrollHeight;

    } catch (error) {
        console.error('❌ Erreur loadMessages:', error);
        showAlert('Erreur lors du chargement des messages', 'error');
    }
}








// ===== AFFICHER UN MESSAGE =====
function displayMessage(message) {
    const messagesList = document.getElementById('messagesList');
    const isSent = message.sender_id === currentUser.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;

    // DATE RELATIVE
    const messageDate = new Date(message.created_at);
    const now = new Date();
    const diffMs = now - messageDate;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    let time;
    if (diffSeconds < 60) {
        time = "À l'instant";
    } else if (diffMinutes < 60) {
        time = `Il y a ${diffMinutes} min`;
    } else if (diffHours < 24) {
        time = `Il y a ${diffHours} h`;
    } else if (diffDays < 30) {
        time = `Il y a ${diffDays} j`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        time = `Il y a ${months} mois`;
    } else {
        const years = Math.floor(diffDays / 365);
        time = `Il y a ${years} an${years > 1 ? 's' : ''}`;
    }

    // CONTENU
    const formattedContent = escapeHtml(message.content || '').replace(/\n/g, '<br>');

    // ACTIONS
    let actions = '';
    if (isSent) {
        actions = `
            <div class="message-actions">
             <button
    type="button"
    class="message-action edit-message"
    onclick="editMessage('${message.id}')"
    title="Modifier"
>
    🖊️
</button>
                <button
                    type="button"
                    class="message-action delete-message"
                    onclick="deleteMessage('${message.id}')"
                    title="Supprimer"
                >
                    🗑️
                </button>
            </div>
        `;
    } else {
        actions = `
            <div class="message-actions">
                <button
                    type="button"
                    class="message-action report-message"
                    onclick="reportMessage('${message.id}')"
                    title="Signaler ce message"
                >
                    🚨
                </button>
            </div>
        `;
    }

    messageDiv.innerHTML = `
        <div class="message-content-wrapper">
            <div class="message-bubble">
                <span class="message-text">${formattedContent}</span>
                <span class="message-time">${time}</span>
            </div>
            ${actions}
        </div>
    `;

    messagesList.appendChild(messageDiv);
}

















// ===== MODIFIER UN MESSAGE =====
async function editMessage(messageId) {
    try {
        const client = window.supabaseClient;

        // Récupérer le message
        const { data: message, error } = await client
            .from('messages')
            .select('content')
            .eq('id', messageId)
            .eq('sender_id', currentUser.id)
            .single();

        if (error || !message) {
            console.error('❌ Erreur récupération message:', error);
            showAlert('Impossible de modifier ce message', 'error');
            return;
        }

        // Remplir l'input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = message.content;
            messageInput.focus();
            
            // Auto-resize
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
        }

        // Mémoriser l'ID du message en cours de modification
        window.editingMessageId = messageId;

        showAlert('Mode édition activé ✏️', 'info');

    } catch (error) {
        console.error('❌ Erreur editMessage:', error);
        showAlert('Erreur : ' + error.message, 'error');
    }
}

// ===== SIGNALER UN MESSAGE =====
async function reportMessage(messageId) {
    const client = window.supabaseClient;

    try {
        if (!currentUser) {
            showAlert('Vous devez être connecté.', 'error');
            return;
        }

        if (!client) {
            showAlert('Connexion à Supabase indisponible.', 'error');
            return;
        }

        // Empêcher d'ouvrir plusieurs fenêtres
        const oldModal = document.getElementById('reportMessageModal');
        if (oldModal) {
            oldModal.remove();
        }

        // Créer la modal
        const modal = document.createElement('div');
        modal.id = 'reportMessageModal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 99999;
            box-sizing: border-box;
            animation: modalFadeIn 0.3s ease;
        `;

        modal.innerHTML = `
            <div
                role="dialog"
                aria-modal="true"
                style="
                    width: 100%;
                    max-width: 440px;
                    background: white;
                    border-radius: 20px;
                    padding: 24px;
                    box-sizing: border-box;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.25);
                    animation: modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                "
            >
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 8px;
                ">
                    <h2 style="
                        margin: 0;
                        color: #111827;
                        font-size: 1.25rem;
                        font-weight: 800;
                    ">
                        🚨 Signaler ce message
                    </h2>
                    <button
                        type="button"
                        id="closeReportModal"
                        style="
                            width: 34px;
                            height: 34px;
                            border: none;
                            border-radius: 50%;
                            background: #f3f4f6;
                            color: #374151;
                            font-size: 20px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: all 0.2s ease;
                        "
                        aria-label="Fermer"
                    >
                        ✕
                    </button>
                </div>

                <p style="
                    margin: 0 0 20px;
                    color: #6b7280;
                    font-size: 0.92rem;
                    line-height: 1.5;
                ">
                    Pourquoi souhaitez-vous signaler ce message ?
                </p>

                <div id="reportReasons" style="
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                ">
                    <label style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    " class="report-option">
                        <input type="radio" name="reportReason" value="Contenu inapproprié">
                        <span>🚫 Contenu inapproprié</span>
                    </label>

                    <label style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    " class="report-option">
                        <input type="radio" name="reportReason" value="Harcèlement">
                        <span>😡 Harcèlement</span>
                    </label>

                    <label style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    " class="report-option">
                        <input type="radio" name="reportReason" value="Spam">
                        <span>📢 Spam</span>
                    </label>

                    <label style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    " class="report-option">
                        <input type="radio" name="reportReason" value="Faux profil">
                        <span>👤 Faux profil</span>
                    </label>

                    <label style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    " class="report-option">
                        <input type="radio" name="reportReason" value="Autre">
                        <span>📝 Autre</span>
                    </label>
                </div>

                <textarea
                    id="reportDetails"
                    placeholder="Précisez le motif..."
                    style="
                        display: none;
                        width: 100%;
                        min-height: 90px;
                        margin-top: 12px;
                        padding: 12px;
                        border: 2px solid #d1d5db;
                        border-radius: 12px;
                        resize: vertical;
                        box-sizing: border-box;
                        font-family: inherit;
                        font-size: 0.95rem;
                        outline: none;
                        transition: border-color 0.2s ease;
                    "
                ></textarea>

                <div style="
                    display: flex;
                    gap: 10px;
                    margin-top: 22px;
                ">
                    <button
                        type="button"
                        id="cancelReport"
                        style="
                            flex: 1;
                            padding: 13px;
                            border: none;
                            border-radius: 12px;
                            background: #e5e7eb;
                            color: #374151;
                            font-weight: 700;
                            cursor: pointer;
                            font-size: 0.95rem;
                            transition: all 0.2s ease;
                        "
                    >
                        Annuler
                    </button>

                    <button
                        type="button"
                        id="confirmReport"
                        style="
                            flex: 1;
                            padding: 13px;
                            border: none;
                            border-radius: 12px;
                            background: #dc2626;
                            color: white;
                            font-weight: 700;
                            cursor: pointer;
                            font-size: 0.95rem;
                            transition: all 0.2s ease;
                        "
                    >
                        🚨 Signaler
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Animation CSS
        if (!document.getElementById('reportModalAnimation')) {
            const style = document.createElement('style');
            style.id = 'reportModalAnimation';
            style.textContent = `
                @keyframes modalSlideUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                .report-option:hover {
                    background: #f9fafb;
                    border-color: #dc2626 !important;
                }
                
                .report-option input:checked ~ span {
                    color: #dc2626;
                    font-weight: 700;
                }
            `;
            document.head.appendChild(style);
        }

        // Fermer la modal
        const closeModal = () => {
            modal.style.animation = 'modalFadeOut 0.2s ease';
            setTimeout(() => modal.remove(), 200);
        };

        document.getElementById('closeReportModal').addEventListener('click', closeModal);
        document.getElementById('cancelReport').addEventListener('click', closeModal);

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });

        // Afficher le champ "Autre"
        const reasonInputs = modal.querySelectorAll('input[name="reportReason"]');
        const details = document.getElementById('reportDetails');

        reasonInputs.forEach(input => {
            input.addEventListener('change', () => {
                if (input.value === 'Autre') {
                    details.style.display = 'block';
                    details.focus();
                } else {
                    details.style.display = 'none';
                    details.value = '';
                }
            });
        });

        // Confirmer le signalement
        document.getElementById('confirmReport').addEventListener('click', async () => {
            const selected = modal.querySelector('input[name="reportReason"]:checked');

            if (!selected) {
                showAlert('Veuillez sélectionner un motif.', 'error');
                return;
            }

            let motif = selected.value;
            const detailText = details.value.trim();

            if (motif === 'Autre') {
                if (!detailText) {
                    showAlert('Veuillez préciser le motif.', 'error');
                    details.focus();
                    return;
                }
                motif = 'Autre';
            }

            const confirmButton = document.getElementById('confirmReport');
            confirmButton.disabled = true;
            confirmButton.textContent = '⏳ Envoi...';

            try {
                // Vérifier si déjà signalé
                const { data: existingReport, error: existingError } = await client
                    .from('message_signalements')
                    .select('id')
                    .eq('message_id', messageId)
                    .eq('membre_id', currentUser.id)
                    .maybeSingle();

                if (existingError) {
                    console.error('❌ Vérification signalement :', existingError);
                    showAlert('Impossible de vérifier le signalement.', 'error');
                    confirmButton.disabled = false;
                    confirmButton.textContent = '🚨 Signaler';
                    return;
                }

                if (existingReport) {
                    showAlert('Vous avez déjà signalé ce message.', 'info');
                    closeModal();
                    return;
                }

                // Enregistrer
                const { error: insertError } = await client
                    .from('message_signalements')
                    .insert([{
                        message_id: messageId,
                        membre_id: currentUser.id,
                        motif: motif,
                        details: detailText || null,
                        status: 'pending',
                        created_at: new Date().toISOString()
                    }]);

                if (insertError) {
                    console.error('❌ Erreur création signalement :', insertError);
                    showAlert('Impossible d\'enregistrer le signalement.', 'error');
                    confirmButton.disabled = false;
                    confirmButton.textContent = '🚨 Signaler';
                    return;
                }

                closeModal();
                showAlert('Message signalé avec succès 🚨', 'success');

                // Désactiver le bouton du message
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement) {
                    const button = messageElement.querySelector('.report-message');
                    if (button) {
                        button.disabled = true;
                        button.textContent = '✅';
                        button.title = 'Message déjà signalé';
                    }
                }

            } catch (error) {
                console.error('❌ Erreur enregistrement signalement :', error);
                showAlert('Erreur : ' + (error.message || error), 'error');
                confirmButton.disabled = false;
                confirmButton.textContent = '🚨 Signaler';
            }
        });

    } catch (error) {
        console.error('❌ Erreur reportMessage :', error);
        showAlert('Erreur : ' + (error.message || error), 'error');
    }
}

// ===== SUPPRIMER UN MESSAGE =====
async function deleteMessage(messageId) {
    const client = window.supabaseClient;

    try {
        const confirmed = confirm('Voulez-vous vraiment supprimer ce message ?');
        if (!confirmed) return;

        const { error } = await client
            .from('messages')
            .delete()
            .eq('id', messageId)
            .eq('sender_id', currentUser.id);

        if (error) {
            console.error('❌ Erreur suppression:', error);
            showAlert('Erreur lors de la suppression du message', 'error');
            return;
        }

        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }

        showAlert('Message supprimé avec succès 🗑️', 'success');

    } catch (error) {
        console.error('❌ Erreur deleteMessage:', error);
        showAlert('Erreur : ' + error.message, 'error');
    }
}

function subscribeToMessages() {
    const client = window.supabaseClient;

    messageSubscription = client
        .channel(`messages_${currentUser.id}_${currentChatPartner}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            },
            (payload) => {
                const message = payload.new;

                const isCurrentConversation =
                    (message.sender_id === currentUser.id && message.receiver_id === currentChatPartner) ||
                    (message.sender_id === currentChatPartner && message.receiver_id === currentUser.id);

                if (!isCurrentConversation) return;

                displayMessage(message);

                const messagesList = document.getElementById('messagesList');
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        )
        .subscribe((status) => {
            console.log('📡 Subscription messages:', status);
        });
}

async function sendMessage() {
    // 🔒 Empêche un double envoi
    if (isSendingMessage) {
        console.log('⚠️ Envoi déjà en cours, deuxième appel ignoré');
        return;
    }

    const input = document.getElementById('messageInput');
    if (!input) return;

    const content = input.value.trim();

    if (!content) {
        showAlert('Le message ne peut pas être vide', 'error');
        return;
    }

    if (!currentChatPartner) {
        showAlert('Sélectionnez une conversation', 'error');
        return;
    }

    const client = window.supabaseClient;
    const sendButton = document.querySelector('.send-message-btn');

    // 🔒 Verrouiller immédiatement l'envoi
    isSendingMessage = true;

    if (sendButton) {
        sendButton.disabled = true;
    }

    try {
        // ==========================================
        // ✏️ MODIFICATION D'UN MESSAGE EXISTANT
        // ==========================================
        if (window.editingMessageId) {
            const messageId = window.editingMessageId;

            const { data: updatedMessage, error } = await client
                .from('messages')
                .update({
                    content: content,
                    updated_at: new Date().toISOString()
                })
                .eq('id', messageId)
                .eq('sender_id', currentUser.id)
                .select()
                .single();

            if (error) {
                console.error('❌ Erreur modification:', error);
                showAlert(
                    'Erreur lors de la modification du message',
                    'error'
                );
                return;
            }

            const oldMessage = document.querySelector(
                `[data-message-id="${messageId}"]`
            );

            if (oldMessage) {
                oldMessage.remove();
            }

            displayMessage(updatedMessage);

            window.editingMessageId = null;

            input.value = '';
            input.style.height = 'auto';
            input.focus();

            showAlert(
                'Message modifié avec succès ✅',
                'success'
            );

            return;
        }

        // ==========================================
        // 💬 NOUVEAU MESSAGE
        // ==========================================

        console.log('📤 INSERT MESSAGE', {
            sender: currentUser.id,
            receiver: currentChatPartner,
            content: content
        });

        const { data: insertedMessage, error } = await client
            .from('messages')
            .insert([{
                sender_id: currentUser.id,
                receiver_id: currentChatPartner,
                content: content
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ Erreur envoi:', error);

            showAlert(
                "Erreur lors de l'envoi du message",
                'error'
            );

            return;
        }

        console.log(
            '✅ MESSAGE INSÉRÉ UNE FOIS :',
            insertedMessage.id
        );

        // Vider immédiatement le champ
        input.value = '';
        input.style.height = 'auto';

        // ==========================================
        // 🔔 CRÉER UNE NOTIFICATION
        // ==========================================

        const { data: senderProfile, error: profileError } =
            await client
                .from('profiles')
                .select('first_name, photo_url')
                .eq('id', currentUser.id)
                .single();

        if (profileError) {
            console.error(
                '⚠️ Erreur profil notification:',
                profileError
            );
        }

        const { error: notificationError } = await client
            .from('notifications')
            .insert([{
                recipient_id: currentChatPartner,
                sender_id: currentUser.id,
                type: 'message',
                content:
                    `Nouveau message de ` +
                    `${senderProfile?.first_name || 'Un membre'} : ` +
                    `${content.substring(0, 50)}` +
                    `${content.length > 50 ? '...' : ''}`,
                data: {
                    sender_id: currentUser.id,
                    sender_name:
                        senderProfile?.first_name || null,
                    avatar:
                        senderProfile?.photo_url || null,
                    message_id:
                        insertedMessage.id
                }
            }]);

        if (notificationError) {
            console.error(
                '⚠️ Erreur création notification:',
                notificationError
            );
        }

        input.focus();

    } catch (error) {
        console.error(
            '❌ Erreur sendMessage:',
            error
        );

        showAlert(
            'Erreur : ' + (error.message || error),
            'error'
        );

    } finally {
        // 🔓 Autoriser un nouvel envoi
        isSendingMessage = false;

        if (sendButton) {
            sendButton.disabled = false;
        }
    }
}
// ===== GÉRER LA TOUCHE ENTRÉE =====
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function closeChat() {
    currentChatPartner = null;

    document.getElementById('chatWindow').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';

    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });

    if (messageSubscription) {
        await window.supabaseClient.removeChannel(messageSubscription);
        messageSubscription = null;
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);

    setTimeout(() => alert.remove(), 5000);
}

console.log('🔥 MESSAGES.JS - VERSION CORRIGÉE 🔥');

let callChannel = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let currentCallId = null;
let currentCallType = null;
let currentCallRole = null;
let pendingOffer = null;
let iceCandidateQueue = [];
let currentFacingMode = 'user';

const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function initializeCallChannel() {
    if (!currentUser) {
        console.error("❌ Impossible d'initialiser les appels : utilisateur absent");
        return;
    }

    const client = window.supabaseClient;
    if (!client) {
        console.error('❌ Supabase indisponible');
        return;
    }

    if (callChannel) {
        client.removeChannel(callChannel);
        callChannel = null;
    }

    callChannel = client.channel(`call_user_${currentUser.id}`);

    callChannel
        .on('broadcast', { event: 'call-signal' }, async ({ payload }) => {
            console.log('📡 Signal appel reçu :', payload.type);
            await handleCallSignal(payload);
        })
        .subscribe(status => {
            console.log('📡 Canal appel :', status);
        });
}

async function startAudioCall() {
    console.log('📞 Appel audio demandé');
    await startCall('audio');
}

async function startVideoCall() {
    console.log('🎥 Appel vidéo demandé');
    await startCall('video');
}

async function startCall(type) {
    if (!currentUser) {
        showAlert('Vous devez être connecté.', 'error');
        return;
    }

    if (!currentChatPartner) {
        showAlert('Sélectionnez une conversation.', 'error');
        return;
    }

    if (peerConnection) {
        showAlert('Un appel est déjà en cours.', 'info');
        return;
    }

    try {
        currentCallId = crypto.randomUUID();
        currentCallType = type;
        currentCallRole = 'caller';

        console.log('📞 Début appel :', type, currentCallId);
        
if (type === 'video') {
    currentFacingMode = 'user';
}
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === 'video'
        });

        showCallInterface();
        attachLocalStream();

        await createPeerConnection();

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const client = window.supabaseClient;
        const { data: senderProfile } = await client
            .from('profiles')
            .select('first_name, photo_url')
            .eq('id', currentUser.id)
            .single();

        await sendCallSignal(currentChatPartner, {
            type: 'offer',
            callId: currentCallId,
            callType: currentCallType,
            senderId: currentUser.id,
            senderName: senderProfile?.first_name || 'Un membre',
            offer: peerConnection.localDescription
        });

const notificationType = type === 'video'
    ? 'video_call'
    : 'audio_call';

const notificationContent = type === 'video'
    ? '🎥 Appel vidéo entrant'
    : '📞 Appel audio entrant';
await client
    .from('notifications')
    .insert([{
        recipient_id: currentChatPartner,
        sender_id: currentUser.id,
        type: notificationType, // ✅ "call" ou "video_call"
        content: notificationContent,
        data: {
            sender_id: currentUser.id,
            sender_name: senderProfile?.first_name || 'Un membre',
            avatar: senderProfile?.photo_url || null,
            call_type: type, // ✅ "audio" ou "video"
            call_id: currentCallId
        }
    }]);

        console.log(`✅ Notification ${type} créée pour l'utilisateur ${currentChatPartner}`);

        updateCallStatus('📞 Appel en cours...');

    } catch (error) {
        console.error('❌ Erreur démarrage appel :', error);
        showAlert("Impossible de démarrer l'appel : " + error.message, 'error');
        await endCall(false);
    }
}

async function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfiguration);

    peerConnection.ontrack = event => {
        console.log('🎧 Flux distant reçu');

updateCallStatus(
    currentCallType === 'video'
        ? '🟢 Appel vidéo en cours'
        : '🟢 Appel en cours'
);

        if (!remoteStream) {
            remoteStream = new MediaStream();
        }
        event.streams[0]?.getTracks().forEach(track => {
            if (!remoteStream.getTracks().includes(track)) {
                remoteStream.addTrack(track);
            }
        });
        attachRemoteStream();
    };

    peerConnection.onicecandidate = async event => {
        if (!event.candidate) return;
        await sendCallSignal(getOtherUserId(), {
            type: 'ice-candidate',
            callId: currentCallId,
            senderId: currentUser.id,
            candidate: event.candidate
        });
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('🔗 WebRTC :', peerConnection.connectionState);
        switch (peerConnection.connectionState) {
            case 'connected':
                updateCallStatus('🟢 Appel en cours');
                break;
            case 'connecting':
               updateCallStatus('Connexion...');
                break;
            case 'disconnected':
                updateCallStatus('⚠️ Connexion interrompue');
                break;
            case 'failed':
                console.error('❌ Connexion WebRTC échouée');
                endCall();
                break;
            case 'closed':
                updateCallStatus('📴 Appel terminé');
                break;
        }
    };
}

async function sendCallSignal(receiverId, payload) {
    const client = window.supabaseClient;
    if (!client) {
        console.error('❌ Supabase indisponible');
        return;
    }

    const channel = client.channel(`call_user_${receiverId}`);
    await channel.subscribe();
    await channel.send({
        type: 'broadcast',
        event: 'call-signal',
        payload: payload
    });

    setTimeout(() => {
        client.removeChannel(channel);
    }, 1000);
}

async function handleCallSignal(payload) {
    if (!payload) return;

    if (payload.type === 'offer') {
        await handleIncomingCall(payload);
        return;
    }

    if (payload.type === 'answer') {
        await handleAnswer(payload);
        return;
    }

    if (payload.type === 'ice-candidate') {
        await handleIceCandidate(payload);
        return;
    }

    if (payload.type === 'reject') {
        showAlert('Appel refusé.', 'info');
        await endCall();
        return;
    }

    if (payload.type === 'hangup') {
        console.log('📴 L\'autre utilisateur a raccroché');
        showAlert('L\'appel est terminé.', 'info');
        await endCall();
        return;
    }
}

async function handleIncomingCall(payload) {
    if (peerConnection) {
        await sendCallSignal(payload.senderId, {
            type: 'reject',
            callId: payload.callId,
            senderId: currentUser.id
        });
        return;
    }

    currentCallId = payload.callId;
    currentCallType = payload.callType;
    currentCallRole = 'callee';
    pendingOffer = payload.offer;

    console.log('📞 Appel entrant :', currentCallType);
    showIncomingCallModal(payload);
}
async function acceptIncomingCall() {
    if (!pendingOffer) {
        console.error('❌ Offre WebRTC absente');
        return;
    }

    try {
        closeIncomingCallModal();
if (currentCallType === 'video') {
    currentFacingMode = 'user';
}
        // 🎥 APPEL VIDÉO : micro + caméra
        // 📞 APPEL AUDIO : micro uniquement
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: currentCallType === 'video'
            });

            console.log('✅ Micro + caméra obtenus');

        } catch (mediaError) {

            console.error('❌ Erreur accès caméra/micro :', mediaError);

            // Si c'est un appel vidéo et que la caméra pose problème,
            // on essaie quand même de continuer avec le micro.
            if (currentCallType === 'video') {

                console.warn('⚠️ Caméra indisponible, tentative en audio uniquement');

                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });

                    showAlert(
                        '📷 Caméra indisponible. L’appel continue en audio.',
                        'info'
                    );

                } catch (audioError) {

                    console.error('❌ Micro également indisponible :', audioError);

                    showAlert(
                        '🎤 Impossible d’accéder au microphone.',
                        'error'
                    );

                    await endCall(false);
                    return;
                }

            } else {

                showAlert(
                    '🎤 Impossible d’accéder au microphone.',
                    'error'
                );

                await endCall(false);
                return;
            }
        }

        // 🎨 Afficher l'interface d'appel
        showCallInterface();
        attachLocalStream();

        // 🔗 Créer la connexion WebRTC
        await createPeerConnection();

        // ➕ Ajouter les pistes locales
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // 📡 Définir l'offre reçue
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(pendingOffer)
        );

        // 📡 Créer la réponse
        const answer = await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(answer);

        // 📤 Envoyer la réponse à l'appelant
        await sendCallSignal(getOtherUserId(), {
            type: 'answer',
            callId: currentCallId,
            senderId: currentUser.id,
            answer: peerConnection.localDescription
        });

        console.log('✅ Réponse WebRTC envoyée');

      updateCallStatus('Connexion...');

        pendingOffer = null;

        // 🧊 Ajouter les candidats ICE reçus avant la connexion
        for (const candidate of iceCandidateQueue) {
            try {
                await peerConnection.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );
            } catch (error) {
                console.error('❌ ICE différé :', error);
            }
        }

        iceCandidateQueue = [];

        console.log('🎥 Appel vidéo accepté avec succès');

    } catch (error) {

        console.error('❌ Erreur acceptation appel:', error);

        showAlert(
            "Impossible d'accepter l'appel : " + error.message,
            'error'
        );

        await endCall(false);
    }
}

async function rejectIncomingCall() {
    console.log('❌ Appel refusé');

    if (pendingOffer) {
        await sendCallSignal(pendingOffer.senderId || currentChatPartner, {
            type: 'reject',
            callId: currentCallId,
            senderId: currentUser.id
        });
    }

    closeIncomingCallModal();
    pendingOffer = null;
    currentCallId = null;
    currentCallType = null;
    currentCallRole = null;
}

async function handleAnswer(payload) {
    if (!peerConnection) {
        console.warn('⚠️ PeerConnection inexistante');
        return;
    }

    if (payload.callId !== currentCallId) return;

    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
        console.log('✅ Answer WebRTC reçue');

        for (const candidate of iceCandidateQueue) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }

        iceCandidateQueue = [];

    } catch (error) {
        console.error('❌ Erreur answer:', error);
    }
}

async function handleIceCandidate(payload) {
    if (payload.callId !== currentCallId) return;

    if (!peerConnection || !peerConnection.remoteDescription) {
        iceCandidateQueue.push(payload.candidate);
        return;
    }

    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (error) {
        console.error('❌ Erreur ICE:', error);
    }
}

function getOtherUserId() {
    if (currentCallRole === 'caller') {
        return currentChatPartner;
    }

    if (pendingOffer && pendingOffer.senderId) {
        return pendingOffer.senderId;
    }

    return currentChatPartner;
}

function showCallInterface() {
    let modal = document.getElementById('webrtcCallModal');

    if (modal) {
        modal.remove();
    }

    modal = document.createElement('div');
    modal.id = 'webrtcCallModal';

    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #ffffff 0%, #fdf2f8 50%, #fce7f3 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    modal.innerHTML = `
        <div class="webrtc-call-box" style="
            position: relative;
            width: 100%;
            max-width: 420px;
            height: 100%;
            max-height: 750px;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 50px -12px rgba(236, 72, 153, 0.25);
            border: 1px solid rgba(236, 72, 153, 0.2);
        ">

            <div class="webrtc-call-header" style="
                position: absolute;
                top: 20px;
                left: 0;
                width: 100%;
                text-align: center;
                z-index: 10;
                color: #1e293b;
            ">
                <strong id="webrtcCallStatus" style="
                    font-size: 1.1rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    color: #1e293b;
                ">Connexion...</strong>
            </div>

            <div class="webrtc-video-container" style="
                position: relative;
                width: 100%;
                height: 100%;
                background: #f1f5f9;
                display: flex;
                justify-content: center;
                align-items: center;
            ">

                <!-- 🎥 Vidéo de l'autre personne -->
                <video
                    id="remoteVideo"
                    autoplay
                    playsinline
                    style="
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    ">
                </video>

                <!-- 🪟 Ta caméra : petite et déplaçable -->
                <video
                    id="localVideo"
                    autoplay
                    muted
                    playsinline
                    style="
                        position: absolute;
                        bottom: 110px;
                        right: 20px;
                        width: 110px;
                        height: 150px;
                        object-fit: cover;
                        border-radius: 14px;
                        border: 2px solid #ec4899;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.25);
                        background: #000;
                        z-index: 20;
                        cursor: grab;
                        touch-action: none;
                        user-select: none;
                    ">
                </video>

            </div>

            <!-- 📞 Icône appel audio -->
            <div
                id="audioCallIcon"
                style="
                    display: none;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 5rem;
                    color: #ec4899;
                    animation: pulse 2s infinite;
                ">
                📞
            </div>

            <!-- 🎛️ Boutons -->
            <div class="webrtc-call-actions" style="
                position: absolute;
                bottom: 30px;
                left: 0;
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 1.5rem;
                z-index: 30;
            ">

                <!-- 🎤 Micro -->
                <button
                    type="button"
                    onclick="toggleMicrophone()"
                    id="toggleMicBtn"
                    title="Microphone"
                    style="
                        background: #f1f5f9;
                        border: 1px solid rgba(236, 72, 153, 0.3);
                        width: 55px;
                        height: 55px;
                        border-radius: 50%;
                        color: #1e293b;
                        cursor: pointer;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        transition: all 0.2s ease;
                    ">
                    <svg width="22" height="22" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                </button>

                <!-- 📷 Caméra -->
                <button
                    type="button"
                    onclick="toggleCamera()"
                    id="toggleCameraBtn"
                    title="Caméra"
                    style="
                        background: #f1f5f9;
                        border: 1px solid rgba(236, 72, 153, 0.3);
                        width: 55px;
                        height: 55px;
                        border-radius: 50%;
                        color: #1e293b;
                        cursor: pointer;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        transition: all 0.2s ease;
                    ">
                    <svg width="22" height="22" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                </button>


<button
    type="button"
    id="switchCameraBtn"
    onclick="switchCamera()"
    title="Changer de caméra"
    style="
        width: 52px;
        height: 52px;
        border: none;
        border-radius: 50%;
        background: rgba(255,255,255,0.18);
        color: white;
        font-size: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    "
>
    🔄
</button>

                <!-- 📞 Raccrocher -->
                <button
                    type="button"
                    onclick="endCall()"
                    class="webrtc-hangup"
                    title="Raccrocher"
                    style="
                        background: #ef4444;
                        border: none;
                        width: 65px;
                        height: 65px;
                        border-radius: 50%;
                        color: white;
                        cursor: pointer;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        box-shadow: 0 10px 20px rgba(239, 68, 68, 0.4);
                        transition: all 0.2s ease;
                    ">
                    <svg width="26" height="26" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        style="transform: rotate(135deg);">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                </button>

            </div>
        </div>
    `;

    document.body.appendChild(modal);

    /*
   /*
 * 🎥 PETITE CAMÉRA DÉPLAÇABLE
 * La caméra reste toujours à l'intérieur de la zone vidéo.
 */
const localVideo = document.getElementById('localVideo');
const videoContainer = document.querySelector('.webrtc-video-container');

if (localVideo && videoContainer) {

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    function startDrag(event) {

        const point = event.touches
            ? event.touches[0]
            : event;

        const videoRect = localVideo.getBoundingClientRect();

        dragging = true;

        startX = point.clientX;
        startY = point.clientY;

        startLeft = videoRect.left;
        startTop = videoRect.top;

        // On passe en position absolue dans le conteneur
        const containerRect = videoContainer.getBoundingClientRect();

        localVideo.style.left =
            `${videoRect.left - containerRect.left}px`;

        localVideo.style.top =
            `${videoRect.top - containerRect.top}px`;

        localVideo.style.right = 'auto';
        localVideo.style.bottom = 'auto';

        localVideo.style.cursor = 'grabbing';

        event.preventDefault();
    }

    function moveDrag(event) {

        if (!dragging) return;

        const point = event.touches
            ? event.touches[0]
            : event;

        const containerRect =
            videoContainer.getBoundingClientRect();

        let newLeft =
            startLeft +
            (point.clientX - startX) -
            containerRect.left;

        let newTop =
            startTop +
            (point.clientY - startY) -
            containerRect.top;

        // Limites du conteneur
        const maxLeft =
            videoContainer.clientWidth -
            localVideo.offsetWidth;

        const maxTop =
            videoContainer.clientHeight -
            localVideo.offsetHeight;

        newLeft = Math.max(
            0,
            Math.min(newLeft, maxLeft)
        );

        newTop = Math.max(
            0,
            Math.min(newTop, maxTop)
        );

        localVideo.style.left = `${newLeft}px`;
        localVideo.style.top = `${newTop}px`;

        event.preventDefault();
    }

    function stopDrag() {

        if (!dragging) return;

        dragging = false;

        localVideo.style.cursor = 'grab';
    }

    // 🖱️ Ordinateur
    localVideo.addEventListener(
        'mousedown',
        startDrag
    );

    document.addEventListener(
        'mousemove',
        moveDrag
    );

    document.addEventListener(
        'mouseup',
        stopDrag
    );

    // 📱 Téléphone
    localVideo.addEventListener(
        'touchstart',
        startDrag,
        { passive: false }
    );

    document.addEventListener(
        'touchmove',
        moveDrag,
        { passive: false }
    );

    document.addEventListener(
        'touchend',
        stopDrag
    );
}
   
    if (currentCallType === 'audio') {

        const remoteVideo = document.getElementById('remoteVideo');
        const localVideoElement = document.getElementById('localVideo');
        const cameraButton = document.getElementById('toggleCameraBtn');
        const audioIcon = document.getElementById('audioCallIcon');

        if (remoteVideo) remoteVideo.style.display = 'none';
        if (localVideoElement) localVideoElement.style.display = 'none';
        if (cameraButton) cameraButton.style.display = 'none';
        if (audioIcon) audioIcon.style.display = 'block';

        const switchCameraButton =
    document.getElementById('switchCameraBtn');

if (switchCameraButton) {
    switchCameraButton.style.display = 'none';
}
    } else {

        const remoteVideo = document.getElementById('remoteVideo');
        const localVideoElement = document.getElementById('localVideo');
        const audioIcon = document.getElementById('audioCallIcon');

        if (remoteVideo) remoteVideo.style.display = 'block';
        if (localVideoElement) localVideoElement.style.display = 'block';
        if (audioIcon) audioIcon.style.display = 'none';
        const switchCameraButton =
    document.getElementById('switchCameraBtn');

if (switchCameraButton) {
    switchCameraButton.style.display = 'flex';
}
    }
}

function showIncomingCallModal(payload) {
    let modal = document.getElementById('incomingCallModal');
    
    if (modal) {
        modal.remove();
    }
    const isVideoCall = payload.callType === 'video';
    
    modal = document.createElement('div');
    modal.id = 'incomingCallModal';
    
    modal.innerHTML = `
        <div class="incoming-call-overlay">
            <div class="incoming-call-card">
                
                <!-- Avatar avec animation -->
                <div class="incoming-call-avatar-wrapper">
                    <div class="avatar-pulse-ring"></div>
                    <div class="avatar-pulse-ring" style="animation-delay: 0.5s;"></div>
                    <div class="incoming-call-avatar">
                        ${isVideoCall ? '🎥' : '📞'}
                    </div>
                </div>

                <!-- Type d'appel -->
                <div class="incoming-call-badge">
                    ${isVideoCall ? '🎥 APPEL VIDÉO' : '📞 APPEL AUDIO'}
                </div>

                <!-- Nom de l'appelant -->
                <h2 class="incoming-call-name">
                    ${escapeHtml(payload.senderName || 'Un membre')}
                </h2>

                <p class="incoming-call-subtitle">
                    Souhaite vous ${isVideoCall ? 'passer un appel vidéo' : 'appeler'}
                </p>

                <!-- Boutons d'action -->
                <div class="incoming-call-actions">
                    <button
                        type="button"
                        class="call-action-btn accept-btn"
                        onclick="acceptIncomingCall()"
                    >
                        <div class="btn-icon-wrapper">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                        </div>
                        <span>Accepter</span>
                    </button>

                    <button
                        type="button"
                        class="call-action-btn reject-btn"
                        onclick="rejectIncomingCall()"
                    >
                        <div class="btn-icon-wrapper">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                                <line x1="23" y1="1" x2="1" y2="23"></line>
                            </svg>
                        </div>
                        <span>Refuser</span>
                    </button>
                </div>

            </div>
        </div>
    `;

    if (!document.getElementById('incomingCallStyles')) {
        const style = document.createElement('style');
        style.id = 'incomingCallStyles';
        style.textContent = `
            /* Overlay principal */
            .incoming-call-overlay {
                position: fixed;
                inset: 0;
                background: linear-gradient(135deg, rgba(236, 72, 153, 0.95), rgba(244, 63, 94, 0.95));
                backdrop-filter: blur(20px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                padding: 20px;
                animation: overlayFadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            @keyframes overlayFadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            body.dark-mode .incoming-call-overlay {
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98));
            }

            /* Carte principale */
            .incoming-call-card {
                background: white;
                border-radius: 32px;
                padding: 3rem 2.5rem;
                max-width: 450px;
                width: 100%;
                text-align: center;
                box-shadow: 0 40px 100px rgba(0, 0, 0, 0.3);
                animation: cardSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
                overflow: hidden;
            }

            body.dark-mode .incoming-call-card {
                background: linear-gradient(135deg, #1e293b, #0f172a);
                color: white;
            }

            @keyframes cardSlideUp {
                from {
                    opacity: 0;
                    transform: translateY(50px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            /* Avatar avec anneaux de pulsation */
            .incoming-call-avatar-wrapper {
                position: relative;
                width: 140px;
                height: 140px;
                margin: 0 auto 2rem;
            }

            .avatar-pulse-ring {
                position: absolute;
                inset: -20px;
                border: 3px solid rgba(236, 72, 153, 0.5);
                border-radius: 50%;
                animation: pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            body.dark-mode .avatar-pulse-ring {
                border-color: rgba(244, 63, 94, 0.6);
            }

            @keyframes pulseRing {
                0% {
                    transform: scale(0.8);
                    opacity: 1;
                }
                50% {
                    transform: scale(1.1);
                    opacity: 0.5;
                }
                100% {
                    transform: scale(1.3);
                    opacity: 0;
                }
            }

            .incoming-call-avatar {
                width: 140px;
                height: 140px;
                border-radius: 50%;
                background: linear-gradient(135deg, #ec4899, #f43f5e);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 4rem;
                box-shadow: 0 20px 50px rgba(236, 72, 153, 0.4);
                animation: avatarBounce 1s ease-in-out infinite;
                position: relative;
                z-index: 2;
            }

            @keyframes avatarBounce {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.05);
                }
            }

            /* Badge type d'appel */
            .incoming-call-badge {
                display: inline-block;
                padding: 0.6rem 1.5rem;
                background: linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(244, 63, 94, 0.15));
                border: 2px solid rgba(236, 72, 153, 0.3);
                border-radius: 50px;
                font-size: 0.85rem;
                font-weight: 800;
                letter-spacing: 1px;
                color: #ec4899;
                margin-bottom: 1.5rem;
                animation: badgeSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
            }

            body.dark-mode .incoming-call-badge {
                background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(244, 63, 94, 0.2));
                border-color: rgba(236, 72, 153, 0.4);
                color: #fda4af;
            }

            @keyframes badgeSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Nom de l'appelant */
            .incoming-call-name {
                font-size: 2rem;
                font-weight: 900;
                color: #0f172a;
                margin: 0 0 0.5rem 0;
                letter-spacing: -0.5px;
                animation: nameSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
            }

            body.dark-mode .incoming-call-name {
                color: white;
            }

            @keyframes nameSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-15px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Sous-titre */
            .incoming-call-subtitle {
                font-size: 1.1rem;
                color: #64748b;
                margin: 0 0 2.5rem 0;
                font-weight: 500;
                animation: subtitleSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
            }

            body.dark-mode .incoming-call-subtitle {
                color: #94a3b8;
            }

            @keyframes subtitleSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Actions */
            .incoming-call-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
                animation: actionsSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both;
            }

            @keyframes actionsSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Boutons d'action */
            .call-action-btn {
                padding: 1.2rem;
                border: none;
                border-radius: 18px;
                font-size: 1rem;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.75rem;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
                overflow: hidden;
            }

            .call-action-btn::before {
                content: '';
                position: absolute;
                inset: 0;
                background: rgba(255, 255, 255, 0.2);
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .call-action-btn:hover::before {
                opacity: 1;
            }

            .call-action-btn:active {
                transform: scale(0.95);
            }

            /* Bouton Accepter */
            .accept-btn {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
            }

            .accept-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 12px 32px rgba(16, 185, 129, 0.5);
            }

            /* Bouton Refuser */
            .reject-btn {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
                box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
            }

            .reject-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 12px 32px rgba(239, 68, 68, 0.5);
            }

            /* Icônes des boutons */
            .btn-icon-wrapper {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }

            .call-action-btn:hover .btn-icon-wrapper {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            /* Responsive */
            @media (max-width: 768px) {
                .incoming-call-card {
                    padding: 2.5rem 2rem;
                }

                .incoming-call-avatar-wrapper {
                    width: 120px;
                    height: 120px;
                }

                .incoming-call-avatar {
                    width: 120px;
                    height: 120px;
                    font-size: 3.5rem;
                }

                .incoming-call-name {
                    font-size: 1.75rem;
                }

                .incoming-call-subtitle {
                    font-size: 1rem;
                }
            }

            @media (max-width: 480px) {
                .incoming-call-actions {
                    grid-template-columns: 1fr;
                }

                .incoming-call-card {
                    padding: 2rem 1.5rem;
                }

                .incoming-call-avatar-wrapper {
                    width: 100px;
                    height: 100px;
                }

                .incoming-call-avatar {
                    width: 100px;
                    height: 100px;
                    font-size: 3rem;
                }

                .incoming-call-name {
                    font-size: 1.5rem;
                }

                .btn-icon-wrapper {
                    width: 48px;
                    height: 48px;
                }

                .btn-icon-wrapper svg {
                    width: 24px;
                    height: 24px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(modal);
}

function closeIncomingCallModal() {
    const modal = document.getElementById('incomingCallModal');
    if (modal) {
        modal.remove();
    }
}

function attachLocalStream() {
    const video = document.getElementById('localVideo');
    if (video && localStream) {
        video.srcObject = localStream;
    }
}

function attachRemoteStream() {
    const video = document.getElementById('remoteVideo');
    if (video && remoteStream) {
        video.srcObject = remoteStream;
        video.play().catch(() => {});
    }
}

function updateCallStatus(status) {
    const element = document.getElementById('webrtcCallStatus');
    if (element) {
        element.textContent = status;
    }
}

function toggleMicrophone() {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    const btn = document.getElementById('toggleMicBtn');
    if (btn) {
        const enabled = audioTracks.some(track => track.enabled);
        btn.textContent = enabled ? '🎤' : '🔇';
    }
}

function toggleCamera() {
    if (!localStream) return;

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    videoTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    const btn = document.getElementById('toggleCameraBtn');
    if (btn) {
        const enabled = videoTracks.some(track => track.enabled);
        btn.textContent = enabled ? '📷' : '🚫';
    }
}

async function switchCamera() {
    if (!localStream || currentCallType !== 'video') {
        return;
    }

    const videoTracks = localStream.getVideoTracks();

    if (videoTracks.length === 0) {
        showAlert('📷 Aucune caméra disponible.', 'info');
        return;
    }

    try {
        const nextFacingMode =
            currentFacingMode === 'user'
                ? 'environment'
                : 'user';

        console.log(
            `📷 Changement de caméra : ${currentFacingMode} → ${nextFacingMode}`
        );

        const newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: {
                    ideal: nextFacingMode
                }
            }
        });

        const newVideoTrack = newStream.getVideoTracks()[0];

        if (!newVideoTrack) {
            throw new Error('Nouvelle caméra indisponible');
        }

        // 🔄 Chercher la piste vidéo envoyée par WebRTC
        const videoSender = peerConnection
            ?.getSenders()
            .find(sender =>
                sender.track &&
                sender.track.kind === 'video'
            );

        if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
            console.log('✅ Piste vidéo WebRTC remplacée');
        }

        // 🛑 Arrêter l'ancienne caméra
        videoTracks.forEach(track => {
            track.stop();
            localStream.removeTrack(track);
        });

        // ➕ Ajouter la nouvelle caméra au flux local
        localStream.addTrack(newVideoTrack);

        currentFacingMode = nextFacingMode;

        // 🎥 Mettre à jour l'aperçu local
        const localVideo = document.getElementById('localVideo');

        if (localVideo) {
            localVideo.srcObject = localStream;

            // Caméra avant = miroir
            // Caméra arrière = image normale
            localVideo.style.transform =
                currentFacingMode === 'user'
                    ? 'scaleX(-1)'
                    : 'scaleX(1)';
        }

        console.log(
            `✅ Caméra changée vers : ${currentFacingMode}`
        );

    } catch (error) {

        console.error(
            '❌ Impossible de changer de caméra :',
            error
        );

        showAlert(
            '📷 Impossible de changer de caméra.',
            'error'
        );
    }
}


async function endCall(notifyRemote = true) {
    console.log('📴 Fin de l\'appel');

    const otherUser = getOtherUserId();

    if (notifyRemote && otherUser && currentCallId) {
        try {
            await sendCallSignal(otherUser, {
                type: 'hangup',
                callId: currentCallId,
                senderId: currentUser.id
            });
        } catch (error) {
            console.error('❌ Erreur notification raccrochage:', error);
        }
    }

    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localStream = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    remoteStream = null;

    const callModal = document.getElementById('webrtcCallModal');
    if (callModal) {
        callModal.remove();
    }

    closeIncomingCallModal();

    currentCallId = null;
    currentCallType = null;
    currentCallRole = null;
    pendingOffer = null;
    iceCandidateQueue = [];

    console.log('✅ Appel complètement terminé');
}

window.startAudioCall = startAudioCall;
window.startVideoCall = startVideoCall;
window.acceptIncomingCall = acceptIncomingCall;
window.rejectIncomingCall = rejectIncomingCall;
window.toggleMicrophone = toggleMicrophone;
window.toggleCamera = toggleCamera;
window.endCall = endCall;
window.editMessage = editMessage;
window.deleteMessage = deleteMessage;
window.reportMessage = reportMessage;
window.closeChat = closeChat;
window.switchCamera = switchCamera;