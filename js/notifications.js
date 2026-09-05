
let currentUser = null;
let allNotifications = [];
let currentFilter = 'all';
let notificationSubscription = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔔 notifications.js démarré');

    if (window.i18nReady) {
        await window.i18nReady;
    }

    if (!window.supabaseClient) {
        console.error('❌ Client Supabase introuvable');

        showAlert(
            t(
                'notifications.supabase_unavailable',
                'Erreur : Supabase n’est pas disponible'
            ),
            'error'
        );

        return;
    }

    currentUser = await requireAuth();

    if (!currentUser) {
        console.warn('⚠️ Aucun utilisateur connecté');
        return;
    }

    await loadNotifications();
    subscribeToNotifications();

    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    const languageSelector =
        document.getElementById('languageSelector');

    if (languageSelector) {
        languageSelector.addEventListener('change', () => {
            setTimeout(() => {
                displayNotifications();
                updateUnreadCount();
            }, 300);
        });
    }
});

async function loadNotifications() {
    try {
        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('recipient_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Erreur loadNotifications:', error);

            showAlert(
                t(
                    'notifications.load_error',
                    'Erreur lors du chargement des notifications'
                ),
                'error'
            );

            return;
        }

        allNotifications = data || [];

        allNotifications.forEach(normalizeNotification);

        displayNotifications();
        updateUnreadCount();

    } catch (error) {
        console.error('❌ Erreur:', error);

        showAlert(
            `${t('notifications.error_prefix', 'Erreur :')} ${error.message}`,
            'error'
        );
    }
}

function normalizeNotification(notification) {
    if (!notification) return notification;

    if (typeof notification.data === 'string') {
        try {
            notification.data = JSON.parse(notification.data);
        } catch (error) {
            notification.data = {};
        }
    }

    if (!notification.data || typeof notification.data !== 'object') {
        notification.data = {};
    }

    notification.type = String(
        notification.type || ''
    )
        .trim()
        .toLowerCase();

    return notification;
}

