
let allProfiles = [];
let currentUser = null;

// ===== 🟢🟢 STATUT EN LIGNE =====

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

function isProfileOnline(profile) {

    if (!profile.last_seen) {
        return false;
    }

    const lastSeen = new Date(profile.last_seen).getTime();
    const now = Date.now();

    // 🟢 Moins de 2 minutes = en ligne
    return (now - lastSeen) < 2 * 60 * 1000;
}

function startPresence() {

    updateMyLastSeen();

    setInterval(() => {
        updateMyLastSeen();
    }, 30 * 1000);

    document.addEventListener('visibilitychange', () => {

        if (!document.hidden) {
            updateMyLastSeen();
        }

    });

    window.addEventListener('focus', () => {
        updateMyLastSeen();
    });
}

document.addEventListener('DOMContentLoaded', async () => {

    currentUser = await requireAuth();
if (!currentUser) return;

// 🟢 Démarrer le système de présence
startPresence();

await loadProfiles();

    document.getElementById('searchBtn').addEventListener('click', filterProfiles);
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    document.getElementById('resetBtnAlt').addEventListener('click', resetFilters);
    document.getElementById('logoutButton').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
});

// ===== 🔄 ACTUALISER LES STATUTS DES PROFILS =====

async function refreshProfileStatuses() {

    const statusElements =
        document.querySelectorAll(
            '.online-status-dot[data-profile-status-id]'
        );

    if (statusElements.length === 0) return;

    const profileIds = [...statusElements].map(
        element => element.dataset.profileStatusId
    );

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

    } catch (error) {

        console.error(
            '❌ Erreur refreshProfileStatuses :',
            error
        );
    }
}

// ===== CHARGER TOUS LES PROFILS =====
async function loadProfiles() {
    const loadingContainer = document.getElementById('loadingContainer');
    const profilesContainer = document.getElementById('profilesContainer');
    
    loadingContainer.style.display = 'block';
    profilesContainer.innerHTML = '';

    try {
        // Récupérer tous les profils sauf celui de l'utilisateur connecté
       const { data, error } = await window.supabaseClient
    .from('profiles')
            .select('*')
            .neq('id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erreur:', error);
            showAlert('Erreur lors du chargement des profils', 'error');
            loadingContainer.style.display = 'none';
            return;
        }

       allProfiles = data || [];

console.log('🔎 PROFILS CHARGÉS :', allProfiles);

console.log(
    '🔵 CERTIFICATION :',
    allProfiles.map(p => ({
        nom: p.first_name,
        is_verified: p.is_verified,
        type: typeof p.is_verified
    }))
);
allProfiles.forEach(profile => {
    console.log(
        '👤',
        profile.first_name,
        '| is_certified =',
        profile.is_certified,
        '| type =',
        typeof profile.is_certified
    );
});

loadingContainer.style.display = 'none';

        if (allProfiles.length === 0) {
            showNoResults();
        } else {
            displayProfiles(allProfiles);
        }

    } catch (error) {
        console.error('Erreur:', error);
        showAlert('Erreur: ' + error.message, 'error');
        loadingContainer.style.display = 'none';
    }
}

// ===== AFFICHER LES PROFILS =====
function displayProfiles(profiles) {
    const profilesContainer = document.getElementById('profilesContainer');
    const noResultsContainer = document.getElementById('noResultsContainer');

    profilesContainer.innerHTML = '';
    noResultsContainer.style.display = 'none';

    if (profiles.length === 0) {
        showNoResults();
        return;
    }

    profiles.forEach(profile => {
        const age = calculateAge(profile.birth_date);
        const profileCard = createProfileCard(profile, age);
        profilesContainer.appendChild(profileCard);
    });
}

function getCountryFlag(country) {

    const countries = {
        "Côte d'Ivoire": "🇨🇮",
        "France": "🇫🇷",
        "Sénégal": "🇸🇳",
        "Mali": "🇲🇱",
        "Burkina Faso": "🇧🇫",
        "Guinée": "🇬🇳",
        "Bénin": "🇧🇯",
        "Togo": "🇹🇬",
        "Ghana": "🇬🇭",
        "Nigeria": "🇳🇬",
        "Cameroun": "🇨🇲",
        "Congo": "🇨🇬",
        "République démocratique du Congo": "🇨🇩",
        "Gabon": "🇬🇦",
        "Maroc": "🇲🇦",
        "Algérie": "🇩🇿",
        "Tunisie": "🇹🇳",
        "Canada": "🇨🇦",
        "États-Unis": "🇺🇸",
        "Belgique": "🇧🇪",
        "Suisse": "🇨🇭",
        "Royaume-Uni": "🇬🇧"
    };

    return countries[country] || "🌍";
}

