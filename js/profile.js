// ===== VARIABLES GLOBALES =====
let currentUser = null;
let currentProfile = null;

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', async () => {

    // Vérifier que l'utilisateur est connecté
    currentUser = await requireAuth();

    if (!currentUser) {
        return;
    }

    // Charger le profil
    await loadProfile();

    // Charger les photos du profil
    await loadProfilePhotos();

    // Charger le statut de certification
    await loadCertificationStatus();

    // ===== ÉVÉNEMENTS =====

    // Bouton déconnexion
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Formulaire modification du profil
    const editForm = document.getElementById('editForm');

    if (editForm) {
        editForm.addEventListener('submit', handleEditForm);
    }

    // Onglet "Mes matchs"
    const matchesTab = document.querySelector('.profile-tab:nth-child(3)');

    if (matchesTab) {
        matchesTab.addEventListener('click', loadMatches);
    }

});

// ===== CHARGER LE PROFIL =====
async function loadProfile() {
    try {
        const { data: profile, error } = await window.supabaseClient
    .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            console.error('Erreur:', error);
            showAlert('Erreur lors du chargement du profil', 'error');
            return;
        }

        currentProfile = profile;
        displayProfile(profile);
        populateEditForm(profile);

    } catch (error) {
        console.error('Erreur:', error);
        showAlert('Erreur: ' + error.message, 'error');
    }
}

// =====================================================
// CERTIFICATION DU PROFIL
// =====================================================

async function loadCertificationStatus() {


    
    const container = document.getElementById('certificationContent');

    if (!container || !currentUser) return;

    try {

        const { data: request, error } = await window.supabaseClient
            .from('verification_requests')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('❌ Erreur certification:', error);
            container.innerHTML = `
                <div style="
                    padding: 15px;
                    background: #fee2e2;
                    color: #991b1b;
                    border-radius: 12px;
                ">
                    Impossible de charger le statut de certification.
                </div>
            `;
            return;
        }

        // ==========================================
        // AUCUNE DEMANDE
        // ==========================================

        if (!request) {

            container.innerHTML = `
                <div style="
                    padding: 20px;
                    background: #eff6ff;
                    border-radius: 15px;
                    border: 1px solid #bfdbfe;
                ">

                    <div style="
                        font-size: 1.2rem;
                        font-weight: 700;
                        color: #1e3a8a;
                        margin-bottom: 8px;
                    ">
                        🔵 Certification du profil
                    </div>

                    <p style="
                        margin: 0 0 15px;
                        color: #374151;
                        line-height: 1.5;
                    ">
                        Faites vérifier votre identité et obtenez
                        le badge bleu de profil certifié.
                    </p>

                    <button
                        type="button"
                        onclick="requestCertification()"
                        style="
                            width: 100%;
                            padding: 13px 18px;
                            border: none;
                            border-radius: 12px;
                            background: #2563eb;
                            color: white;
                            font-size: 1rem;
                            font-weight: 700;
                            cursor: pointer;
                        "
                    >
                        🛡️ Demander la certification — 5 000 FCFA
                    </button>

                </div>
            `;

            return;
        }

        // ==========================================
        // EN ATTENTE
        // ==========================================

        if (request.status === 'pending') {

            container.innerHTML = `
                <div style="
                    padding: 20px;
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                    border-radius: 15px;
                ">

                    <div style="
                        font-size: 1.2rem;
                        font-weight: 700;
                        color: #9a3412;
                        margin-bottom: 8px;
                    ">
                        ⏳ Vérification en cours
                    </div>

                    <p style="
                        margin: 0;
                        color: #374151;
                        line-height: 1.5;
                    ">
                        Votre demande est actuellement examinée par
                        notre équipe.
                    </p>

                    <p style="
                        margin: 10px 0 0;
                        color: #6b7280;
                        font-size: 0.9rem;
                    ">
                        La vérification peut prendre jusqu'à 3 jours
                        en cas de contrôle approfondi.
                    </p>

                </div>
            `;

            return;
        }

        // ==========================================
        // CERTIFIÉ
        // ==========================================

        if (request.status === 'certified') {

            container.innerHTML = `
                <div style="
                    padding: 20px;
                    background: #eff6ff;
                    border: 1px solid #93c5fd;
                    border-radius: 15px;
                ">

                    <div style="
                        font-size: 1.3rem;
                        font-weight: 800;
                        color: #1d4ed8;
                        margin-bottom: 8px;
                    ">
                        🔵 Profil certifié
                    </div>

                    <p style="
                        margin: 0;
                        color: #374151;
                    ">
                        Votre profil a été vérifié par
                        l'équipe Alliance Chrétienne.
                    </p>

                </div>
            `;

            return;
        }

        // ==========================================
        // REFUSÉ
        // ==========================================

        if (request.status === 'rejected') {

            const reason = request.rejection_reason
                ? request.rejection_reason
                : 'Les informations fournies n’ont pas pu être validées.';

            container.innerHTML = `
                <div style="
                    padding: 20px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 15px;
                ">

                    <div style="
                        font-size: 1.2rem;
                        font-weight: 700;
                        color: #b91c1c;
                        margin-bottom: 8px;
                    ">
                        ❌ Certification refusée
                    </div>

                    <p style="
                        margin: 0 0 10px;
                        color: #374151;
                    ">
                        <strong>Motif :</strong>
                        ${reason}
                    </p>

                    <p style="
                        margin: 0 0 15px;
                        color: #6b7280;
                        font-size: 0.9rem;
                    ">
                        Vous pouvez soumettre une nouvelle demande.
                    </p>

                    <button
                        type="button"
                        onclick="requestCertification()"
                        style="
                            width: 100%;
                            padding: 13px 18px;
                            border: none;
                            border-radius: 12px;
                            background: #2563eb;
                            color: white;
                            font-size: 1rem;
                            font-weight: 700;
                            cursor: pointer;
                        "
                    >
                        🔄 Nouvelle demande — 5 000 FCFA
                    </button>

                </div>
            `;

            return;
        }

    } catch (error) {

        console.error('❌ Erreur loadCertificationStatus:', error);

    }
}


// =====================================================
// DEMANDER LA CERTIFICATION + PAIEMENT WAVE
// =====================================================

