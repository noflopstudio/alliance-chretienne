/* ==========================================================
   ADMIN PHOTOS - ALLIANCE CHRÉTIENNE
   Modération des photos des membres
========================================================== */

let allPhotos = [];
let currentAdminId = null;

/* ==========================================================
   INITIALISATION
========================================================== */

document.addEventListener('DOMContentLoaded', async () => {

    try {

        console.log('📷 Initialisation admin photos...');

        // Vérifier que Supabase est disponible
        if (!window.supabaseClient) {
            console.error('❌ supabaseClient introuvable');
            showAdminPhotoMessage(
                'Erreur : connexion Supabase introuvable.',
                'error'
            );
            return;
        }

        // Vérifier que l'utilisateur est connecté
        const {
            data: {
                user
            },
            error: authError
        } = await window.supabaseClient.auth.getUser();

        if (authError || !user) {

            console.error(
                '❌ Utilisateur non connecté',
                authError
            );

            showAdminPhotoMessage(
                'Vous devez être connecté pour accéder à cette page.',
                'error'
            );

            return;
        }
currentAdminId = user.id;
      
        const {
            data: profile,
            error: profileError
        } = await window.supabaseClient
            .from('profiles')
            .select('id, first_name, is_admin')
            .eq('id', user.id)
            .single();

        if (profileError) {

            console.error(
                '❌ Erreur vérification administrateur:',
                profileError
            );

            showAdminPhotoMessage(
                'Impossible de vérifier vos droits administrateur.',
                'error'
            );

            return;
        }

        if (!profile || profile.is_admin !== true) {

            console.error(
                '🚫 Accès refusé : utilisateur non administrateur'
            );

            showAdminPhotoMessage(
                '🚫 Accès réservé aux administrateurs.',
                'error'
            );

            return;
        }

        console.log(
            '✅ Administrateur connecté :',
            profile.first_name
        );

        // Charger les photos
        await loadAdminPhotos();

        // Événements recherche / filtre
        setupPhotoFilters();

        // Modal
        setupPhotoModal();

    } catch (error) {

        console.error(
            '❌ Erreur initialisation admin photos:',
            error
        );

        showAdminPhotoMessage(
            'Une erreur est survenue lors du chargement.',
            'error'
        );
    }

});


/* ==========================================================
   CHARGER LES PHOTOS
========================================================== */

async function loadAdminPhotos() {

    const grid =
        document.getElementById('photosModerationGrid');

    if (!grid) return;

    grid.innerHTML = `
        <div class="photos-empty">
            ⏳ Chargement des photos...
        </div>
    `;

    try {

        const {
            data: photos,
            error
        } = await window.supabaseClient
            .from('profile_photos')
.select(`
    id,
    profile_id,
    photo_url,
    is_primary,
    status,
    created_at,
    profiles (
        id,
        first_name,
        is_admin,
        is_verified
    )
`)
            .order('created_at', {
                ascending: false
            });

        if (error) {
            throw error;
        }

        allPhotos = photos || [];

        console.log(
            '📷 Photos chargées :',
            allPhotos.length
        );

        updatePhotoStats();

        renderAdminPhotos(allPhotos);

    } catch (error) {

        console.error(
            '❌ Erreur chargement photos:',
            error
        );

        grid.innerHTML = `
            <div class="photos-empty">

                ❌ Impossible de charger les photos.

                <br><br>

                <small>
                    ${escapeHtml(error.message || '')}
                </small>

            </div>
        `;
    }
}


/* ==========================================================
   STATISTIQUES
========================================================== */

function updatePhotoStats() {

    const total =
        allPhotos.length;

    const pending =
        allPhotos.filter(
            photo => photo.status === 'pending'
        ).length;

    const approved =
        allPhotos.filter(
            photo => photo.status === 'approved'
        ).length;

    const rejected =
        allPhotos.filter(
            photo => photo.status === 'rejected'
        ).length;


    const totalElement =
        document.getElementById('totalPhotos');

    const pendingElement =
        document.getElementById('pendingPhotos');

    const approvedElement =
        document.getElementById('approvedPhotos');

    const rejectedElement =
        document.getElementById('rejectedPhotos');


    if (totalElement) {
        totalElement.textContent = total;
    }

    if (pendingElement) {
        pendingElement.textContent = pending;
    }

    if (approvedElement) {
        approvedElement.textContent = approved;
    }

    if (rejectedElement) {
        rejectedElement.textContent = rejected;
    }

}