function createProfileCard(profile, age) {

    const card = document.createElement('div');
    card.className = 'profile-card';

 const photoUrl =
    profile.photo_url ||
    'images/profil-default.jpeg';
    card.innerHTML = `

        <div class="profile-card-image">

            <img
                src="${photoUrl}"
                alt="${profile.first_name || 'Profil'}"
                style="
                    width: 100%;
                    height: 280px;
                    object-fit: cover;
                    object-position: center;
                    display: block;
                "
                onerror="
                   this.src='images/profil-default.jpeg'
                "
            >


            <!-- =================================
                 ACTIONS
            ================================== -->

            <div class="profile-card-actions-overlay">

                <!-- 👋 PASSER -->

                <button
                    type="button"
                    class="btn-pass"
                    onclick="passProfile('${profile.id}')"
                    title="Passer"
                >
                    👋
                </button>


                <!-- ❤️ LIKER -->

                <button
                    type="button"
                    class="btn-like"
                    onclick="likeProfile(
                        '${profile.id}',
                        '${(profile.first_name || 'Utilisateur')
                            .replace(/'/g, "\\'")}'
                    )"
                    title="Liker"
                >
                    ❤️
                </button>


                <!-- 👁️ VOIR LE PROFIL -->

                <button
                    type="button"
                    class="btn-message"
                    onclick="viewProfile('${profile.id}')"
                    title="Voir le profil"
                >
                    👁️
                </button>

            </div>

        </div>

        <div class="profile-card-content">

          <div
    class="profile-card-name"
    style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
    "
>

    <div
        style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
            flex-wrap: wrap;
        "
    >

     <span class="profile-name-with-status">

    <span
        class="online-status-dot ${isProfileOnline(profile) ? 'online' : 'offline'}"
        data-profile-status-id="${profile.id}"
        title="${isProfileOnline(profile) ? 'En ligne' : 'Hors ligne'}">
    </span>

    <span>
        ${profile.first_name || 'Utilisateur'}, ${age} ans
    </span>

</span>

        ${
            profile.is_verified === true
            ? `
                <svg
                    class="facebook-verified-badge"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    title="Compte certifié"
                >
                    <path
                        fill="#1877F2"
                        d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
                    />
                    <path
                        fill="#FFFFFF"
                        d="M10.5 15.5l-3.5-3.5 1.414-1.414L10.5 12.672l6.086-6.086L18 8z"
                    />
                </svg>
            `
            : ''
        }

    </div>

    ${
        profile.country
        ? `
            <div
                style="
                    font-size: 13px;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                "
            >
                <span>${getCountryFlag(profile.country)}</span>
                <span>${profile.country}</span>
            </div>
        `
        : ''
    }

</div>

        </div>

    `;

    return card;
}