async function requestCertification() {

    const client = window.supabaseClient;

    if (!client || !currentUser) {
        showAlert('Vous devez être connecté.', 'error');
        return;
    }

    try {

        // ==========================================
        // 1. VÉRIFIER UNE DEMANDE EXISTANTE
        // ==========================================

        const { data: existingRequest, error: checkError } =
            await client
                .from('verification_requests')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

        if (checkError) {

            console.error(
                '❌ Erreur vérification demande:',
                checkError
            );

            showAlert(
                'Impossible de vérifier votre demande.',
                'error'
            );

            return;
        }

        // ==========================================
        // DEMANDE DÉJÀ EN ATTENTE
        // ==========================================

        if (
            existingRequest &&
            existingRequest.status === 'pending'
        ) {

            showAlert(
                '⏳ Votre demande est déjà en cours de vérification.',
                'info'
            );

            return;
        }

       // ==========================================
// DÉJÀ CERTIFIÉ
// ==========================================

if (
    existingRequest &&
    existingRequest.status === 'certified'
) {

    showAlert(
        '🔵 Votre profil est déjà certifié.',
        'success'
    );

    return;
}

openCertificationPaymentModal();
return;

    } catch (error) {

        console.error(
            '❌ Erreur requestCertification:',
            error
        );

        showAlert(
            'Erreur : ' + error.message,
            'error'
        );
    }
}