/* ==========================================================
   AFFICHER LES PHOTOS
========================================================== */

function renderAdminPhotos(photos) {

    const grid =
        document.getElementById('photosModerationGrid');

    if (!grid) return;

    grid.innerHTML = '';


    if (!photos || photos.length === 0) {

        grid.innerHTML = `
            <div class="photos-empty">

                📷 Aucune photo trouvée.

            </div>
        `;

        return;
    }


    photos.forEach(photo => {

        const card =
            document.createElement('article');

        card.className =
            'photo-moderation-card';


        const profile =
            Array.isArray(photo.profiles)
                ? photo.profiles[0]
                : photo.profiles;


        const memberName =
            profile?.first_name ||
            'Membre';


        const status =
            photo.status || 'approved';


        const statusLabel =
            getStatusLabel(status);


        const date =
            formatPhotoDate(
                photo.created_at
            );


        card.innerHTML = `

            <div
                class="photo-preview"
                onclick="openPhotoModal('${escapeAttribute(photo.photo_url)}')"
            >

                <img
                    src="${escapeAttribute(photo.photo_url)}"
                    alt="Photo de ${escapeAttribute(memberName)}"
                    loading="lazy"
                    onerror="this.src='${escapeAttribute(getDefaultAdminAvatar())}'"
                >

                <span
                    class="photo-status-badge photo-status-${escapeAttribute(status)}"
                >
                    ${statusLabel}
                </span>

            </div>


            <div class="photo-card-content">

                <div class="photo-member-name">
                    👤 ${escapeHtml(memberName)}
                </div>


                <div class="photo-date">
                    📅 ${date}
                </div>


                ${
                    photo.is_primary
                        ? `
                            <div
                                style="
                                    font-size: 0.8rem;
                                    margin-bottom: 0.8rem;
                                    opacity: 0.8;
                                "
                            >
                                ⭐ Photo principale
                            </div>
                        `
                        : ''
                }


                <div class="photo-actions">

                    <button
                        type="button"
                        class="photo-action-btn photo-view-btn"
                        onclick="openPhotoModal('${escapeAttribute(photo.photo_url)}')"
                    >
                        👁️ Voir
                    </button>


                    ${
                        status === 'pending'
                            ? `
                                <button
                                    type="button"
                                    class="photo-action-btn photo-approve-btn"
                                    onclick="approvePhoto('${photo.id}')"
                                >
                                    ✅ Approuver
                                </button>

                                <button
                                    type="button"
                                    class="photo-action-btn photo-reject-btn"
                                    onclick="rejectPhoto('${photo.id}')"
                                >
                                    ❌ Rejeter
                                </button>
                            `
                            : ''
                    }

                </div>

            </div>

        `;


        grid.appendChild(card);

    });

}


/* ==========================================================
   LIBELLÉS DES STATUTS
========================================================== */

function getStatusLabel(status) {

    switch (status) {

        case 'pending':
            return '⏳ En attente';

        case 'approved':
            return '✅ Approuvée';

        case 'rejected':
            return '❌ Rejetée';

        default:
            return '❓ Inconnu';
    }

}

