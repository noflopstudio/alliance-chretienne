let currentAdmin = null;
let certificationRequests = [];
let selectedRequestId = null;

document.addEventListener('DOMContentLoaded', async () => {

const supabase = window.supabaseClient;

const container =
    document.getElementById('certificationsContainer');

if (!supabase) {
    console.error('❌ supabaseClient introuvable.');
    showAlert(
        'Connexion Supabase introuvable. Vérifie supabase-config.js.',
        'error'
    );
    return;
}


function showAlert(message, type = 'info') {

    const alertContainer =
        document.getElementById('alertContainer');

    if (!alertContainer) return;

    const alert = document.createElement('div');

    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    alertContainer.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}

/* ==========================================================
   PROTECTION HTML
   ========================================================== */

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ==========================================================
   FORMAT DATE
   ========================================================== */

function formatDate(value) {

    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/* ==========================================================
   FORMAT MONTANT
   ========================================================== */

function formatAmount(value) {

    const amount = Number(value || 0);

    return amount.toLocaleString('fr-FR') + ' FCFA';
}

/* ==========================================================
   AVATAR PAR DÉFAUT
   ========================================================== */

function getDefaultAvatar() {

    return 'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="150"
                height="150"
                viewBox="0 0 150 150"
            >
                <rect
                    width="150"
                    height="150"
                    rx="75"
                    fill="#e5e7eb"
                />

                <circle
                    cx="75"
                    cy="58"
                    r="28"
                    fill="#9ca3af"
                />

                <path
                    d="M30 130c5-28 22-42 45-42s40 14 45 42"
                    fill="#9ca3af"
                />
            </svg>
        `);
}

/* ==========================================================
   CALCUL ÂGE
   ========================================================== */

function calculateAge(birthDate) {

    if (!birthDate) return '—';

    const birth = new Date(birthDate);
    const today = new Date();

    let age =
        today.getFullYear() -
        birth.getFullYear();

    const month =
        today.getMonth() -
        birth.getMonth();

    if (
        month < 0 ||
        (
            month === 0 &&
            today.getDate() < birth.getDate()
        )
    ) {
        age--;
    }

    return age;
}

async function checkAdmin() {

    try {

        console.log('🔐 Vérification de la session administrateur...');

        // Attendre que Supabase ait récupéré la session
        const {
            data: {
                session
            },
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) {

            console.error(
                '❌ Erreur récupération session :',
                sessionError
            );

            showAlert(
                'Impossible de vérifier votre connexion.',
                'error'
            );

            return false;
        }

        // Aucune session
        if (!session) {

            console.warn(
                '⚠️ Aucune session administrateur trouvée.'
            );

            showAlert(
                '⚠️ Vous devez être connecté en tant qu’administrateur.',
                'error'
            );

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1200);

            return false;
        }

        console.log(
            '✅ Session trouvée :',
            session.user.id
        );

        // Récupérer l'utilisateur depuis la session
        const user = session.user;

        // Vérifier le profil administrateur
        const {
            data: profile,
            error: profileError
        } = await supabase
            .from('profiles')
            .select(`
                id,
                first_name,
                photo_url,
                is_admin
            `)
            .eq('id', user.id)
            .single();

        if (profileError) {

            console.error(
                '❌ Erreur profil admin :',
                profileError
            );

            showAlert(
                'Impossible de vérifier vos droits administrateur.',
                'error'
            );

            return false;
        }

        // Compte non administrateur
        if (!profile || profile.is_admin !== true) {

            console.warn(
                '⛔ Utilisateur non administrateur.'
            );

            showAlert(
                '⛔ Accès refusé. Cette page est réservée à l’administration.',
                'error'
            );

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);

            return false;
        }

        // Administrateur confirmé
        currentAdmin = profile;

        console.log(
            '👑 Administrateur connecté :',
            currentAdmin.first_name
        );

        return true;

    } catch (error) {

        console.error(
            '❌ Erreur générale checkAdmin :',
            error
        );

        showAlert(
            'Une erreur est survenue lors de la vérification de votre connexion.',
            'error'
        );

        return false;
    }
}

window.viewPaymentProof =
    async function(requestId) {

        const request =
            certificationRequests.find(
                item =>
                    item.id === requestId
            );

        if (!request) {

            showAlert(
                'Demande introuvable.',
                'error'
            );

            return;
        }

        if (!request.payment_proof_url) {

            showAlert(
                'Aucune preuve de paiement disponible.',
                'error'
            );

            return;
        }

        const {
            data,
            error
        } = await supabase.storage
            .from('certification-proofs')
            .createSignedUrl(
                request.payment_proof_url,
                300
            );

        if (error) {

            console.error(
                '❌ Erreur preuve :',
                error
            );

            showAlert(
                'Impossible d’ouvrir la preuve.',
                'error'
            );

            return;
        }

        if (!data?.signedUrl) {

            showAlert(
                'Preuve introuvable.',
                'error'
            );

            return;
        }

        const modal =
            document.getElementById('proofModal');

        const body =
            document.getElementById('proofModalBody');

        if (!modal || !body) return;

        body.innerHTML = `
            <p>
                <strong>Membre :</strong>
                ${escapeHtml(request.full_name)}
            </p>

            <p>
                <strong>Transaction :</strong>
                ${escapeHtml(request.transaction_id)}
            </p>

            <img
                src="${escapeHtml(data.signedUrl)}"
                class="proof-image"
                alt="Preuve de paiement"
            >
        `;

        modal.classList.add('show');
    };

/* ==========================================================
   VOIR LE PROFIL
   ========================================================== */

window.viewProfile =
    async function(userId) {

        const {
            data: profile,
            error
        } = await supabase
            .from('profiles')
            .select(`
                id,
                first_name,
                birth_date,
                gender,
                city,
                country,
                denomination,
                church_frequency,
                faith_engagement,
                bio,
                looking_for,
                favorite_verse,
                photo_url,
                is_verified
            `)
            .eq('id', userId)
            .single();

        if (error || !profile) {

            console.error(
                '❌ Erreur profil :',
                error
            );

            showAlert(
                'Impossible de charger le profil.',
                'error'
            );

            return;
        }

        const modal =
            document.getElementById('profileModal');

        const body =
            document.getElementById('profileModalBody');

        if (!modal || !body) return;

        const age =
            calculateAge(profile.birth_date);

        body.innerHTML = `

            ${
                profile.photo_url
                    ? `
                        <img
                            src="${escapeHtml(profile.photo_url)}"
                            style="
                                width:130px;
                                height:130px;
                                border-radius:50%;
                                object-fit:cover;
                                display:block;
                                margin:0 auto 20px;
                            "
                            alt="Photo du membre"
                        >
                    `
                    : ''
            }

            <div class="profile-details">

                <div class="profile-detail">
                    <strong>Prénom :</strong>
                    ${escapeHtml(profile.first_name)}
                </div>

                <div class="profile-detail">
                    <strong>Âge :</strong>
                    ${age} ans
                </div>

                <div class="profile-detail">
                    <strong>Genre :</strong>
                    ${escapeHtml(profile.gender)}
                </div>

                <div class="profile-detail">
                    <strong>Ville :</strong>
                    ${escapeHtml(profile.city)}
                </div>

                <div class="profile-detail">
                    <strong>Pays :</strong>
                    ${escapeHtml(profile.country)}
                </div>

                <div class="profile-detail">
                    <strong>Dénomination :</strong>
                    ${escapeHtml(profile.denomination)}
                </div>

                <div class="profile-detail">
                    <strong>Fréquence à l’église :</strong>
                    ${escapeHtml(profile.church_frequency)}
                </div>

                <div class="profile-detail">
                    <strong>Engagement dans la foi :</strong>
                    ${escapeHtml(profile.faith_engagement)}
                </div>

                <div class="profile-detail">
                    <strong>Recherche :</strong>
                    ${escapeHtml(profile.looking_for)}
                </div>

                <div class="profile-detail">
                    <strong>Biographie :</strong>
                    <br>
                    ${escapeHtml(profile.bio)}
                </div>

                ${
                    profile.favorite_verse
                        ? `
                            <div class="profile-detail">
                                <strong>
                                    📖 Verset préféré :
                                </strong>
                                <br>
                                ${escapeHtml(profile.favorite_verse)}
                            </div>
                        `
                        : ''
                }

                <div
                    class="profile-detail"
                    style="
                        text-align:center;
                        font-weight:800;
                    "
                >
                    ${
                        profile.is_verified
                            ? '✅ Profil certifié'
                            : '⏳ Profil non certifié'
                    }
                </div>

            </div>
        `;

        modal.classList.add('show');
    };

/* ==========================================================
   FERMER LES MODALES
   ========================================================== */

window.closeModal =
    function(modalId) {

        if (modalId) {

            const modal =
                document.getElementById(modalId);

            if (modal) {
                modal.classList.remove('show');
            }

            return;
        }

        document
            .querySelectorAll('.modal')
            .forEach(modal => {
                modal.classList.remove('show');
            });
    };

document
    .querySelectorAll('.modal')
    .forEach(modal => {

        modal.addEventListener(
            'click',
            event => {

                if (
                    event.target === modal
                ) {
                    modal.classList.remove(
                        'show'
                    );
                }
            }
        );
    });

/* ==========================================================
   CERTIFIER LE PROFIL
   ========================================================== */

window.certifyProfile =
    async function(requestId) {

        const request =
            certificationRequests.find(
                item =>
                    item.id === requestId
            );

        if (!request) {

            showAlert(
                'Demande introuvable.',
                'error'
            );

            return;
        }

       if (
    request.status === 'certified' ||
    request.profile?.is_verified === true
) {
            showAlert(
                'Ce profil est déjà certifié.',
                'info'
            );

            return;
        }

        const confirmed =
            confirm(
                `Voulez-vous vraiment certifier le profil de ${request.full_name} ?\n\n` +
                `Vérifiez bien le paiement et la preuve avant de confirmer.`
            );

        if (!confirmed) return;

        try {

            showAlert(
                '⏳ Certification en cours...',
                'info'
            );

            /* --------------------------------------------------
               1. CERTIFIER LE PROFIL
               -------------------------------------------------- */

            const {
                error: profileError
            } = await supabase
                .from('profiles')
                .update({
                    is_verified: true,
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    'id',
                    request.user_id
                );

            if (profileError) {
                throw profileError;
            }

            /* --------------------------------------------------
               2. APPROUVER LA DEMANDE
               -------------------------------------------------- */

          const {
    error: requestError
} = await supabase
    .from('verification_requests')
    .update({
        status: 'certified',
        payment_status: 'paid',
        reviewed_at: new Date().toISOString(),
        certified_at: new Date().toISOString(),
        payment_verified_at: new Date().toISOString(),
        reviewed_by: currentAdmin.id,
        payment_verified_by: currentAdmin.id,
        updated_at: new Date().toISOString()
    })
    .eq(
        'id',
        request.id
    );

if (requestError) {
    throw requestError;
}
            /* --------------------------------------------------
               3. NOTIFICATION
               -------------------------------------------------- */

            const {
                error: notificationError
            } = await supabase
                .from('notifications')
                .insert([
                    {
                        recipient_id:
                            request.user_id,

                        sender_id:
                            currentAdmin.id,

                        type:
                            'certification_approved',

                        content:
                            '🎉 Félicitations ! Votre profil Alliance Chrétienne a été certifié.',

                        data: {
                            certification_request_id:
                                request.id
                        },

                        is_read: false
                    }
                ]);

            if (notificationError) {

                console.error(
                    '⚠️ Notification certification :',
                    notificationError
                );

                showAlert(
                    '✅ Profil certifié, mais la notification n’a pas pu être envoyée.',
                    'info'
                );

            } else {

                showAlert(
                    '🎉 Profil certifié et notification envoyée !',
                    'success'
                );
            }

            selectedRequestId = null;

            await loadRequests();

        } catch (error) {

            console.error(
                '❌ Erreur certification :',
                error
            );

            showAlert(
                '❌ Erreur lors de la certification : ' +
                (error.message || 'Erreur inconnue'),
                'error'
            );
        }
    };





    /* ==========================================================
   ENLEVER LA CERTIFICATION
   ========================================================== */

window.removeCertification =
    async function(requestId) {

        const request =
            certificationRequests.find(
                item =>
                    item.id === requestId
            );

        if (!request) {

            showAlert(
                'Demande introuvable.',
                'error'
            );

            return;
        }

        const isCertified =
    request.status === 'certified' ||
    request.profile?.is_verified === true;
        if (!isCertified) {

            showAlert(
                'Ce profil n’est pas certifié.',
                'info'
            );

            return;
        }

        const confirmed =
            confirm(
                `⚠️ Voulez-vous vraiment enlever la certification de ${request.full_name} ?\n\n` +
                `Le profil ne sera plus certifié.`
            );

        if (!confirmed) {
            return;
        }

        try {

            showAlert(
                '⏳ Retrait de la certification en cours...',
                'info'
            );

            /* --------------------------------------------------
               1. RETIRER LA CERTIFICATION DU PROFIL
               -------------------------------------------------- */

            const {
                error: profileError
            } = await supabase
                .from('profiles')
                .update({
                    is_verified: false,
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    'id',
                    request.user_id
                );

            if (profileError) {
                throw profileError;
            }

            /* --------------------------------------------------
               2. METTRE À JOUR LA DEMANDE
               -------------------------------------------------- */

const {
    error: requestError
} = await supabase
    .from('verification_requests')
    .update({
        status: 'rejected',
        rejection_reason:
            'Certification retirée par l’administration.',
        reviewed_at:
            new Date().toISOString(),
        reviewed_by:
            currentAdmin.id,
        updated_at:
            new Date().toISOString()
    })
    .eq(
        'id',
        request.id
    );

if (requestError) {
    throw requestError;
}

            const {
                error: notificationError
            } = await supabase
                .from('notifications')
                .insert([
                    {
                        recipient_id:
                            request.user_id,

                        sender_id:
                            currentAdmin.id,

                        type:
                            'certification_removed',

                        content:
                            '🔴 Votre certification Alliance Chrétienne a été retirée par l’administration.',

                        data: {
                            certification_request_id:
                                request.id,

                            reason:
                                'Certification retirée par l’administration.'
                        },

                        is_read: false
                    }
                ]);

            if (notificationError) {

                console.error(
                    '⚠️ Notification retrait :',
                    notificationError
                );

                showAlert(
                    '✅ Certification retirée, mais la notification n’a pas pu être envoyée.',
                    'info'
                );

            } else {

                showAlert(
                    '✅ Certification retirée et membre notifié.',
                    'success'
                );
            }

            selectedRequestId = null;

            await loadRequests();

        } catch (error) {

            console.error(
                '❌ Erreur retrait certification :',
                error
            );

            showAlert(
                '❌ Impossible de retirer la certification : ' +
                (error.message || 'Erreur inconnue'),
                'error'
            );
        }
    };

window.rejectCertification =
    function(requestId) {

        const request =
            certificationRequests.find(
                item =>
                    item.id === requestId
            );

        if (!request) {

            showAlert(
                'Demande introuvable.',
                'error'
            );

            return;
        }

      if (
    request.status === 'certified' ||
    request.profile?.is_verified === true
) {

            showAlert(
                'Impossible de refuser un profil déjà certifié.',
                'error'
            );

            return;
        }

        selectedRequestId = requestId;

        const modal =
            document.getElementById('rejectModal');

        const textarea =
            document.getElementById(
                'rejectionReason'
            );

        const button =
            document.getElementById(
                'confirmRejectButton'
            );

        if (!modal || !textarea || !button) {
            return;
        }

        textarea.value = '';

        button.onclick = async () => {

            const reason =
                textarea.value.trim();

            if (!reason) {

                showAlert(
                    'Veuillez indiquer le motif du refus.',
                    'error'
                );

                textarea.focus();

                return;
            }

            await confirmRejection(
                request,
                reason
            );
        };

        modal.classList.add('show');

        setTimeout(() => {
            textarea.focus();
        }, 100);
    };

/* ==========================================================
   CONFIRMER REFUS
   ========================================================== */

async function confirmRejection(
    request,
    reason
) {

    const confirmed =
        confirm(
            `Confirmer le refus de la demande de ${request.full_name} ?\n\n` +
            `Motif : ${reason}`
        );

    if (!confirmed) {
        return;
    }

    try {

        /* --------------------------------------------------
           1. REFUSER LA DEMANDE
           -------------------------------------------------- */

        const {
    error: requestError
} = await supabase
    .from('verification_requests')
    .update({
        status: 'rejected',
        rejection_reason:
            reason,
        reviewed_at:
            new Date().toISOString(),
        reviewed_by:
            currentAdmin.id,
        updated_at:
            new Date().toISOString()
    })
    .eq(
        'id',
        request.id
    );

if (requestError) {
    throw requestError;
}

        if (requestError) {
            throw requestError;
        }

        /* --------------------------------------------------
           2. NOTIFICATION
           -------------------------------------------------- */

        const {
            error: notificationError
        } = await supabase
            .from('notifications')
            .insert([
                {
                    recipient_id:
                        request.user_id,

                    sender_id:
                        currentAdmin.id,

                    type:
                        'certification_rejected',

                    content:
                        `❌ Votre demande de certification a été refusée. Motif : ${reason}`,

                    data: {
                        certification_request_id:
                            request.id,

                        reason:
                            reason
                    },

                    is_read: false
                }
            ]);

        if (notificationError) {

            console.error(
                '⚠️ Notification refus :',
                notificationError
            );

            showAlert(
                '❌ Demande refusée, mais la notification n’a pas pu être envoyée.',
                'info'
            );

        } else {

            showAlert(
                '❌ Demande refusée et notification envoyée au membre.',
                'success'
            );
        }

        closeModal('rejectModal');

        selectedRequestId = null;

        await loadRequests();

    } catch (error) {

        console.error(
            '❌ Erreur refus :',
            error
        );

        showAlert(
            '❌ Impossible de refuser cette demande : ' +
            (error.message || 'Erreur inconnue'),
            'error'
        );
    }
}

/* ==========================================================
   CHARGER LES DEMANDES DE CERTIFICATION
   ========================================================== */

async function loadRequests() {

    try {

        console.log('📋 Chargement des demandes de certification...');

        const {
            data: requests,
            error: requestsError
        } = await supabase
           .from('verification_requests')
            .select('*')
            .order('created_at', {
                ascending: false
            });

        if (requestsError) {
            throw requestsError;
        }

        certificationRequests = requests || [];

        console.log(
            '✅ Demandes chargées :',
            certificationRequests.length
        );

        /*
         * Récupérer les profils correspondants
         */
        for (const request of certificationRequests) {

            const {
                data: profile,
                error: profileError
            } = await supabase
                .from('profiles')
                .select(`
                    id,
                    first_name,
                    photo_url,
                    birth_date,
                    gender,
                    city,
                    country,
                    denomination,
                    is_verified
                `)
                .eq('id', request.user_id)
                .single();

            if (!profileError && profile) {

                request.profile = profile;

                request.full_name =
                    profile.first_name ||
                    request.full_name ||
                    'Membre';

            }
        }
updateStats();
renderRequests();

    } catch (error) {

        console.error(
            '❌ Erreur chargement des demandes :',
            error
        );

        showAlert(
            'Impossible de charger les demandes de certification.',
            'error'
        );
    }
}

/* ==========================================================
   METTRE À JOUR LES STATISTIQUES
   ========================================================== */

function updateStats() {

    const totalRequests =
        certificationRequests.length;

    const pendingPayments =
        certificationRequests.filter(
            request =>
                request.status === 'pending' &&
                request.payment_status === 'pending_verification'
        ).length;

    const certifiedCount =
        certificationRequests.filter(
            request =>
                request.status === 'certified'
        ).length;

    const totalElement =
        document.getElementById('totalRequests');

    const pendingElement =
        document.getElementById('pendingPayments');

    const certifiedElement =
        document.getElementById('certifiedCount');

    if (totalElement) {
        totalElement.textContent = totalRequests;
    }

    if (pendingElement) {
        pendingElement.textContent = pendingPayments;
    }

    if (certifiedElement) {
        certifiedElement.textContent = certifiedCount;
    }

    console.log('📊 Statistiques mises à jour :', {
        totalRequests,
        pendingPayments,
        certifiedCount
    });
}

function renderRequests() {

    if (!container) {
        console.error(
            '❌ certificationsContainer introuvable.'
        );
        return;
    }

    if (!certificationRequests.length) {

        container.innerHTML = `
            <div class="empty">
                <div style="font-size:48px;">📋</div>

                <h3>
                    Aucune demande de certification
                </h3>

                <p style="margin-top:10px;">
                    Aucune demande n'a encore été enregistrée.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        certificationRequests.map(request => {

            const profile =
                request.profile || {};

            const name =
                request.full_name ||
                profile.first_name ||
                'Membre';

            const photo =
                profile.photo_url ||
                getDefaultAvatar();

            const age =
                profile.birth_date
                    ? calculateAge(profile.birth_date)
                    : '—';

            const location =
                [
                    profile.city,
                    profile.country
                ]
                .filter(Boolean)
                .join(', ') ||
                'Localisation non renseignée';

            let statusLabel =
                '⏳ En attente';

            let statusClass =
                'status-pending';

            let cardClass =
                'pending';

           if (request.status === 'certified') {

    statusLabel =
        '✅ Certifiée';

    statusClass =
        'status-approved';

    cardClass =
        'approved';
}

            if (request.status === 'rejected') {

                statusLabel =
                    '❌ Refusée';

                statusClass =
                    'status-rejected';

                cardClass =
                    'rejected';
            }

            if (request.status === 'expired') {

                statusLabel =
                    '⚠️ Expirée';

                statusClass =
                    'status-rejected';

                cardClass =
                    'rejected';
            }

            return `

                <div class="request-card ${cardClass}">

                    <div class="request-header">

                        <input
                            type="checkbox"
                            class="selection-box"
                            data-request-id="${escapeHtml(request.id)}"
                            onchange="updateSelection()"
                        >

                        <img
                            src="${escapeHtml(photo)}"
                            class="avatar"
                            alt="Photo de ${escapeHtml(name)}"
                            onerror="this.src='${getDefaultAvatar()}'"
                        >

                        <div class="member-info">

                            <div class="member-name">
                                ${escapeHtml(name)}
                            </div>

                            <div class="member-location">
                                📍 ${escapeHtml(location)}
                            </div>

                            <span
                                class="status-badge ${statusClass}"
                            >
                                ${statusLabel}
                            </span>

                        </div>

                    </div>


                    <div class="section-title">
                        📋 Informations de la demande
                    </div>


                    <div class="info-grid">

                        <div class="info">

                            <span class="info-label">
                                Date de la demande
                            </span>

                            <div class="info-value">
                                ${formatDate(request.created_at)}
                            </div>

                        </div>


                        <div class="info">

                            <span class="info-label">
                                Âge
                            </span>

                            <div class="info-value">
                                ${age !== '—'
                                    ? age + ' ans'
                                    : '—'}
                            </div>

                        </div>


                        ${
                            request.amount !== null &&
                            request.amount !== undefined
                                ? `
                                    <div class="info">

                                        <span class="info-label">
                                            Montant
                                        </span>

                                        <div class="info-value amount">
                                            ${formatAmount(request.amount)}
                                        </div>

                                    </div>
                                `
                                : ''
                        }


                        ${
                            request.transaction_id
                                ? `
                                    <div class="info">

                                        <span class="info-label">
                                            Transaction
                                        </span>

                                        <div class="info-value transaction">
                                            ${escapeHtml(
                                                request.transaction_id
                                            )}
                                        </div>

                                    </div>
                                `
                                : ''
                        }

                    </div>


                    ${
                        request.admin_note
                            ? `
                                <div class="admin-note">

                                    <strong>
                                        📝 Note administrateur
                                    </strong>

                                    <br>

                                    ${escapeHtml(
                                        request.admin_note
                                    )}

                                </div>
                            `
                            : ''
                    }


                    <div class="actions">

                       <button
    type="button"
    class="btn-payment"
    onclick="viewPaymentProof('${request.id}')"
>
    💳 Preuve
</button>


                        <button
                            type="button"
                            class="btn-profile"
                            onclick="viewProfile('${request.user_id}')"
                        >
                            👤 Voir le profil
                        </button>


                        ${
                           request.status === 'certified'
                                ? `
                                    <button
                                        type="button"
                                        class="btn-reject"
                                        onclick="removeCertification('${request.id}')"
                                    >
                                        🔴 Retirer
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="btn-certify"
                                        onclick="certifyProfile('${request.id}')"
                                    >
                                        ✅ Certifier
                                    </button>

                                    <button
                                        type="button"
                                        class="btn-reject"
                                        onclick="rejectCertification('${request.id}')"
                                    >
                                        ❌ Refuser
                                    </button>
                                `
                        }

                    </div>

                </div>

            `;

        }).join('');
}

console.log(
    '🚀 Initialisation des certifications...'
);

const isAdmin =
    await checkAdmin();

if (!isAdmin) {
    return;
}

await loadRequests();

console.log(
    '✅ Gestion des certifications prête.'
);


});