async function likeProfile(likedUserId, firstName) {

    console.log('❤️ likeProfile appelée', likedUserId, firstName);
    console.log('👤 Utilisateur connecté :', currentUser.id);
    console.log('🎯 Profil liké :', likedUserId);

    try {

        console.log('🔵 ÉTAPE A : vérification du like existant');

        const {
            data: existingLike,
            error: existingLikeError
        } = await window.supabaseClient
            .from('likes')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('liked_user_id', likedUserId)
            .maybeSingle();

        console.log('🔵 ÉTAPE B : réponse vérification like');
        console.log('📦 Like existant :', existingLike);
        console.log('❌ Erreur vérification :', existingLikeError);

        if (existingLikeError) {

            console.error(
                '❌ ERREUR LECTURE TABLE LIKES :',
                existingLikeError
            );

            showAlert(
                'Erreur lors de la vérification du like : ' +
                existingLikeError.message,
                'error'
            );

            return;
        }

     
        if (existingLike) {

            console.log('⚠️ Ce profil est déjà liké');
            console.log('ℹ️ Aucun nouveau like ni notification.');

            return;
        }

        console.log(
            '🟢 ÉTAPE C : aucun like existant, on continue'
        );

        console.log('🟡 ÉTAPE 1 : avant INSERT likes');

        const { error } = await window.supabaseClient
            .from('likes')
            .insert([{
                user_id: currentUser.id,
                liked_user_id: likedUserId
            }]);

        console.log('🟢 ÉTAPE 2 : après INSERT likes');

        if (error) {

            console.error(
                '❌ ERREUR INSERT LIKE :',
                error
            );

            showAlert(
                'Erreur lors du like : ' + error.message,
                'error'
            );

            return;
        }

        console.log('✅ Like enregistré dans la base');

        console.log('🔔 ÉTAPE 3 : création notification');
        console.log('📩 recipient_id :', likedUserId);
        console.log('👤 sender_id :', currentUser.id);

        const notificationData = {

            recipient_id: likedUserId,

            sender_id: currentUser.id,

            type: 'like',

            content: `❤️ ${firstName} a aimé votre profil`,

            data: {
                sender_id: currentUser.id,
                sender_name: firstName,
                profile_id: currentUser.id,
                liked_profile_id: likedUserId
            },

            is_read: false
        };

        console.log(
            '📦 Notification à envoyer :',
            notificationData
        );

        const { error: notificationError } =
            await window.supabaseClient
                .from('notifications')
                .insert([notificationData]);

        if (notificationError) {

            console.error(
                '❌ ERREUR NOTIFICATION :',
                notificationError
            );

            console.error(
                '❌ Message :',
                notificationError.message
            );

            console.error(
                '❌ Code :',
                notificationError.code
            );

            console.error(
                '❌ Details :',
                notificationError.details
            );

            showAlert(
                'Like enregistré, mais notification impossible',
                'error'
            );

        } else {

            console.log(
                '✅ ❤️ NOTIFICATION LIKE CRÉÉE'
            );
        }

        await checkForMatch(likedUserId);

    } catch (error) {

        console.error(
            'Erreur:',
            error
        );

        showAlert(
            'Erreur: ' + error.message,
            'error'
        );
    }
}

async function checkForMatch(likedUserId) {

    try {

        const client = window.supabaseClient;

        if (!client) {
            throw new Error('Client Supabase introuvable');
        }

        console.log('💕 Vérification du match...');
        console.log('👤 Moi :', currentUser.id);
        console.log('❤️ Utilisateur liké :', likedUserId);

        const {
            data: mutualLike,
            error: mutualLikeError
        } = await client
            .from('likes')
            .select('*')
            .eq('user_id', likedUserId)
            .eq('liked_user_id', currentUser.id)
            .maybeSingle();

        if (mutualLikeError) {

            console.error(
                '❌ Erreur vérification du like réciproque :',
                mutualLikeError
            );

            return;
        }

        if (!mutualLike) {

            console.log(
                'ℹ️ Aucun match pour le moment.'
            );

            return;
        }

        console.log('💕 MATCH DÉTECTÉ !');

        const {
            data: currentProfile,
            error: currentProfileError
        } = await client
            .from('profiles')
            .select('first_name, photo_url')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (currentProfileError) {

            console.error(
                '❌ Erreur récupération mon profil :',
                currentProfileError
            );
        }

        const {
            data: otherProfile,
            error: otherProfileError
        } = await client
            .from('profiles')
            .select('first_name, photo_url')
            .eq('id', likedUserId)
            .maybeSingle();

        if (otherProfileError) {

            console.error(
                '❌ Erreur récupération autre profil :',
                otherProfileError
            );
        }

        const myName =
            currentProfile?.first_name ||
            'Utilisateur';

        const otherName =
            otherProfile?.first_name ||
            'Utilisateur';

        console.log(
            '🔔 Création notification MATCH pour l’autre'
        );

        const notificationOtherData = {

            recipient_id: likedUserId,

            sender_id: currentUser.id,

            type: 'match',

            content:
                `C'est un match avec ${myName} ! 💕`,

            data: {

                sender_id: currentUser.id,

                sender_name: myName,

                avatar:
                    currentProfile?.photo_url || null
            },

            is_read: false
        };

        const {
            error: notificationOtherError
        } = await client
            .from('notifications')
            .insert([notificationOtherData]);

        if (notificationOtherError) {

            console.error(
                '❌ Erreur notification MATCH pour l’autre :',
                notificationOtherError
            );

        } else {

            console.log(
                '✅ Notification MATCH créée pour l’autre'
            );
        }

        console.log(
            '🔔 Création notification MATCH pour moi'
        );

        const notificationMeData = {

            recipient_id: currentUser.id,

            sender_id: likedUserId,

            type: 'match',

            content:
                `C'est un match avec ${otherName} ! 💕`,

            data: {

                sender_id: likedUserId,

                sender_name: otherName,

                avatar:
                    otherProfile?.photo_url || null
            },

            is_read: false
        };

        const {
            error: notificationMeError
        } = await client
            .from('notifications')
            .insert([notificationMeData]);

        if (notificationMeError) {

            console.error(
                '❌ Erreur notification MATCH pour moi :',
                notificationMeError
            );

        } else {

            console.log(
                '✅ Notification MATCH créée pour moi'
            );
        }

        showAlert(
            '🎉 C\'est un MATCH ! Allez voir vos messages !',
            'success'
        );

    } catch (error) {

        console.error(
            '❌ Erreur lors de la vérification du match :',
            error
        );
    }
}
// ===== PASSER UN PROFIL =====
function passProfile(profileId) {
    // Simplement supprimer la carte du DOM
    const profileCards = document.querySelectorAll('.profile-card');
    profileCards.forEach(card => {
        const likeBtn = card.querySelector('.btn-like');
        if (likeBtn && likeBtn.onclick.toString().includes(profileId)) {
            card.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => card.remove(), 300);
        }
    });
}