async function approvePhoto(photoId) {

    if (!photoId) return;

    const client = window.supabaseClient;

    if (!client) {
        showAdminPhotoMessage(
            'Client Supabase indisponible.',
            'error'
        );
        return;
    }

    const photo = allPhotos.find(
        item => item.id === photoId
    );

    if (!photo) {
        showAdminPhotoMessage(
            'Photo introuvable.',
            'error'
        );
        return;
    }

    if (photo.status === 'approved') {
        showAdminPhotoMessage(
            'Cette photo est déjà approuvée.',
            'info'
        );
        return;
    }

    const confirmed = confirm(
        'Voulez-vous vraiment approuver cette photo ?'
    );

    if (!confirmed) return;

    try {

        const { error: updateError } = await client
    .from('profile_photos')
    .update({
        status: 'approved'
    })
    .eq('id', photoId);

if (updateError) {
    throw updateError;
}

console.log(
    '✅ Statut de la photo mis à jour : approved',
    photoId
);


// 🔔 NOTIFIER LE MEMBRE
const { error: notificationError } = await client
    .from('notifications')
    .insert([{
        recipient_id: photo.profile_id,
        sender_id: (await client.auth.getUser()).data.user.id,
        type: 'photo_approved',
        content: '📷 Votre photo a été approuvée et est maintenant visible sur votre profil.',
        data: {
            photo_id: photoId,
            photo_url: photo.photo_url,
            status: 'approved'
        }
    }]);

if (notificationError) {
    console.error(
        '⚠️ Erreur notification approbation photo:',
        notificationError
    );
}

        const {
            data: approvedPhotos,
            error: approvedError
        } = await client
            .from('profile_photos')
            .select(
                'id, photo_url, is_primary, created_at, status'
            )
            .eq(
                'profile_id',
                photo.profile_id
            )
            .eq(
                'status',
                'approved'
            )
            .order(
                'created_at',
                {
                    ascending: true
                }
            );

        if (approvedError) {
            throw approvedError;
        }


        // ==================================================
        // 3. CHOISIR LA PHOTO PRINCIPALE
        // ==================================================

        let primaryPhoto =
            approvedPhotos.find(
                item => item.is_primary === true
            );

        // S'il existe déjà une photo principale,
        // on la conserve.
        //
        // Si aucune photo principale n'existe,
        // la photo que nous venons d'approuver
        // devient principale.

        if (!primaryPhoto) {

            primaryPhoto =
                approvedPhotos.find(
                    item => item.id === photoId
                ) ||
                approvedPhotos[0];

        }


        // ==================================================
        // 4. SÉCURISER LA PHOTO PRINCIPALE
        // ==================================================

        if (primaryPhoto) {

            const {
                error: resetError
            } = await client
                .from('profile_photos')
                .update({
                    is_primary: false
                })
                .eq(
                    'profile_id',
                    photo.profile_id
                )
                .neq(
                    'id',
                    primaryPhoto.id
                );

            if (resetError) {
                throw resetError;
            }


            const {
                error: primaryError
            } = await client
                .from('profile_photos')
                .update({
                    is_primary: true
                })
                .eq(
                    'id',
                    primaryPhoto.id
                );

            if (primaryError) {
                throw primaryError;
            }


            // ==================================================
            // 5. SYNCHRONISER profiles.photo_url
            // ==================================================

            const {
                error: profileError
            } = await client
                .from('profiles')
                .update({
                    photo_url: primaryPhoto.photo_url
                })
                .eq(
                    'id',
                    photo.profile_id
                );

            if (profileError) {
                throw profileError;
            }
        }


        // ==================================================
        // 6. MESSAGE + RECHARGEMENT
        // ==================================================

        showAdminPhotoMessage(
            '✅ Photo approuvée avec succès.',
            'success'
        );

        await loadAdminPhotos();

    } catch (error) {

        console.error(
            '❌ Erreur approbation photo:',
            error
        );

        showAdminPhotoMessage(
            '❌ Erreur lors de l’approbation : ' +
            (error.message || 'Erreur inconnue'),
            'error'
        );
    }
}