// ===== AFFICHER LE PROFIL =====
function displayProfile(profile) {
    const age = calculateAge(profile.birth_date);

    // En-tête
    const avatar = document.getElementById('profileAvatar');

    if (profile.photo_url) {
        avatar.src = profile.photo_url;
    } else {
        avatar.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
                <rect width="150" height="150" rx="75" fill="#e5e7eb"/>
                <circle cx="75" cy="58" r="28" fill="#9ca3af"/>
                <path d="M30 130c5-28 22-42 45-42s40 14 45 42" fill="#9ca3af"/>
            </svg>
        `);
    }

    // Affichage du nom et du badge de certification côte à côte
    document.getElementById('profileName').innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">

            <h2 style="
                color: var(--dark-color);
                margin: 0;
            ">
                ${profile.first_name}, ${age} ans
            </h2>

            ${
                profile.is_verified === true
                ? `<svg
                    class="facebook-verified-badge"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    title="Compte certifié"
                    aria-label="Compte certifié"
                >
                    <path
                        fill="#1877F2"
                        d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
                    />
                    <path
                        fill="#FFFFFF"
                        d="M10.5 15.5l-3.5-3.5 1.414-1.414L10.5 12.672l6.086-6.086L18 8z"
                    />
                </svg>`
                : ''
            }

        </div>
    `;

    document.getElementById('profileLocation').textContent = `📍 ${profile.city}, ${profile.country}`;
    document.getElementById('profileFaith').textContent = `🙏 ${profile.denomination}`;
    
    // Compter les likes
    countLikes(profile.id);

    // Vue du profil (Prénom avec badge optionnel)
    document.getElementById('viewFirstName').innerHTML = `
        <span>${profile.first_name}</span>
        ${
            profile.is_verified === true
            ? `<svg class="facebook-verified-badge"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    title="Compte certifié"
                    style="vertical-align: middle; margin-left: 5px;">
                   <path fill="#1877F2" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
                   <path fill="#FFFFFF" d="M10.5 15.5l-3.5-3.5 1.414-1.414L10.5 12.672l6.086-6.086L18 8z"/>
               </svg>`
            : ''
        }
    `;

    // ── CORRECTION : Âge affiché proprement sans badge ──
    document.getElementById('viewAge').textContent = `${age} ans`;

    document.getElementById('viewGender').textContent = profile.gender;
    document.getElementById('viewCity').textContent = profile.city;
    document.getElementById('viewCountry').textContent = profile.country;

    document.getElementById('viewDenomination').textContent = profile.denomination;
    document.getElementById('viewChurchFrequency').textContent = profile.church_frequency;
    document.getElementById('viewFaithEngagement').textContent = profile.faith_engagement;
    document.getElementById('viewFavoriteVerse').textContent = profile.favorite_verse || 'Non renseigné';

    document.getElementById('viewBio').textContent = profile.bio;
    document.getElementById('viewLookingFor').textContent = profile.looking_for;

    document.getElementById('viewSearchGender').textContent = profile.search_gender;
    document.getElementById('viewSearchAge').textContent = `${profile.search_min_age} - ${profile.search_max_age} ans`;
    document.getElementById('viewSearchDistance').textContent = `${profile.search_distance} km`;
}

async function countLikes(userId) {
    try {
        const { count, error } = await window.supabaseClient
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('liked_user_id', userId);

        if (error) {
            console.error('Erreur countLikes:', error);
            return;
        }

        if (count !== null) {
            document.getElementById('profileStats').textContent =
                `❤️ ${count} like(s) reçu(s)`;
        }

    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ===== PEUPLER LE FORMULAIRE D'ÉDITION =====
function populateEditForm(profile) {
    document.getElementById('editFirstName').value = profile.first_name;
    document.getElementById('editGender').value = profile.gender;
    document.getElementById('editCity').value = profile.city;
    document.getElementById('editCountry').value = profile.country;

    document.getElementById('editDenomination').value = profile.denomination;
    document.getElementById('editChurchFrequency').value = profile.church_frequency;
    document.getElementById('editFaithEngagement').value = profile.faith_engagement;
    document.getElementById('editFavoriteVerse').value = profile.favorite_verse || '';

    document.getElementById('editBio').value = profile.bio;
    document.getElementById('editLookingFor').value = profile.looking_for;

    document.getElementById('editSearchGender').value = profile.search_gender;
    document.getElementById('editSearchMinAge').value = profile.search_min_age;
    document.getElementById('editSearchMaxAge').value = profile.search_max_age;
    document.getElementById('editSearchDistance').value = profile.search_distance;
}

// ===== GÉRER LA SOUMISSION DU FORMULAIRE =====
async function handleEditForm(e) {
    e.preventDefault();

    const updatedData = {
        first_name: document.getElementById('editFirstName').value.trim(),
        gender: document.getElementById('editGender').value,
        city: document.getElementById('editCity').value.trim(),
        country: document.getElementById('editCountry').value.trim(),
        denomination: document.getElementById('editDenomination').value,
        church_frequency: document.getElementById('editChurchFrequency').value,
        faith_engagement: document.getElementById('editFaithEngagement').value,
        favorite_verse: document.getElementById('editFavoriteVerse').value.trim(),
        bio: document.getElementById('editBio').value.trim(),
        looking_for: document.getElementById('editLookingFor').value.trim(),
        search_gender: document.getElementById('editSearchGender').value,
        search_min_age: parseInt(document.getElementById('editSearchMinAge').value),
        search_max_age: parseInt(document.getElementById('editSearchMaxAge').value),
        search_distance: parseInt(document.getElementById('editSearchDistance').value)
    };

    // Valider
    if (updatedData.search_min_age >= updatedData.search_max_age) {
        showAlert('L\'âge minimum doit être inférieur à l\'âge maximum', 'error');
        return;
    }

    // Désactiver le bouton
    const submitBtn = document.querySelector('#editForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enregistrement...';

    try {
        const { error } = await window.supabaseClient
    .from('profiles')
            .update(updatedData)
            .eq('id', currentUser.id);

        if (error) {
            showAlert(`Erreur: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        showAlert('✅ Profil mis à jour avec succès !', 'success');
        
        // Recharger le profil
        await loadProfile();
        
        // Retourner à la vue
        switchTab('view');

        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

    } catch (error) {
        console.error('Erreur:', error);
        showAlert('Erreur: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function uploadPhoto(event) {

    const file = event.target.files[0];

    if (!file) return;

    const client = window.supabaseClient;

    if (!client) {
        showAlert('Client Supabase indisponible', 'error');
        return;
    }

    try {

        // ==========================================
        // 1. VÉRIFIER LE NOMBRE DE PHOTOS
        // ==========================================

        const { count, error: countError } = await client
            .from('profile_photos')
            .select('*', {
                count: 'exact',
                head: true
            })
            .eq('profile_id', currentUser.id);

        if (countError) {
            console.error('❌ Erreur comptage photos:', countError);
            showAlert('Impossible de vérifier vos photos', 'error');
            event.target.value = '';
            return;
        }

        if (count >= 4) {
            showAlert(
                'Vous avez déjà atteint la limite de 4 photos 📸',
                'error'
            );

            event.target.value = '';
            return;
        }

        // ==========================================
        // 2. VÉRIFIER LE TYPE
        // ==========================================

        if (!file.type.startsWith('image/')) {
            showAlert('Veuillez sélectionner une image', 'error');
            event.target.value = '';
            return;
        }

        // ==========================================
        // 3. VÉRIFIER LA TAILLE
        // ==========================================

        if (file.size > 5 * 1024 * 1024) {
            showAlert(
                'L\'image ne doit pas dépasser 5 MB',
                'error'
            );

            event.target.value = '';
            return;
        }

        // ==========================================
        // 4. OUVRIR LE RECADRAGE
        // ==========================================

        const reader = new FileReader();

        reader.onload = function (e) {

            openPhotoCropper(
                e.target.result,
                file,
                count
            );

        };

        reader.readAsDataURL(file);

    } catch (error) {

        console.error('❌ Erreur uploadPhoto:', error);

        showAlert(
            'Erreur : ' + error.message,
            'error'
        );

        event.target.value = '';
    }
}


// =====================================================
// OUVRIR LE RECADREUR
// =====================================================

function openPhotoCropper(imageSrc, originalFile, currentCount) {

    const modal = document.createElement('div');

    modal.id = 'photoCropModal';

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            width: 100%;
            max-width: 650px;
            max-height: 95vh;
            overflow-y: auto;
            border-radius: 20px;
            padding: 20px;
            box-sizing: border-box;
        ">

            <h2 style="
                margin: 0 0 10px;
                color: #111827;
                text-align: center;
            ">
                📸 Recadrez votre photo
            </h2>

            <p style="
                text-align: center;
                color: #6b7280;
                margin-bottom: 20px;
            ">
                Déplacez et redimensionnez la zone pour choisir
                la partie de la photo que vous souhaitez montrer.
            </p>

            <div style="
                width: 100%;
                max-height: 500px;
                overflow: hidden;
                display: flex;
                justify-content: center;
                background: #111827;
                border-radius: 12px;
            ">

                <img
                    id="cropImage"
                    src="${imageSrc}"
                    style="
                        max-width: 100%;
                        max-height: 500px;
                        display: block;
                    "
                >

            </div>

            <div style="
                display: flex;
                gap: 10px;
                margin-top: 20px;
            ">

                <button
                    type="button"
                    onclick="cancelPhotoCrop()"
                    style="
                        flex: 1;
                        padding: 14px;
                        border: none;
                        border-radius: 10px;
                        background: #e5e7eb;
                        color: #374151;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 1rem;
                    "
                >
                    ✕ Annuler
                </button>

                <button
                    type="button"
                    onclick="confirmPhotoCrop()"
                    style="
                        flex: 1;
                        padding: 14px;
                        border: none;
                        border-radius: 10px;
                        background: var(--primary-color);
                        color: white;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 1rem;
                    "
                >
                    ✅ Utiliser cette photo
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    // Charger Cropper.js si nécessaire
    loadCropperLibrary(() => {

        const image = document.getElementById('cropImage');

        window.currentCropper = new Cropper(image, {

           aspectRatio: 4 / 5,

            viewMode: 1,

            dragMode: 'move',

            autoCropArea: 0.9,

            responsive: true,

            background: false,

            zoomable: true,

            movable: true,

            scalable: false,

            rotatable: false,

            cropBoxResizable: true,

            cropBoxMovable: true

        });

    });

    window.currentCropOriginalFile = originalFile;
    window.currentCropCount = currentCount;
}


// =====================================================
// CHARGER CROPPER.JS
// =====================================================

function loadCropperLibrary(callback) {

    if (window.Cropper) {
        callback();
        return;
    }

    // CSS
    if (!document.getElementById('cropperCSS')) {

        const css = document.createElement('link');

        css.id = 'cropperCSS';

        css.rel = 'stylesheet';

        css.href =
            'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css';

        document.head.appendChild(css);
    }

    // JS
    const script = document.createElement('script');

    script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js';

    script.onload = callback;

    document.head.appendChild(script);
}


// =====================================================
// ANNULER LE RECADRAGE
// =====================================================

function cancelPhotoCrop() {

    if (window.currentCropper) {

        window.currentCropper.destroy();

        window.currentCropper = null;
    }

    const modal =
        document.getElementById('photoCropModal');

    if (modal) {
        modal.remove();
    }

    const input =
        document.getElementById('photoUploadEdit');

    if (input) {
        input.value = '';
    }
}


// =====================================================
// CONFIRMER LE RECADRAGE
// =====================================================

async function confirmPhotoCrop() {

    if (!window.currentCropper) {

        showAlert(
            'Le recadrage n\'est pas encore prêt',
            'error'
        );

        return;
    }

    try {

        showAlert(
            '⏳ Préparation de votre photo...',
            'info'
        );

        // ==========================================
        // CRÉER L'IMAGE RECADRÉE
        // ==========================================

       const canvas =
    window.currentCropper.getCroppedCanvas({

        width: 600,
        height: 750,

        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'

    });

        // ==========================================
        // CONVERTIR EN BLOB
        // ==========================================

        canvas.toBlob(
            async function (blob) {

                if (!blob) {

                    showAlert(
                        'Impossible de recadrer la photo',
                        'error'
                    );

                    return;
                }

                await uploadCroppedPhoto(
                    blob,
                    window.currentCropCount
                );

            },
            'image/jpeg',
            0.90
        );

    } catch (error) {

        console.error(
            '❌ Erreur recadrage:',
            error
        );

        showAlert(
            'Erreur lors du recadrage : ' +
            error.message,
            'error'
        );
    }
}


// =====================================================
// ENVOYER LA PHOTO RECADRÉE
// =====================================================

async function uploadCroppedPhoto(blob, count) {

    const client = window.supabaseClient;

    try {

        // Fermer le recadreur
        if (window.currentCropper) {

            window.currentCropper.destroy();

            window.currentCropper = null;
        }

        const modal =
            document.getElementById('photoCropModal');

        if (modal) {
            modal.remove();
        }

        showAlert(
            '📤 Upload de la photo...',
            'info'
        );

        // ==========================================
        // NOM UNIQUE
        // ==========================================

        const fileName =
            `${currentUser.id}/${Date.now()}.jpg`;

        // ==========================================
        // UPLOAD STORAGE
        // ==========================================

        const { error: uploadError } =
            await client.storage
                .from('avatars')
                .upload(
                    fileName,
                    blob,
                    {
                        contentType: 'image/jpeg',
                        upsert: false
                    }
                );

        if (uploadError) {

            console.error(
                '❌ Erreur upload:',
                uploadError
            );

            showAlert(
                'Erreur lors de l\'upload : ' +
                uploadError.message,
                'error'
            );

            return;
        }

        console.log('✅ Photo recadrée uploadée');

        // ==========================================
        // URL PUBLIQUE
        // ==========================================

        const { data: publicUrlData } =
            client.storage
                .from('avatars')
                .getPublicUrl(fileName);

        const photoUrl =
            publicUrlData.publicUrl;

        console.log(
            '🔗 URL photo:',
            photoUrl
        );
        const { data: newPhoto, error: insertError } =
            await client
                .from('profile_photos')
               .insert([{
    profile_id: currentUser.id,
    photo_url: photoUrl,
    is_primary: false,
    status: 'pending'
}])
                .select()
                .single();

        if (insertError) {

            console.error(
                '❌ Erreur enregistrement:',
                insertError
            );

            await client.storage
                .from('avatars')
                .remove([fileName]);

            showAlert(
                'Erreur lors de l\'enregistrement : ' +
                insertError.message,
                'error'
            );

            return;
        }

        console.log(
            '✅ Photo enregistrée:',
            newPhoto
        );

    
console.log(
    '⏳ Photo envoyée et placée en attente de validation admin'
);

        await loadProfilePhotos();

        const photoNumber =
            count + 1;

        showAlert(
            `✅ Photo ${photoNumber}/4 ajoutée avec succès !`,
            'success'
        );

        // Reset input
        const input =
            document.getElementById('photoUploadEdit');

        if (input) {
            input.value = '';
        }

    } catch (error) {

        console.error(
            '❌ Erreur uploadCroppedPhoto:',
            error
        );

        showAlert(
            'Erreur : ' + error.message,
            'error'
        );
    }
}



function getDefaultAvatar() {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
            <rect width="300" height="300" fill="#e5e7eb"/>
            <circle cx="150" cy="115" r="55" fill="#9ca3af"/>
            <path d="M60 270c8-55 42-85 90-85s82 30 90 85" fill="#9ca3af"/>
        </svg>
    `);
}


// ===== CHARGER LES PHOTOS DU PROFIL =====
async function loadProfilePhotos() {
    try {
        const { data: photos, error } = await window.supabaseClient
            .from('profile_photos')
            .select('*')
            .eq('profile_id', currentUser.id)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Erreur chargement photos:', error);
            return;
        }

        const editContainer = document.getElementById('profilePhotosContainer');
        const viewContainer = document.getElementById('profilePhotosGallery');
        const counter = document.getElementById('photoCounter');
        const avatar = document.getElementById('profileAvatar');

       
        if (counter) {
            counter.textContent = `${photos.length} / 4`;
        }

const approvedPhotos = photos.filter(
    photo => photo.status === 'approved'
);

const approvedPhotosForView = photos.filter(
    photo => photo.status === 'approved'
);

const primaryApprovedPhoto =
    approvedPhotos.find(photo => photo.is_primary) ||
    approvedPhotos[0];

if (avatar) {
    if (primaryApprovedPhoto) {
        avatar.src = primaryApprovedPhoto.photo_url;
    } else {
        avatar.src = getDefaultAvatar();
    }

    avatar.onerror = function () {
        this.src = getDefaultAvatar();
    };
}

        if (editContainer) {
            editContainer.innerHTML = '';

            if (approvedPhotosForView.length === 0) {
                editContainer.innerHTML = `
                    <p style="
                        color: var(--text-color);
                        text-align: center;
                        padding: 1rem;
                    ">
                        Aucune photo pour le moment 📷
                    </p>
                `;
            } else {
               approvedPhotosForView.forEach((photo, index) => {

                    const photoBox = document.createElement('div');

                    photoBox.style.cssText = `
                        position: relative;
                        width: 150px;
                        height: 150px;
                        border-radius: 12px;
                        overflow: hidden;
                        background: #f3f4f6;
                    `;

                    photoBox.innerHTML = `
                        <img
                            src="${photo.photo_url}"
                            alt="Photo ${index + 1}"
                            style="
                                width: 100%;
                                height: 100%;
                                object-fit: cover;
                            "
                            onerror="this.src=getDefaultAvatar()"
                        >

                      ${photo.status === 'pending' ? `
    <span style="
        position: absolute;
        top: 8px;
        left: 8px;
        background: #f59e0b;
        color: white;
        padding: 4px 8px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        z-index: 2;
    ">
        ⏳ En attente
    </span>
` : photo.status === 'rejected' ? `
    <span style="
        position: absolute;
        top: 8px;
        left: 8px;
        background: #dc2626;
        color: white;
        padding: 4px 8px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        z-index: 2;
    ">
        ❌ Rejetée
    </span>
` : photo.is_primary ? `
    <span style="
        position: absolute;
        top: 8px;
        left: 8px;
        background: var(--primary-color);
        color: white;
        padding: 4px 8px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        z-index: 2;
    ">
        ⭐ Principale
    </span>
` : `
    <button
        onclick="setPrimaryPhoto('${photo.id}', '${photo.photo_url}')"
        style="
            position: absolute;
            bottom: 8px;
            left: 8px;
            right: 8px;
            border: none;
            border-radius: 8px;
            background: rgba(79, 70, 229, 0.95);
            color: white;
            padding: 8px 6px;
            cursor: pointer;
            font-size: 0.78rem;
            font-weight: 600;
            z-index: 2;
        "
    >
        📌 Définir comme principale
    </button>
`}
                        <button
                            onclick="deleteProfilePhoto('${photo.id}', '${photo.photo_url}')"
                            style="
                                position: absolute;
                                top: 8px;
                                right: 8px;
                                width: 32px;
                                height: 32px;
                                border: none;
                                border-radius: 50%;
                                background: rgba(220, 38, 38, 0.9);
                                color: white;
                                cursor: pointer;
                                font-size: 16px;
                            "
                            title="Supprimer"
                        >
                            🗑️
                        </button>
                    `;

                    editContainer.appendChild(photoBox);
                });
            }
        }

if (viewContainer) {
            viewContainer.innerHTML = '';

            if (approvedPhotosForView.length === 0) {
                viewContainer.innerHTML = `
                    <p style="
                        color: var(--text-color);
                        text-align: center;
                        padding: 1rem;
                    ">
                        Aucune photo ajoutée 📷
                    </p>
                `;
            } else {

               approvedPhotosForView.forEach((photo, index) => {

                    const image = document.createElement('img');

                    image.src = photo.photo_url;
                    image.alt = `Photo ${index + 1}`;

                    image.style.cssText = `
                        width: 100%;
                        height: 220px;
                        object-fit: cover;
                        border-radius: 12px;
                        cursor: pointer;
                    `;

                    image.onerror = function () {
                        this.src = getDefaultAvatar();
                    };

                    viewContainer.appendChild(image);
                });
            }
        }

    } catch (error) {
        console.error('❌ Erreur loadProfilePhotos:', error);
    }
}

// =====================================================
// SUPPRIMER UNE PHOTO DU PROFIL
// =====================================================

async function deleteProfilePhoto(photoId, photoUrl) {

    if (!confirm('Voulez-vous vraiment supprimer cette photo ?')) {
        return;
    }

    const client = window.supabaseClient;

    if (!client) {
        showAlert('Client Supabase indisponible', 'error');
        return;
    }

    try {

        showAlert('⏳ Suppression de la photo...', 'info');

        // ==========================================
        // 1. RÉCUPÉRER LA PHOTO
        // ==========================================

        const { data: photo, error: photoError } =
            await client
                .from('profile_photos')
                .select('*')
                .eq('id', photoId)
                .eq('profile_id', currentUser.id)
                .single();

        if (photoError || !photo) {

            console.error('❌ Photo introuvable:', photoError);

            showAlert(
                'Impossible de trouver cette photo',
                'error'
            );

            return;
        }

        // ==========================================
        // 2. SUPPRIMER DE profile_photos
        // ==========================================

        const { error: deleteError } =
            await client
                .from('profile_photos')
                .delete()
                .eq('id', photoId)
                .eq('profile_id', currentUser.id);

        if (deleteError) {

            console.error(
                '❌ Erreur suppression:',
                deleteError
            );

            showAlert(
                'Erreur lors de la suppression : ' +
                deleteError.message,
                'error'
            );

            return;
        }

        // ==========================================
        // 3. SUPPRIMER DU STORAGE
        // ==========================================

        try {

            const url = new URL(photo.photo_url);

            const marker = '/storage/v1/object/public/avatars/';

            const index = url.pathname.indexOf(marker);

            if (index !== -1) {

                const filePath =
                    decodeURIComponent(
                        url.pathname.substring(
                            index + marker.length
                        )
                    );

                console.log(
                    '🗑️ Suppression Storage:',
                    filePath
                );

                const { error: storageError } =
                    await client.storage
                        .from('avatars')
                        .remove([filePath]);

                if (storageError) {

                    console.error(
                        '⚠️ Erreur suppression Storage:',
                        storageError
                    );

                } else {

                    console.log(
                        '✅ Fichier supprimé du Storage'
                    );

                }
            }

        } catch (storageParseError) {

            console.error(
                '⚠️ Impossible de déterminer le fichier Storage:',
                storageParseError
            );

        }

        // ==========================================
        // 4. VÉRIFIER LES PHOTOS RESTANTES
        // ==========================================

        const { data: remainingPhotos, error: remainingError } =
            await client
                .from('profile_photos')
                .select('*')
                .eq('profile_id', currentUser.id)
                .order('is_primary', {
                    ascending: false
                })
                .order('created_at', {
                    ascending: true
                });

        if (remainingError) {

            console.error(
                '❌ Erreur récupération photos restantes:',
                remainingError
            );

        }

        const photosLeft = remainingPhotos || [];

        // ==========================================
        // 5. SI LA PHOTO SUPPRIMÉE ÉTAIT PRINCIPALE
        // ==========================================

        const wasPrimary = photo.is_primary;

        if (wasPrimary) {

            if (photosLeft.length > 0) {

                const newPrimary = photosLeft[0];

                // Nouvelle photo principale
                const { error: primaryError } =
                    await client
                        .from('profile_photos')
                        .update({
                            is_primary: true
                        })
                        .eq('id', newPrimary.id)
                        .eq('profile_id', currentUser.id);

                if (primaryError) {

                    console.error(
                        '❌ Erreur nouvelle photo principale:',
                        primaryError
                    );

                }

                // Mettre à jour profiles.photo_url
                const { error: profileError } =
                    await client
                        .from('profiles')
                        .update({
                            photo_url: newPrimary.photo_url
                        })
                        .eq('id', currentUser.id);

                if (profileError) {

                    console.error(
                        '❌ Erreur mise à jour profil:',
                        profileError
                    );

                }

            } else {

                // Plus aucune photo
                const { error: profileError } =
                    await client
                        .from('profiles')
                        .update({
                            photo_url: null
                        })
                        .eq('id', currentUser.id);

                if (profileError) {

                    console.error(
                        '❌ Erreur suppression photo principale:',
                        profileError
                    );

                }

            }
        }

        // ==========================================
        // 6. RECHARGER LE PROFIL
        // ==========================================

        await loadProfile();

        // ==========================================
        // 7. RECHARGER LES PHOTOS
        // ==========================================

        await loadProfilePhotos();

        showAlert(
            '✅ Photo supprimée avec succès !',
            'success'
        );

    } catch (error) {

        console.error(
            '❌ Erreur deleteProfilePhoto:',
            error
        );

        showAlert(
            'Erreur : ' + error.message,
            'error'
        );
    }
}

async function setPrimaryPhoto(photoId, photoUrl) {

    const client = window.supabaseClient;

    if (!client) {
        showAlert('Client Supabase indisponible', 'error');
        return;
    }

    try {

        showAlert('⏳ Changement de la photo principale...', 'info');

        // ==========================================
        // 1. RETIRER "PRINCIPALE" DE TOUTES LES PHOTOS
        // ==========================================

        const { error: resetError } = await client
            .from('profile_photos')
            .update({
                is_primary: false
            })
            .eq('profile_id', currentUser.id);

        if (resetError) {
            console.error(
                '❌ Erreur réinitialisation:',
                resetError
            );

            showAlert(
                'Impossible de changer la photo principale',
                'error'
            );

            return;
        }

        // ==========================================
        // 2. DÉFINIR LA NOUVELLE PHOTO PRINCIPALE
        // ==========================================

        const { error: primaryError } = await client
            .from('profile_photos')
            .update({
                is_primary: true
            })
            .eq('id', photoId)
            .eq('profile_id', currentUser.id);

        if (primaryError) {
            console.error(
                '❌ Erreur définition principale:',
                primaryError
            );

            showAlert(
                'Impossible de définir cette photo comme principale',
                'error'
            );

            return;
        }

        // ==========================================
        // 3. METTRE À JOUR profiles.photo_url
        // ==========================================

        const { error: profileError } = await client
            .from('profiles')
            .update({
                photo_url: photoUrl
            })
            .eq('id', currentUser.id);

        if (profileError) {
            console.error(
                '❌ Erreur mise à jour profil:',
                profileError
            );

            showAlert(
                'Photo principale changée, mais le profil n\'a pas pu être mis à jour',
                'error'
            );

            return;
        }

        // ==========================================
        // 4. RECHARGER LES PHOTOS
        // ==========================================

        await loadProfilePhotos();

        // ==========================================
        // 5. RECHARGER LE PROFIL
        // ==========================================

        await loadProfile();

        showAlert(
            '✅ Photo principale changée avec succès !',
            'success'
        );

    } catch (error) {

        console.error(
            '❌ Erreur setPrimaryPhoto:',
            error
        );

        showAlert(
            'Erreur : ' + error.message,
            'error'
        );
    }
}

async function loadMatches() {
    const matchesContainer = document.getElementById('matchesContainer');
    matchesContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Chargement...</p>';

    try {
        // Récupérer mes likes
        const { data: myLikes } = await window.supabaseClient
    .from('likes')
            .select('liked_user_id')
            .eq('user_id', currentUser.id);

        if (!myLikes || myLikes.length === 0) {
            matchesContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-color);">Vous n\'avez pas encore liké de profil.</p>';
            return;
        }

        // Récupérer les likes reçus
        const { data: receivedLikes } = await window.supabaseClient
            .from('likes')
            .select('user_id')
            .eq('liked_user_id', currentUser.id);

        const myLikedIds = myLikes.map(l => l.liked_user_id);
        const receivedLikerIds = receivedLikes ? receivedLikes.map(l => l.user_id) : [];

        // Trouver les matchs mutuels
        const matchIds = myLikedIds.filter(id => receivedLikerIds.includes(id));

        if (matchIds.length === 0) {
            matchesContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-color);">Vous n\'avez pas encore de matchs. 😔 Continuez à liker des profils !</p>';
            return;
        }

        // Récupérer les profils des matchs
        const { data: matches } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .in('id', matchIds);

        matchesContainer.innerHTML = '';

        if (matches && matches.length > 0) {
            matches.forEach(match => {
                const age = calculateAge(match.birth_date);
                const matchCard = document.createElement('div');
                matchCard.className = 'match-card';
               // ... (début de ta boucle de chargement des matchs)

matchCard.innerHTML = `
    <img 
        src="${match.photo_url || getDefaultAvatar()}" 
        alt="${match.first_name}"
        onerror="this.src=getDefaultAvatar()">
    <div class="match-card-info">
        <div class="match-card-name" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span>${match.first_name}, ${age}</span>
            ${
                match.is_verified === true
                ? `<svg viewBox="0 0 24 24" width="16" height="16" title="Compte certifié" style="flex-shrink: 0; vertical-align: middle;">
                       <path fill="#1877F2" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
                       <path fill="#FFFFFF" d="M10.5 15.5l-3.5-3.5 1.414-1.414L10.5 12.672l6.086-6.086L18 8z"/>
                   </svg>`
                : ''
            }
        </div>
        <p style="font-size: 0.85rem; color: var(--text-color);">📍 ${match.city}</p>
        <div class="match-card-actions">
            <button onclick="startChat('${match.id}', '${match.first_name}')">💬</button>
        </div>
    </div>
`;
matchesContainer.appendChild(matchCard);

// ... (suite de ton code)
            });
        }

    } catch (error) {
        console.error('Erreur:', error);
        showAlert('Erreur lors du chargement des matchs', 'error');
        matchesContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--danger-color);">Erreur lors du chargement</p>';
    }
}

// ===== VOIR LE PROFIL D'UN MATCH =====
async function viewMatchProfile(userId) {
    try {
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!profile) return;

        const age = calculateAge(profile.birth_date);

        const { data: photos, error: photosError } =
            await window.supabaseClient
                .from('profile_photos')
                .select('*')
                .eq('profile_id', userId)
                .order('is_primary', { ascending: false })
                .order('created_at', { ascending: true });
        
        if (photosError) {
            console.error('Erreur chargement photos:', photosError);
        }

        const mainPhoto = photos && photos.length > 0
            ? (
                photos.find(photo => photo.is_primary)?.photo_url ||
                photos[0].photo_url
              )
            : getDefaultAvatar();

        const modalContent = `
            <div style="background-color: #ffffff; padding: 1.5rem; border-radius: 1.25rem; max-width: 440px; width: 90%; max-height: 82vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); position: relative; font-family: system-ui, -apple-system, sans-serif;">
                
                <!-- Bouton fermer -->
                <button onclick="this.closest('.modal').remove()" style="position: absolute; top: 1rem; right: 1rem; background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #475569; transition: background 0.2s; z-index: 2;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">✕</button>
                
                <!-- Photo principale plus compacte -->
                <img 
                    src="${mainPhoto}" 
                    alt="${profile.first_name}" 
                    style="width: 100%; height: 260px; object-fit: cover; border-radius: 0.85rem; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05);"
                    onerror="this.src=getDefaultAvatar()"
                >
                
                <!-- Nom, Âge et Certification collés côte à côte -->
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.15rem;">
                    <h2 style="color: #1e293b; margin: 0; font-size: 1.45rem; font-weight: 800;">
                        ${profile.first_name}, ${age} ans
                    </h2>

                    ${
                        profile.is_verified === true
                        ? `<svg viewBox="0 0 24 24" width="20" height="20" title="Compte certifié" style="flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(24, 119, 242, 0.2));">
                               <path fill="#1877F2" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
                               <path fill="#FFFFFF" d="M10.5 15.5l-3.5-3.5 1.414-1.414L10.5 12.672l6.086-6.086L18 8z"/>
                           </svg>`
                        : ''
                    }
                </div>

                <p style="color: #64748b; margin-bottom: 1.15rem; font-size: 0.9rem; font-weight: 500;">
                    📍 ${profile.city || 'Ville non renseignée'}, ${profile.country || ''}
                </p>

                <!-- Bloc Informations spirituelles -->
                <div style="background: linear-gradient(135deg, #fff1f2, #eff6ff); padding: 1rem; border-radius: 0.85rem; margin-bottom: 1rem; border: 1px solid rgba(244, 63, 94, 0.15);">
                    <h3 style="color: #f43f5e; margin: 0 0 0.5rem 0; font-size: 0.98rem; display: flex; align-items: center; gap: 0.4rem;">
                        🙏 Informations spirituelles
                    </h3>
                    <div style="color: #334155; font-size: 0.88rem; line-height: 1.5;">
                        <strong>Dénomination:</strong> ${profile.denomination || 'Non renseigné'}<br>
                        <strong>Fréquence à l'église:</strong> ${profile.church_frequency || 'Non renseigné'}<br>
                        <strong>Engagement:</strong> ${profile.faith_engagement || 'Non renseigné'}<br>
                        ${profile.favorite_verse ? '<strong>Verset préféré:</strong> "' + profile.favorite_verse + '"<br>' : ''}
                    </div>
                </div>

                <!-- Bloc À propos -->
                ${profile.bio ? `
                    <div style="margin-bottom: 1rem;">
                        <h3 style="color: #2563eb; margin: 0 0 0.35rem 0; font-size: 0.98rem;">💭 À propos</h3>
                        <p style="color: #475569; margin: 0; font-size: 0.9rem; line-height: 1.45;">
                            ${profile.bio}
                        </p>
                    </div>
                ` : ''}

                <!-- Bloc Ce qu'il/elle recherche -->
                ${profile.looking_for ? `
                    <div style="margin-bottom: 1.2rem;">
                        <h3 style="color: #f43f5e; margin: 0 0 0.35rem 0; font-size: 0.98rem;">💕 Ce qu'il/elle recherche</h3>
                        <p style="color: #475569; margin: 0; font-size: 0.9rem; line-height: 1.45;">
                            ${profile.looking_for}
                        </p>
                    </div>
                ` : ''}

                <!-- Bouton d'action Message -->
                <div style="display: flex; gap: 1rem; margin-top: 1.2rem;">
                    <button
                        onclick="startChat('${profile.id}', '${profile.first_name}'); this.closest('.modal').remove();"
                        style="
                            flex: 1;
                            min-height: 48px;
                            padding: 0.8rem 1.25rem;
                            border: none;
                            border-radius: 12px;
                            background: linear-gradient(135deg, #f43f5e, #e11d48);
                            color: white;
                            font-size: 0.95rem;
                            font-weight: 700;
                            cursor: pointer;
                            box-shadow: 0 4px 12px rgba(244, 63, 94, 0.3);
                            transition: all 0.25s ease;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 0.5rem;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(244, 63, 94, 0.4)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(244, 63, 94, 0.3)'"
                    >
                        💬 Envoyer un message
                    </button>
                </div>
            </div>
        `;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
            box-sizing: border-box;
        `;
        modal.innerHTML = modalContent;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        document.body.appendChild(modal);

    } catch (error) {
        console.error('Erreur:', error);
        showAlert('Erreur lors du chargement du profil', 'error');
    }
}

// ===== DÉMARRER UNE CONVERSATION =====
function startChat(userId, userName) {
    window.location.href = `membre-messages.html?user=${userId}&name=${encodeURIComponent(userName)}`;
}

// ===== CHANGER DE TAB =====
function switchTab(tabName) {
    // Masquer tous les tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Désactiver tous les boutons
    document.querySelectorAll('.profile-tab').forEach(btn => {
        btn.classList.remove('active');
    });

    // Afficher le tab sélectionné
    const tabMap = {
        'view': 'view-tab',
        'edit': 'edit-tab',
        'matches': 'matches-tab'
    };

    if (tabMap[tabName]) {
        document.getElementById(tabMap[tabName]).classList.add('active');
    }

    // Activer le bouton correspondant
    const buttons = document.querySelectorAll('.profile-tab');
    const index = tabName === 'view' ? 0 : tabName === 'edit' ? 1 : 2;
    if (buttons[index]) {
        buttons[index].classList.add('active');
    }
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


// =====================================================
// MODALE PAIEMENT CERTIFICATION
// =====================================================

function openCertificationPaymentModal() {

    // Éviter plusieurs modales
    const existingModal = document.getElementById(
        'certificationPaymentModal'
    );

    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');

    modal.id = 'certificationPaymentModal';

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
    `;

    modal.innerHTML = `
        <div style="
            width: 100%;
            max-width: 460px;
            background: #ffffff;
            border-radius: 22px;
            padding: 24px;
            box-sizing: border-box;
            box-shadow: 0 25px 60px rgba(0,0,0,0.25);
            position: relative;
        ">

            <button
    type="button"
    id="closeCertificationPaymentBtn"
    style="
        position: absolute;
        top: 14px;
        right: 14px;
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 50%;
        background: #f1f5f9;
        color: #475569;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    "
    aria-label="Fermer"
>
    ✕
</button>

            <!-- Icône -->
            <div style="
                width: 64px;
                height: 64px;
                margin: 0 auto 15px;
                border-radius: 50%;
                background: #eff6ff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 30px;
            ">
                🛡️
            </div>

            <h2 style="
                margin: 0 0 8px;
                text-align: center;
                color: #1e293b;
                font-size: 1.35rem;
                font-weight: 800;
            ">
                Certification du profil
            </h2>

            <p style="
                margin: 0 0 20px;
                text-align: center;
                color: #64748b;
                line-height: 1.5;
                font-size: 0.92rem;
            ">
                Faites vérifier votre profil et obtenez
                le badge bleu de profil certifié.
            </p>

            <!-- Prix -->
            <div style="
                background: linear-gradient(
                    135deg,
                    #eff6ff,
                    #f8fafc
                );
                border: 1px solid #bfdbfe;
                border-radius: 15px;
                padding: 16px;
                margin-bottom: 18px;
                text-align: center;
            ">

                <div style="
                    color: #64748b;
                    font-size: 0.85rem;
                    margin-bottom: 4px;
                ">
                    Frais de certification
                </div>

                <div style="
                    color: #1d4ed8;
                    font-size: 1.65rem;
                    font-weight: 800;
                ">
                    5 000 FCFA
                </div>

            </div>

            <!-- Étapes -->
            <div style="
                background: #f8fafc;
                border-radius: 14px;
                padding: 15px;
                margin-bottom: 20px;
            ">

                <div style="
                    display: flex;
                    gap: 10px;
                    margin-bottom: 12px;
                    color: #334155;
                    font-size: 0.9rem;
                ">
                    <strong>1.</strong>
                    <span>Effectuez le paiement via Wave.</span>
                </div>

                <div style="
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    color: #334155;
    font-size: 0.9rem;
">
    <strong>2.</strong>
    <span>Après le paiement, revenez sur Alliance Chrétienne.</span>
</div>

<div style="
    display: flex;
    gap: 10px;
    color: #334155;
    font-size: 0.9rem;
">
    <strong>3.</strong>
    <span>
        Ouvrez <strong>✅ Demande de certification</strong>
        dans le menu et remplissez vos informations.
    </span>
</div>

            </div>

            <!-- Bouton Wave -->
            <button
                type="button"
                onclick="openCertificationWave()"
                style="
                    width: 100%;
                    padding: 14px 18px;
                    border: none;
                    border-radius: 12px;
                    background: #2563eb;
                    color: white;
                    font-size: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    margin-bottom: 10px;
                "
            >
                💳 Payer 5 000 FCFA avec Wave
            </button>

            <!-- Confirmation -->
            <button
        <button
    type="button"
    onclick="confirmCertificationPayment()"
    style="
        width: 100%;
        padding: 14px 18px;
        border: 1px solid #2563eb;
        border-radius: 12px;
        background: white;
        color: #2563eb;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
    "
>
    ✅ J'ai effectué le paiement
</button>

            <p style="
                margin: 15px 0 0;
                text-align: center;
                color: #94a3b8;
                font-size: 0.78rem;
                line-height: 1.4;
            ">
               Après le paiement, retournez dans le menu puis ouvrez
<strong>✅ Demande de certification</strong> pour remplir
vos informations et envoyer votre demande.
            </p>

        </div>
    `;

    // =====================================================
// FERMER AVEC LE BOUTON X
// =====================================================

const closeBtn = modal.querySelector(
    '#closeCertificationPaymentBtn'
);

if (closeBtn) {

    closeBtn.addEventListener('click', function () {
        modal.remove();
    });

}

modal.addEventListener('click', function (event) {

    if (event.target === modal) {
        modal.remove();
    }

});

document.body.appendChild(modal);
}

function openCertificationWave() {

    const waveUrl =
        'https://pay.wave.com/m/M_ci_b42Vl3wM4yJW/c/ci/';

    window.open(
        waveUrl,
        '_blank',
        'noopener,noreferrer'
    );
}

async function confirmCertificationPayment() {

const client = window.supabaseClient;

if (!client || !currentUser) {

    showAlert(
        'Vous devez être connecté.',
        'error'
    );

    return;
}

try {

    /*
     * Demander la capture du paiement
     */
    const fileInput = document.createElement('input');

    fileInput.type = 'file';
    fileInput.accept = 'image/*';

    const fileSelected = await new Promise((resolve) => {

        fileInput.onchange = () => {

            resolve(
                fileInput.files &&
                fileInput.files.length > 0
                    ? fileInput.files[0]
                    : null
            );

        };

        fileInput.click();

    });

    if (!fileSelected) {

        showAlert(
            '📷 Veuillez sélectionner la capture de votre paiement Wave.',
            'error'
        );

        return;
    }

    /*
     * Vérifier le type de fichier
     */
    if (!fileSelected.type.startsWith('image/')) {

        showAlert(
            'Veuillez sélectionner une image.',
            'error'
        );

        return;
    }

    /*
     * Limite de 5 Mo
     */
    if (fileSelected.size > 5 * 1024 * 1024) {

        showAlert(
            'La capture ne doit pas dépasser 5 Mo.',
            'error'
        );

        return;
    }

    showAlert(
        '⏳ Envoi de votre preuve de paiement...',
        'info'
    );

    const now = new Date().toISOString();

    /*
     * Vérifier la dernière demande de certification
     */
    const {
        data: existingRequest,
        error: existingError
    } = await client
        .from('verification_requests')
        .select('request_count')
        .eq('user_id', currentUser.id)
        .order('created_at', {
            ascending: false
        })
        .limit(1)
        .maybeSingle();

    if (existingError) {

        console.error(
            '❌ Erreur récupération demande précédente:',
            existingError
        );

        showAlert(
            'Impossible de vérifier votre demande précédente.',
            'error'
        );

        return;
    }

    const requestCount =
        existingRequest
            ? (existingRequest.request_count || 0) + 1
            : 1;

    /*
     * Nom unique pour la preuve
     */
    const fileExtension =
        fileSelected.name.includes('.')
            ? fileSelected.name
                .split('.')
                .pop()
                .toLowerCase()
            : 'jpg';

    const filePath =
        `${currentUser.id}/${Date.now()}.${fileExtension}`;

    /*
     * Upload dans Supabase Storage
     */
    const {
        error: uploadError
    } = await client.storage
        .from('certification-proofs')
        .upload(
            filePath,
            fileSelected,
            {
                cacheControl: '3600',
                upsert: false,
                contentType: fileSelected.type
            }
        );

    if (uploadError) {

        console.error(
            '❌ Erreur upload preuve:',
            uploadError
        );

        showAlert(
            'Impossible d\'envoyer la preuve de paiement : ' +
            uploadError.message,
            'error'
        );

        return;
    }

    console.log(
        '✅ Preuve de paiement envoyée:',
        filePath
    );

    /*
     * Créer la demande de certification
     */
    const {
        data: newRequest,
        error
    } = await client
        .from('verification_requests')
        .insert([{

            user_id: currentUser.id,

            status: 'pending',

            fee_amount: 5000,

            currency: 'XOF',

            payment_status: 'pending_verification',

            payment_date: now,

            payment_proof_url: filePath,

            review_started_at: null,

            request_count: requestCount,

            last_request_at: now

        }])
        .select()
        .single();

    if (error) {

        console.error(
            '❌ Erreur création demande:',
            error
        );

        /*
         * Si la demande échoue,
         * supprimer la preuve déjà envoyée
         */
        await client.storage
            .from('certification-proofs')
            .remove([filePath]);

        showAlert(
            'Impossible d\'envoyer votre demande : ' +
            error.message,
            'error'
        );

        return;
    }

    console.log(
        '✅ Demande de certification créée:',
        newRequest
    );

    /*
     * Fermer la modale de paiement
     */
    const paymentModal =
        document.getElementById(
            'certificationPaymentModal'
        );

    if (paymentModal) {

        paymentModal.remove();

    }

    showAlert(
        '✅ Paiement déclaré et preuve envoyée. Votre demande a été transmise à notre équipe pour vérification.',
        'success'
    );

    /*
     * Actualiser l'affichage
     */
    await loadCertificationStatus();

} catch (error) {

    console.error(
        '❌ Erreur confirmCertificationPayment:',
        error
    );

    showAlert(
        'Erreur : ' + error.message,
        'error'
    );
}

}



console.log('✅ profile.js chargé avec succès !');