async function viewProfile(userId) {

try {

    const { data: profile, error: profileError } =
        await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

    if (profileError) {
        console.error('❌ Erreur profil:', profileError);
        showAlert('Erreur lors du chargement du profil', 'error');
        return;
    }

    const { data: photos, error: photosError } =
        await window.supabaseClient
            .from('profile_photos')
            .select('*')
            .eq('profile_id', userId)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true });

    if (photosError) {
        console.error('❌ Erreur photos:', photosError);
    }

    let profilePhotos = photos || [];

    if (profilePhotos.length === 0 && profile.photo_url) {
        profilePhotos = [{
            id: 'profile-main',
            photo_url: profile.photo_url,
            is_primary: true
        }];
    }

    const age = calculateAge(profile.birth_date);

    const modal = document.createElement('div');

    modal.className = 'profile-modal-overlay';

    let currentPhotoIndex = 0;


    const getPhotoUrl = (index) => {

        if (profilePhotos.length === 0) {
           return 'images/profil-default.jpeg';
        }

        return profilePhotos[index].photo_url;
    };

    modal.innerHTML = `

        <div class="profile-modal">

            <!-- FERMER -->

            <button
                type="button"
                class="profile-modal-close"
                id="closeProfileModal"
                aria-label="Fermer"
            >
                ✕
            </button>

            <div class="profile-modal-gallery">

                <img
                    id="profileGalleryImage"
                    src="${getPhotoUrl(0)}"
                    alt="${profile.first_name || 'Profil'}"
                    class="profile-modal-main-image"
                >

                ${
                    profilePhotos.length > 1
                    ? `
                        <button
                            type="button"
                            id="prevPhotoBtn"
                            class="profile-gallery-arrow profile-gallery-prev"
                            aria-label="Photo précédente"
                        >
                            ‹
                        </button>

                        <button
                            type="button"
                            id="nextPhotoBtn"
                            class="profile-gallery-arrow profile-gallery-next"
                            aria-label="Photo suivante"
                        >
                            ›
                        </button>
                    `
                    : ''
                }


                <div
                    id="photoCounterModal"
                    class="profile-photo-counter"
                >
                    ${
                        profilePhotos.length > 0
                        ? `1 / ${profilePhotos.length}`
                        : '0 / 0'
                    }
                </div>

            </div>

            ${
                profilePhotos.length > 1
                ? `
                    <div
                        id="photoThumbnails"
                        class="profile-photo-thumbnails"
                    >

                        ${profilePhotos.map((photo, index) => `
                            <img
                                src="${photo.photo_url}"
                                data-index="${index}"
                                class="profile-photo-thumbnail ${index === 0 ? 'active' : ''}"
                                alt="Photo ${index + 1}"
                              onerror="this.src='images/profil-default.jpeg'"
                            >
                        `).join('')}

                    </div>
                `
                : ''
            }

            <div class="profile-modal-identity">

                <div class="profile-modal-name">

                    <h2>
                        ${profile.first_name || 'Utilisateur'}, ${age} ans
                    </h2>

                    ${
                        profile.is_verified === true
                        ? `
                            <svg
                                class="profile-modal-verified"
                                viewBox="0 0 24 24"
                                width="21"
                                height="21"
                                title="Compte certifié"
                            >
                                <path
                                    fill="#1877F2"
                                    d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
                                />
                                <path
                                    fill="#FFFFFF"
                                    d="M10.5 15.5l-3.5-3.5 1.414-1.414L10.5 12.672l6.086-6.086L18 8z"
                                />
                            </svg>
                        `
                        : ''
                    }

                </div>


                <p class="profile-modal-location">
                    📍 ${profile.city || 'Ville non renseignée'}${profile.country ? ', ' + profile.country : ''}
                </p>

            </div>

            <section class="profile-info-box spiritual-box">

                <h3>
                    🙏 Informations spirituelles
                </h3>

                <div class="profile-info-list">

                    <div>
                        <strong>Dénomination</strong>
                        <span>${profile.denomination || 'Non spécifié'}</span>
                    </div>

                    <div>
                        <strong>Fréquence à l'église</strong>
                        <span>${profile.church_frequency || 'Non spécifié'}</span>
                    </div>

                    <div>
                        <strong>Engagement</strong>
                        <span>${profile.faith_engagement || 'Non spécifié'}</span>
                    </div>

                    ${
                        profile.favorite_verse
                        ? `
                            <div>
                                <strong>Verset préféré</strong>
                                <span>"${profile.favorite_verse}"</span>
                            </div>
                        `
                        : ''
                    }

                </div>

            </section>

            ${
                profile.bio
                ? `
                    <section class="profile-info-box about-box">

                        <h3>
                            💭 À propos
                        </h3>

                        <p>
                            ${profile.bio}
                        </p>

                    </section>
                `
                : ''
            }

            ${
                profile.looking_for
                ? `
                    <section class="profile-info-box looking-box">

                        <h3>
                            💕 Ce qu'il/elle recherche
                        </h3>

                        <p>
                            ${profile.looking_for}
                        </p>

                    </section>
                `
                : ''
            }

            <div class="profile-modal-actions">

                <button
                    type="button"
                    class="profile-modal-like"
                    id="modalLikeButton"
                >
                    ❤️ Liker
                </button>

                <button
                    type="button"
                    class="profile-modal-message"
                    id="modalMessageButton"
                >
                    💬 Message
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(modal);

    const galleryImage =
        modal.querySelector('#profileGalleryImage');

    const counter =
        modal.querySelector('#photoCounterModal');

    const thumbnails =
        modal.querySelectorAll('.profile-photo-thumbnail');


    function showPhoto(index) {

        if (profilePhotos.length === 0) return;

        if (index < 0) {
            index = profilePhotos.length - 1;
        }

        if (index >= profilePhotos.length) {
            index = 0;
        }

        currentPhotoIndex = index;

        galleryImage.src =
            profilePhotos[index].photo_url;

        counter.textContent =
            `${index + 1} / ${profilePhotos.length}`;


        thumbnails.forEach((thumbnail, thumbnailIndex) => {

            thumbnail.classList.toggle(
                'active',
                thumbnailIndex === index
            );

        });

    }


    const prevBtn =
        modal.querySelector('#prevPhotoBtn');

    if (prevBtn) {

        prevBtn.addEventListener(
            'click',
            () => showPhoto(currentPhotoIndex - 1)
        );

    }


    const nextBtn =
        modal.querySelector('#nextPhotoBtn');

    if (nextBtn) {

        nextBtn.addEventListener(
            'click',
            () => showPhoto(currentPhotoIndex + 1)
        );

    }

    thumbnails.forEach(thumbnail => {

        thumbnail.addEventListener(
            'click',
            () => {

                showPhoto(
                    parseInt(
                        thumbnail.dataset.index
                    )
                );

            }
        );

    });

    const closeBtn =
        modal.querySelector('#closeProfileModal');

    closeBtn.addEventListener(
        'click',
        () => modal.remove()
    );

    modal.addEventListener(
        'click',
        function(event) {

            if (event.target === modal) {
                modal.remove();
            }

        }
    );

    const likeButton =
        modal.querySelector('#modalLikeButton');

    likeButton.addEventListener(
        'click',
        async function() {

            await likeProfile(
                profile.id,
                profile.first_name
            );

            modal.remove();

        }
    );

    const messageButton =
        modal.querySelector('#modalMessageButton');

    messageButton.addEventListener(
        'click',
        function() {

            startChat(
                profile.id,
                profile.first_name
            );

            modal.remove();

        }
    );

    function handleKeyboard(event) {

        if (!document.body.contains(modal)) {

            document.removeEventListener(
                'keydown',
                handleKeyboard
            );

            return;
        }


        if (event.key === 'ArrowLeft') {
            showPhoto(currentPhotoIndex - 1);
        }


        if (event.key === 'ArrowRight') {
            showPhoto(currentPhotoIndex + 1);
        }


        if (event.key === 'Escape') {
            modal.remove();
        }

    }

    document.addEventListener(
        'keydown',
        handleKeyboard
    );

    const observer =
        new MutationObserver(() => {

            if (!document.body.contains(modal)) {

                document.removeEventListener(
                    'keydown',
                    handleKeyboard
                );

                observer.disconnect();

            }

        });

    observer.observe(
        document.body,
        {
            childList: true
        }
    );


} catch (error) {

    console.error(
        '❌ Erreur viewProfile:',
        error
    );

    showAlert(
        'Erreur : ' + error.message,
        'error'
    );

}


}


function startChat(userId, userName) {
    // Rediriger vers la page des messages avec l'ID de l'utilisateur
    window.location.href = `membre-messages.html?user=${userId}&name=${encodeURIComponent(userName)}`;
}

function filterProfiles() {
    const gender = document.getElementById('filterGender').value;
    const minAge = parseInt(document.getElementById('filterMinAge').value) || 0;
   const maxAgeElement = document.getElementById('filterMaxAge');

const maxAge = maxAgeElement
    ? parseInt(maxAgeElement.value) || 150
    : 150;
    const denomination = document.getElementById('filterDenomination').value;
    const city = document.getElementById('filterCity').value.toLowerCase();
    const faithEngagement = document.getElementById('filterFaithEngagement').value;

    let filtered = allProfiles.filter(profile => {
        const age = calculateAge(profile.birth_date);

        // Appliquer les filtres
        if (gender && profile.gender !== gender) return false;
        if (age < minAge || age > maxAge) return false;
        if (denomination && profile.denomination !== denomination) return false;
        if (city && !profile.city.toLowerCase().includes(city)) return false;
        if (faithEngagement && profile.faith_engagement !== faithEngagement) return false;

        return true;
    });

    if (filtered.length === 0) {
        showNoResults();
    } else {
        displayProfiles(filtered);
        showAlert(`✅ ${filtered.length} profil(s) trouvé(s)`, 'success');
    }
}

function resetFilters() {
    document.getElementById('filterGender').value = '';
    document.getElementById('filterMinAge').value = '';
  const maxAgeElement = document.getElementById('filterMaxAge');

if (maxAgeElement) {
    maxAgeElement.value = '';
}
    document.getElementById('filterDenomination').value = '';
    document.getElementById('filterCity').value = '';
    document.getElementById('filterFaithEngagement').value = '';

    displayProfiles(allProfiles);
    showAlert('✅ Filtres réinitialisés', 'success');
}

// ===== AFFICHER "AUCUN RÉSULTAT" =====
function showNoResults() {
    const profilesContainer = document.getElementById('profilesContainer');
    const noResultsContainer = document.getElementById('noResultsContainer');

    profilesContainer.innerHTML = '';
    noResultsContainer.style.display = 'block';
}

// ===== CALCULER L'ÂGE =====
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    return age;
}

// ===== AFFICHER LES ALERTES =====
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

// Animation de disparition
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

console.log('✅ search.js chargé avec succès !');