async function rejectPhoto(photoId) {

    if (!photoId) return;


    const photo =
        allPhotos.find(
            item => item.id === photoId
        );


    if (!photo) {

        showAdminPhotoMessage(
            'Photo introuvable.',
            'error'
        );

        return;
    }


    if (photo.status === 'rejected') {

        showAdminPhotoMessage(
            'Cette photo est déjà rejetée.',
            'info'
        );

        return;
    }


    const confirmed =
        confirm(
            'Voulez-vous vraiment rejeter cette photo ?'
        );


    if (!confirmed) return;


    try {

        const {
            error
        } = await window.supabaseClient
            .from('profile_photos')
            .update({
                status: 'rejected',
                is_primary: false
            })
            .eq(
                'id',
                photoId
            );


        if (error) {
            throw error;
        }

// ==================================================
// NOTIFICATION AU MEMBRE
// ==================================================

const { error: notificationError } =
    await window.supabaseClient
        .from('notifications')
        .insert([{
            recipient_id: photo.profile_id,
           sender_id: (await window.supabaseClient.auth.getUser()).data.user.id,
            type: 'photo_rejected',
            content: '📷 Votre photo a été rejetée par l’administration. Veuillez envoyer une nouvelle photo conforme aux règles de la communauté.',
            data: {
                photo_id: photoId,
                photo_url: photo.photo_url,
                status: 'rejected'
            }
        }]);

if (notificationError) {
    console.error(
        '⚠️ Erreur notification rejet photo :',
        notificationError
    );
}


        // Si cette photo était principale,
        // chercher une autre photo approuvée.
        if (photo.is_primary) {

            await restoreApprovedPrimaryPhoto(
                photo.profile_id,
                photoId
            );

        }


        showAdminPhotoMessage(
            '❌ Photo rejetée.',
            'success'
        );


        await loadAdminPhotos();


    } catch (error) {

        console.error(
            '❌ Erreur rejet photo:',
            error
        );


        showAdminPhotoMessage(
            'Erreur lors du rejet : ' +
            (error.message || 'Erreur inconnue'),
            'error'
        );

    }

}


/* ==========================================================
   RESTAURER UNE PHOTO PRINCIPALE APPROUVÉE
========================================================== */

async function restoreApprovedPrimaryPhoto(
    profileId,
    rejectedPhotoId
) {

    const client =
        window.supabaseClient;


    const {
        data: approvedPhotos,
        error
    } = await client
        .from('profile_photos')
        .select(
            'id, photo_url, created_at'
        )
        .eq(
            'profile_id',
            profileId
        )
        .eq(
            'status',
            'approved'
        )
        .neq(
            'id',
            rejectedPhotoId
        )
        .order(
            'created_at',
            {
                ascending: true
            }
        );


    if (error) {
        throw error;
    }


    if (
        !approvedPhotos ||
        approvedPhotos.length === 0
    ) {

        // Plus aucune photo approuvée
        // donc retirer la photo publique du profil.
        const {
            error: profileError
        } = await client
            .from('profiles')
            .update({
                photo_url: null
            })
            .eq(
                'id',
                profileId
            );


        if (profileError) {
            throw profileError;
        }

        return;
    }


    const newPrimary =
        approvedPhotos[0];


    // Toutes les autres ne sont pas principales
    const {
        error: resetError
    } = await client
        .from('profile_photos')
        .update({
            is_primary: false
        })
        .eq(
            'profile_id',
            profileId
        );


    if (resetError) {
        throw resetError;
    }


    // Nouvelle principale
    const {
        error: primaryError
    } = await client
        .from('profile_photos')
        .update({
            is_primary: true
        })
        .eq(
            'id',
            newPrimary.id
        );


    if (primaryError) {
        throw primaryError;
    }


    // Mettre à jour le profil
    const {
        error: profileError
    } = await client
        .from('profiles')
        .update({
            photo_url:
                newPrimary.photo_url
        })
        .eq(
            'id',
            profileId
        );


    if (profileError) {
        throw profileError;
    }

}


/* ==========================================================
   RECHERCHE + FILTRE
========================================================== */

function setupPhotoFilters() {

    const searchInput =
        document.getElementById('photoSearch');

    const statusFilter =
        document.getElementById(
            'photoStatusFilter'
        );


    if (searchInput) {

        searchInput.addEventListener(
            'input',
            applyPhotoFilters
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            'change',
            applyPhotoFilters
        );

    }

}


/* ==========================================================
   APPLIQUER LES FILTRES
========================================================== */

function applyPhotoFilters() {

    const searchInput =
        document.getElementById('photoSearch');

    const statusFilter =
        document.getElementById(
            'photoStatusFilter'
        );


    const search =
        (
            searchInput?.value ||
            ''
        )
        .trim()
        .toLowerCase();


    const status =
        statusFilter?.value ||
        'all';


    const filtered =
        allPhotos.filter(photo => {

            const profile =
                Array.isArray(photo.profiles)
                    ? photo.profiles[0]
                    : photo.profiles;


            const name =
                (
                    profile?.first_name ||
                    ''
                )
                .toLowerCase();


            const matchesSearch =
                !search ||
                name.includes(search);


            const matchesStatus =
                status === 'all' ||
                photo.status === status;


            return (
                matchesSearch &&
                matchesStatus
            );

        });


    renderAdminPhotos(filtered);

}