function displayNotifications() {
    const notificationsList =
        document.getElementById('notificationsList');

    if (!notificationsList) return;

    let filtered = allNotifications;

    if (currentFilter === 'unread') {
        filtered = allNotifications.filter(
            n => !n.is_read
        );
  } else if (currentFilter !== 'all') {

    filtered = allNotifications.filter(n => {

        const type = String(n.type || '').toLowerCase();

        // 📞 Appels audio
        if (currentFilter === 'audio_call') {
            return (
                type === 'audio_call' ||
                type === 'call'
            );
        }

        // 🎥 Appels vidéo
        if (currentFilter === 'video_call') {
            return type === 'video_call';
        }

        return type === currentFilter;
    });

}

    notificationsList.innerHTML = '';

    if (filtered.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-notifications">
                <h3>
                    ${escapeHtml(
                        t(
                            'notifications.empty_title',
                            '📭 Aucune notification'
                        )
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        t(
                            'notifications.empty_description',
                            'Vous recevrez des notifications quand quelqu’un vous likera, matchera, enverra un message ou vous appellera.'
                        )
                    )}
                </p>
            </div>
        `;

        return;
    }

    filtered.forEach(notification => {
        notificationsList.appendChild(
            createNotificationElement(notification)
        );
    });
}

function createNotificationElement(notification) {
    normalizeNotification(notification);

    const div = document.createElement('div');

    div.className =
        `notification-item ${!notification.is_read ? 'unread' : ''}`;

    const type = notification.type;
    const data = notification.data || {};

    const time = getTimeAgo(notification.created_at);

    const badgeMap = {
        like: {
            text: t(
                'notifications.new_like',
                'Nouveau like'
            ),
            class: 'badge-like'
        },

        match: {
            text: t(
                'notifications.new_match',
                ' Nouveau match'
            ),
            class: 'badge-match'
        },

        message: {
            text: t(
                'notifications.new_message',
                'Nouveau message'
            ),
            class: 'badge-message'
        },

        audio_call: {
            text: t(
                'notifications.incoming_audio_call',
                'Appel audio entrant'
            ),
            class: 'badge-message'
        },

        call: {
            text: t(
                'notifications.incoming_audio_call',
                ' Appel audio entrant'
            ),
            class: 'badge-message'
        },

        video_call: {
            text: t(
                'notifications.incoming_video_call',
                ' Appel vidéo entrant'
            ),
            class: 'badge-match'
        },

        problem_report: {
            text: t(
                'notifications.report',
                ' Signalement'
            ),
            class: 'badge-message'
        },

        testimonial_approved: {
            text: t(
                'notifications.testimonial_approved_badge',
                ' Témoignage approuvé'
            ),
            class: 'badge-match'
        },

       photo_rejected: {
    text: '❌ Rejetée',
    class: 'badge-message'
},

     photo_approved: {
    text: '✅ Approuvée',
    class: 'badge-match'
},

        testimonial_rejected: {
            text: t(
                'notifications.testimonial_rejected_badge',
                '🔴 Témoignage refusé'
            ),
            class: 'badge-message'
        }
    };

    const badge =
        badgeMap[type] || {
            text: t(
                'notifications.notification',
                'Notification'
            ),
            class: ''
        };

    let senderName;

    if (
        type === 'problem_report' ||
        type === 'testimonial_approved' ||
        type === 'testimonial_rejected'
    ) {
        senderName = t(
            'notifications.alliance_chretienne',
            '🚨 Alliance Chrétienne'
        );
    } else {
        senderName =
            data.sender_name ||
            notification.sender_name ||
            t(
                'notifications.user',
                'Utilisateur'
            );
    }

    const avatar =
        data.avatar ||
        notification.avatar ||
        getDefaultAvatar();

    let message = getNotificationText(notification);

    let actionsHTML = '';

    const senderId =
        data.sender_id ||
        notification.sender_id;

    if (type === 'like') {
        if (senderId) {
            actionsHTML = `
                <div class="notification-actions">
                    <button
                        class="btn-action-primary"
                        onclick="goToProfile('${escapeJs(senderId)}')"
                    >
                        ${escapeHtml(
                            t(
                                'notifications.view_profile',
                                'Voir le profil'
                            )
                        )}
                    </button>

                    <button
                        class="btn-action-secondary"
                        onclick="markAsRead('${escapeJs(notification.id)}')"
                    >
                        ${escapeHtml(
                            t(
                                'notifications.close',
                                'Fermer'
                            )
                        )}
                    </button>
                </div>
            `;
        }
    }

    else if (type === 'match') {
        actionsHTML = `
            <div class="notification-actions">
                <button
                    class="btn-action-primary"
                    onclick="goToMessages(
                        '${escapeJs(senderId)}',
                        '${escapeJs(senderName)}'
                    )"
                >
                    ${escapeHtml(
                        t(
                            'notifications.write_message',
                            '💬 Écrire un message'
                        )
                    )}
                </button>

                <button
                    class="btn-action-secondary"
                    onclick="markAsRead('${escapeJs(notification.id)}')"
                >
                    ${escapeHtml(
                        t(
                            'notifications.close',
                            'Fermer'
                        )
                    )}
                </button>
            </div>
        `;
    }

    else if (type === 'message') {
        actionsHTML = `
            <div class="notification-actions">
                <button
                    class="btn-action-primary"
                    onclick="goToMessages(
                        '${escapeJs(senderId)}',
                        '${escapeJs(senderName)}'
                    )"
                >
                    ${escapeHtml(
                        t(
                            'notifications.reply',
                            '💬 Répondre'
                        )
                    )}
                </button>

                <button
                    class="btn-action-secondary"
                    onclick="markAsRead('${escapeJs(notification.id)}')"
                >
                    ${escapeHtml(
                        t(
                            'notifications.close',
                            'Fermer'
                        )
                    )}
                </button>
            </div>
        `;
    }

    else if (
        type === 'audio_call' ||
        type === 'call'
    ) {
        actionsHTML = `
            <div class="notification-actions">
                <button
                    class="btn-action-primary"
                    onclick="answerCall(
                        '${escapeJs(notification.id)}',
                        'audio'
                    )"
                >
                    ${escapeHtml(
                        t(
                            'notifications.answer',
                            '📞 Répondre'
                        )
                    )}
                </button>

                <button
                    class="btn-action-secondary"
                    onclick="ignoreCall(
                        '${escapeJs(notification.id)}'
                    )"
                >
                    ${escapeHtml(
                        t(
                            'notifications.ignore',
                            '✕ Ignorer'
                        )
                    )}
                </button>
            </div>
        `;
    }

    else if (type === 'video_call') {
        actionsHTML = `
            <div class="notification-actions">
                <button
                    class="btn-action-primary"
                    onclick="answerCall(
                        '${escapeJs(notification.id)}',
                        'video'
                    )"
                >
                    ${escapeHtml(
                        t(
                            'notifications.answer_video',
                            '🎥 Répondre'
                        )
                    )}
                </button>

                <button
                    class="btn-action-secondary"
                    onclick="ignoreCall(
                        '${escapeJs(notification.id)}'
                    )"
                >
                    ${escapeHtml(
                        t(
                            'notifications.ignore',
                            '✕ Ignorer'
                        )
                    )}
                </button>
            </div>
        `;
    }

    else if (
        type === 'testimonial_approved' ||
        type === 'testimonial_rejected' ||
        type === 'problem_report'
    ) {
        actionsHTML = `
            <div class="notification-actions">
                <button
                    class="btn-action-secondary"
                    onclick="markAsRead(
                        '${escapeJs(notification.id)}'
                    )"
                >
                    ${escapeHtml(
                        t(
                            'notifications.close',
                            'Fermer'
                        )
                    )}
                </button>
            </div>
        `;
    }

    div.innerHTML = `
        <img
            src="${escapeHtml(avatar)}"
            alt="${escapeHtml(
                t(
                    'notifications.avatar',
                    'Avatar'
                )
            )}"
            class="notification-avatar"
            onerror="this.src='${getDefaultAvatar()}'
        >

        <div class="notification-content">

            <div class="notification-title">
                ${escapeHtml(senderName)}
            </div>

            <div class="notification-message">
                ${escapeHtml(message)}
            </div>

            <div class="notification-time">
                ${escapeHtml(time)}
            </div>

            <span class="notification-badge ${badge.class}">
                ${escapeHtml(badge.text)}
            </span>

            ${actionsHTML}

        </div>
    `;

    return div;
}

function getNotificationText(notification) {

    const type = String(
        notification.type || ''
    )
        .trim()
        .toLowerCase();

    const data = notification.data || {};

    // 📷 Notifications de modération des photos

if (
    type === 'photo_approved' ||
    type === 'photo_rejected'
) {
    return notification.content ||
        data.message ||
        (
            type === 'photo_approved'
                ? '✅ Photo approuvée. Elle est maintenant visible.'
                : '❌ Photo rejetée. Veuillez en envoyer une nouvelle.'
        );
}

    if (type === 'like') {
        return t(
            'notifications.default_like',
            'Quelqu’un a aimé votre profil.'
        );
    }

    if (type === 'match') {
        return t(
            'notifications.default_match',
            'Vous avez un nouveau match !'
        );
    }

    // ...

    if (type === 'like') {
        return t(
            'notifications.default_like',
            'Quelqu’un a aimé votre profil.'
        );
    }

    if (type === 'match') {
        return t(
            'notifications.default_match',
            'Vous avez un nouveau match !'
        );
    }

    if (type === 'message') {
        return t(
            'notifications.default_message',
            'Vous avez reçu un nouveau message.'
        );
    }

    if (
        type === 'audio_call' ||
        type === 'call'
    ) {
        return t(
            'notifications.default_audio_call',
            'Vous avez reçu un appel audio entrant.'
        );
    }

    if (type === 'video_call') {
        return t(
            'notifications.default_video_call',
            'Vous avez reçu un appel vidéo entrant.'
        );
    }

    if (type === 'problem_report') {
        return t(
            'notifications.default_problem_report',
            'Votre signalement a été traité par l’équipe d’Alliance Chrétienne.'
        );
    }

    if (type === 'testimonial_approved') {
        return t(
            'notifications.default_testimonial_approved',
            '✅ Votre témoignage a été approuvé et publié sur Alliance Chrétienne.'
        );
    }

    if (type === 'testimonial_rejected') {
        return t(
            'notifications.default_testimonial_rejected',
            '🔴 Votre témoignage n’a pas été retenu pour publication sur Alliance Chrétienne.'
        );
    }

    if (data.message) {
        return data.message;
    }

    return t(
        'notifications.default',
        'Vous avez une nouvelle notification.'
    );
}

async function answerCall(notificationId, callType) {
    try {
        const notification =
            allNotifications.find(
                n => n.id === notificationId
            );

        if (!notification) return;

        normalizeNotification(notification);

        const callerId =
            notification.data?.sender_id ||
            notification.sender_id;

        if (!callerId) {
            showAlert(
                t(
                    'notifications.caller_not_found',
                    'Impossible de retrouver l’appelant.'
                ),
                'error'
            );

            return;
        }

        const callerName =
            notification.data?.sender_name ||
            notification.sender_name ||
            '';

        await markAsRead(notificationId);

        const url =
            `membre-messages.html?user=${encodeURIComponent(callerId)}` +
            `&name=${encodeURIComponent(callerName)}` +
            `&call=${encodeURIComponent(callType)}`;

        window.location.href = url;

    } catch (error) {
        console.error('❌ Erreur réponse appel:', error);

        showAlert(
            t(
                'notifications.call_error',
                'Impossible de répondre à l’appel.'
            ),
            'error'
        );
    }
}

async function ignoreCall(notificationId) {
    await markAsRead(notificationId);

    showAlert(
        t(
            'notifications.call_ignored',
            'Appel ignoré'
        ),
        'info'
    );
}

async function markAsRead(notificationId) {
    try {
        const { error } =
            await window.supabaseClient
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('recipient_id', currentUser.id);

        if (error) {
            console.error(
                '❌ Erreur suppression notification:',
                error
            );

            showAlert(
                t(
                    'notifications.close_error',
                    'Impossible de fermer cette notification'
                ),
                'error'
            );

            return;
        }

        allNotifications =
            allNotifications.filter(
                n => n.id !== notificationId
            );

        displayNotifications();
        updateUnreadCount();

    } catch (error) {
        console.error(
            '❌ Erreur markAsRead:',
            error
        );

        showAlert(
            `${t(
                'notifications.error_prefix',
                'Erreur :'
            )} ${error.message}`,
            'error'
        );
    }
}

async function markAllAsRead() {
    try {
        const unreadIds =
            allNotifications
                .filter(n => !n.is_read)
                .map(n => n.id);

        if (unreadIds.length === 0) {
            showAlert(
                t(
                    'notifications.no_unread',
                    'Aucune notification non lue'
                ),
                'info'
            );

            return;
        }

        const { error } =
            await window.supabaseClient
                .from('notifications')
                .update({
                    is_read: true
                })
                .in('id', unreadIds)
                .eq('recipient_id', currentUser.id);

        if (error) {
            console.error(
                '❌ Erreur markAllAsRead:',
                error
            );

            showAlert(
                t(
                    'notifications.mark_all_error',
                    'Impossible de marquer les notifications comme lues.'
                ),
                'error'
            );

            return;
        }

        allNotifications.forEach(
            n => {
                n.is_read = true;
            }
        );

        displayNotifications();
        updateUnreadCount();

        showAlert(
            t(
                'notifications.all_marked_read',
                '✅ Toutes les notifications sont marquées comme lues'
            ),
            'success'
        );

    } catch (error) {
        console.error('❌ Erreur:', error);
    }
}

function filterNotifications(filter) {
    currentFilter = filter;

    document
        .querySelectorAll('.filter-btn')
        .forEach(btn => {
            btn.classList.remove('active');

            const onclickValue =
                btn.getAttribute('onclick');

            if (
                onclickValue &&
                onclickValue.includes(`'${filter}'`)
            ) {
                btn.classList.add('active');
            }
        });

    displayNotifications();
}

function updateUnreadCount() {
    const unreadCount =
        allNotifications.filter(
            n => !n.is_read
        ).length;

    const countElement =
        document.getElementById('unreadCount');

    if (!countElement) return;

    countElement.textContent =
        unreadCount;

    countElement.style.display =
        unreadCount > 0
            ? 'inline-flex'
            : 'none';
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();

    const seconds =
        Math.floor(
            (now - date) / 1000
        );

    if (seconds < 60) {
        return t(
            'notifications.just_now',
            'À l’instant'
        );
    }

    if (seconds < 3600) {
        const count =
            Math.floor(seconds / 60);

        return t(
            'notifications.minutes_ago',
            `Il y a ${count} min`
        ).replace(
            '{count}',
            count
        );
    }

    if (seconds < 86400) {
        const count =
            Math.floor(seconds / 3600);

        return t(
            'notifications.hours_ago',
            `Il y a ${count} h`
        ).replace(
            '{count}',
            count
        );
    }

    if (seconds < 604800) {
        const count =
            Math.floor(seconds / 86400);

        return t(
            'notifications.days_ago',
            `Il y a ${count} j`
        ).replace(
            '{count}',
            count
        );
    }

    const lang =
        localStorage.getItem('language') || 'fr';

    const localeMap = {
        fr: 'fr-FR',
        en: 'en-US',
        es: 'es-ES'
    };

    return date.toLocaleDateString(
        localeMap[lang] || 'fr-FR'
    );
}

function subscribeToNotifications() {
    const client =
        window.supabaseClient;

    if (!client || !currentUser) return;

    if (notificationSubscription) {
        try {
            client.removeChannel(
                notificationSubscription
            );
        } catch (e) {}
    }

    notificationSubscription =
        client
            .channel(
                `notifications_${currentUser.id}`
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter:
                        `recipient_id=eq.${currentUser.id}`
                },
                payload => {
                    const notification =
                        normalizeNotification(
                            payload.new
                        );

                    const exists =
                        allNotifications.some(
                            n =>
                                n.id ===
                                notification.id
                        );

                    if (exists) return;

                    allNotifications.unshift(
                        notification
                    );

                    displayNotifications();
                    updateUnreadCount();
                    playNotificationSound();

                    const message =
                        getNotificationText(
                            notification
                        );

                    showAlert(
                        `🔔 ${message}`,
                        'info'
                    );
                }
            )
            .subscribe(status => {
                console.log(
                    '📡 Subscription notifications:',
                    status
                );
            });
}

function goToProfile(userId) {
    if (!userId) return;

    window.location.href =
        `membre-profil.html?view=${encodeURIComponent(userId)}`;
}

function goToMessages(userId, userName) {
    if (!userId) return;

    window.location.href =
        `membre-messages.html?user=${encodeURIComponent(userId)}` +
        `&name=${encodeURIComponent(userName || '')}`;
}

function playNotificationSound() {
    try {
        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) return;

        const audioContext =
            new AudioContext();

        const oscillator =
            audioContext.createOscillator();

        const gainNode =
            audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(
            audioContext.destination
        );

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(
            0.3,
            audioContext.currentTime
        );

        gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.5
        );

        oscillator.start(
            audioContext.currentTime
        );

        oscillator.stop(
            audioContext.currentTime + 0.5
        );

    } catch (e) {
        console.log('🔇 Son non disponible');
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

    return String(text ?? '')
        .replace(
            /[&<>"']/g,
            m => map[m]
        );
}

function escapeJs(text) {
    return String(text ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

function getDefaultAvatar() {
    return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22 viewBox=%220 0 50 50%22%3E%3Ccircle cx=%2225%22 cy=%2225%22 r=%2225%22 fill=%22%23e2e8f0%22/%3E%3Ccircle cx=%2225%22 cy=%2219%22 r=%228%22 fill=%22%2394a3b8%22/%3E%3Cpath d=%22M10 43c2-9 8-14 15-14s13 5 15 14%22 fill=%22%2394a3b8%22/%3E%3C/svg%3E';
}

function showAlert(message, type = 'info') {
    const alertContainer =
        document.getElementById('alertContainer');

    if (!alertContainer) return;

    const alert =
        document.createElement('div');

    alert.className =
        `alert alert-${type}`;

    alert.textContent =
        message;

    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

window.addEventListener(
    'beforeunload',
    () => {
        if (
            notificationSubscription &&
            window.supabaseClient
        ) {
            try {
                window.supabaseClient.removeChannel(
                    notificationSubscription
                );
            } catch (e) {}
        }
    }
);

console.log(
    '✅ notifications.js chargé avec succès !'
);