/* ==========================================================
   MODAL PHOTO
========================================================== */

function setupPhotoModal() {

    const modal =
        document.getElementById('photoModal');

    const closeButton =
        document.getElementById(
            'photoModalClose'
        );


    if (!modal) return;


    if (closeButton) {

        closeButton.addEventListener(
            'click',
            closePhotoModal
        );

    }


    modal.addEventListener(
        'click',
        event => {

            if (event.target === modal) {
                closePhotoModal();
            }

        }
    );


    document.addEventListener(
        'keydown',
        event => {

            if (
                event.key === 'Escape' &&
                modal.classList.contains('active')
            ) {

                closePhotoModal();

            }

        }
    );

}


/* ==========================================================
   OUVRIR MODAL
========================================================== */

function openPhotoModal(photoUrl) {

    const modal =
        document.getElementById('photoModal');

    const image =
        document.getElementById(
            'photoModalImage'
        );


    if (!modal || !image) return;


    image.src =
        photoUrl;


    modal.classList.add(
        'active'
    );

}


/* ==========================================================
   FERMER MODAL
========================================================== */

function closePhotoModal() {

    const modal =
        document.getElementById('photoModal');

    const image =
        document.getElementById(
            'photoModalImage'
        );


    if (!modal) return;


    modal.classList.remove(
        'active'
    );


    if (image) {
        image.src = '';
    }

}


/* ==========================================================
   MESSAGE ADMIN
========================================================== */

function showAdminPhotoMessage(
    message,
    type = 'info'
) {

    let container =
        document.getElementById(
            'adminPhotoMessage'
        );


    if (!container) {

        container =
            document.createElement('div');

        container.id =
            'adminPhotoMessage';

        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 380px;
            padding: 14px 18px;
            border-radius: 12px;
            background: #111827;
            color: white;
            box-shadow: 0 8px 30px rgba(0,0,0,0.18);
            z-index: 10000;
            font-size: 0.9rem;
            font-weight: 600;
        `;

        document.body.appendChild(
            container
        );

    }


    container.textContent =
        message;


    if (type === 'success') {

        container.style.background =
            '#16a34a';

    } else if (type === 'error') {

        container.style.background =
            '#dc2626';

    } else {

        container.style.background =
            '#374151';

    }


    clearTimeout(
        window.adminPhotoMessageTimer
    );


    window.adminPhotoMessageTimer =
        setTimeout(() => {

            container.remove();

        }, 4000);

}


/* ==========================================================
   FORMAT DATE
========================================================== */

function formatPhotoDate(
    dateString
) {

    if (!dateString) {
        return 'Date inconnue';
    }


    try {

        const date =
            new Date(dateString);


        return date.toLocaleString(
            'fr-FR',
            {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }
        );

    } catch (error) {

        return 'Date inconnue';

    }

}


/* ==========================================================
   AVATAR PAR DÉFAUT
========================================================== */

function getDefaultAdminAvatar() {

    // Même logique simple que le reste du site
    return (
        'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="600"
                height="750"
                viewBox="0 0 600 750"
            >
                <rect
                    width="600"
                    height="750"
                    fill="#e5e7eb"
                />
                <circle
                    cx="300"
                    cy="270"
                    r="100"
                    fill="#9ca3af"
                />
                <path
                    d="
                        M120 650
                        C120 500 210 430 300 430
                        C390 430 480 500 480 650
                        Z
                    "
                    fill="#9ca3af"
                />
            </svg>
        `)
    );

}


/* ==========================================================
   SÉCURISER LE HTML
========================================================== */

function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

}


/* ==========================================================
   SÉCURISER LES ATTRIBUTS HTML
========================================================== */

function escapeAttribute(value) {

    return escapeHtml(value);

}