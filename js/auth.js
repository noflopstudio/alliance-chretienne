


console.log('🚀 auth.js chargé');

// =====================================================
// ALERTES
// =====================================================

function showAlert(message, type = 'info') {

    const alertContainer =
        document.getElementById('alertContainer');

    if (!alertContainer) {
        console.log(`[${type}] ${message}`);
        return;
    }

    const alert = document.createElement('div');

    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);

    setTimeout(() => {
        if (alert && alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}


// =====================================================
// UTILISATEUR CONNECTÉ
// =====================================================

async function getCurrentUser() {

    try {

        if (!window.supabaseClient) {
            console.error('❌ Supabase Client introuvable');
            return null;
        }

        const {
            data,
            error
        } = await window.supabaseClient.auth.getUser();

        if (error) {
            return null;
        }

        return data.user || null;

    } catch (error) {

        console.error(
            '❌ Erreur getCurrentUser:',
            error
        );

        return null;
    }
}

async function isCurrentUserAdmin(user) {
    try {
        if (!user) {
            return false;
        }

        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('❌ Erreur vérification admin:', error);
            return false;
        }

        return data?.is_admin === true;

    } catch (error) {
        console.error('❌ Erreur isCurrentUserAdmin:', error);
        return false;
    }
}
async function logout() {

    console.log('🚪 Déconnexion demandée...');

    try {

        if (!window.supabaseClient) {
            console.error(
                '❌ Supabase Client introuvable'
            );
            return;
        }

        const logoutButtons = [
            document.getElementById('logoutButton'),
            document.getElementById('logoutBtn')
        ];

        logoutButtons.forEach(button => {

            if (button) {
                button.style.pointerEvents = 'none';
                button.textContent = '⏳ Déconnexion...';
            }

        });


        // Déconnexion Supabase
        const { error } =
            await window.supabaseClient.auth.signOut();

        if (error) {

            console.error(
                '❌ Erreur déconnexion:',
                error
            );

            showAlert(
                'Impossible de se déconnecter : ' +
                error.message,
                'error'
            );

            logoutButtons.forEach(button => {

                if (button) {
                    button.style.pointerEvents = 'auto';
                    button.textContent =
                        '🚪 Déconnexion';
                }

            });

            return;
        }


        console.log(
            '✅ Déconnexion Supabase réussie'
        );


        // Nettoyage local
        sessionStorage.clear();


        // Redirection vers login
        window.location.href = 'login.html';


    } catch (error) {

        console.error(
            '❌ Erreur générale déconnexion:',
            error
        );

        showAlert(
            'Erreur lors de la déconnexion.',
            'error'
        );
    }
}


// =====================================================
// VALIDATION INSCRIPTION
// =====================================================

function validateRegisterForm(data) {

    // Regex email correcte
    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(data.email)) {

        showAlert(
            'Veuillez saisir une adresse email valide.',
            'error'
        );

        return false;
    }

    // Mot de passe
    if (data.password.length < 8) {

        showAlert(
            'Le mot de passe doit contenir au moins 8 caractères.',
            'error'
        );

        return false;
    }


    // Confirmation
    if (
        data.password !==
        data.confirmPassword
    ) {

        showAlert(
            'Les mots de passe ne correspondent pas.',
            'error'
        );

        return false;
    }


    // Date de naissance
    const birthDate =
        new Date(data.birthDate);

    const today =
        new Date();

    let age =
        today.getFullYear() -
        birthDate.getFullYear();

    const monthDiff =
        today.getMonth() -
        birthDate.getMonth();

    if (
        monthDiff < 0 ||
        (
            monthDiff === 0 &&
            today.getDate() <
            birthDate.getDate()
        )
    ) {
        age--;
    }


    // Minimum 18 ans
    if (age < 18) {

        showAlert(
            'Vous devez avoir au moins 18 ans.',
            'error'
        );

        return false;
    }


    // Age recherche
    if (
        data.searchMinAge >=
        data.searchMaxAge
    ) {

        showAlert(
            "L'âge minimum doit être inférieur à l'âge maximum.",
            'error'
        );

        return false;
    }


    // Conditions
    if (!data.agreeTerms) {

        showAlert(
            "Vous devez accepter les conditions d'utilisation.",
            'error'
        );

        return false;
    }


    return true;
}


// =====================================================
// DOM CONTENT LOADED
// =====================================================

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        console.log(
            '🚀 Initialisation auth.js...'
        );


        // =================================================
        // VÉRIFICATION SUPABASE
        // =================================================

        if (!window.supabaseClient) {

            console.error(
                '❌ window.supabaseClient est introuvable.'
            );

            return;
        }

        console.log(
            '✅ Client Supabase détecté'
        );


        // =================================================
        // DÉCONNEXION - LIEN HTML
        // =================================================

        const logoutButton =
            document.getElementById(
                'logoutButton'
            );

        if (logoutButton) {

            console.log(
                '✅ Bouton #logoutButton détecté'
            );

            logoutButton.addEventListener(
                'click',
                async (event) => {

                    event.preventDefault();

                    await logout();
                }
            );
        }


        // =================================================
        // INSCRIPTION
        // =================================================

        const registerForm =
            document.getElementById(
                'registerForm'
            );

        if (registerForm) {

            console.log(
                '📝 Formulaire inscription détecté'
            );


            // Si déjà connecté
            const currentUser =
                await getCurrentUser();

            if (currentUser) {

                window.location.href =
                    'search.html';

                return;
            }


            registerForm.addEventListener(
                'submit',
                async (event) => {

                    event.preventDefault();


                    // -----------------------------------------
                    // RÉCUPÉRER LES DONNÉES
                    // -----------------------------------------

                    const data = {

                        firstName:
                            document
                                .getElementById('firstName')
                                .value
                                .trim(),

                        email:
                            document
                                .getElementById('email')
                                .value
                                .trim(),

                        password:
                            document
                                .getElementById('password')
                                .value,

                        confirmPassword:
                            document
                                .getElementById(
                                    'confirmPassword'
                                )
                                .value,

                        birthDate:
                            document
                                .getElementById(
                                    'birthDate'
                                )
                                .value,

                        gender:
                            document
                                .getElementById(
                                    'gender'
                                )
                                .value,

                        city:
                            document
                                .getElementById('city')
                                .value
                                .trim(),

                        country:
                            document
                                .getElementById(
                                    'country'
                                )
                                .value
                                .trim(),

                        denomination:
                            document
                                .getElementById(
                                    'denomination'
                                )
                                .value,

                        churchFrequency:
                            document
                                .getElementById(
                                    'churchFrequency'
                                )
                                .value,

                        faithEngagement:
                            document
                                .getElementById(
                                    'faithEngagement'
                                )
                                .value,

                        bio:
                            document
                                .getElementById('bio')
                                .value
                                .trim(),

                        lookingFor:
                            document
                                .getElementById(
                                    'lookingFor'
                                )
                                .value
                                .trim(),

                        favoriteVerse:
                            document
                                .getElementById(
                                    'favoriteVerse'
                                )
                                .value
                                .trim(),

                        searchGender:
                            document
                                .getElementById(
                                    'searchGender'
                                )
                                .value,

                        searchMinAge:
                            parseInt(
                                document
                                    .getElementById(
                                        'searchMinAge'
                                    )
                                    .value
                            ),

                        searchMaxAge:
                            parseInt(
                                document
                                    .getElementById(
                                        'searchMaxAge'
                                    )
                                    .value
                            ),

                        searchDistance:
                            parseInt(
                                document
                                    .getElementById(
                                        'searchDistance'
                                    )
                                    .value
                            ),

                        agreeTerms:
                            document
                                .getElementById(
                                    'agreeTerms'
                                )
                                .checked
                    };


                    // -----------------------------------------
                    // VALIDATION
                    // -----------------------------------------

                    if (
                        !validateRegisterForm(data)
                    ) {
                        return;
                    }


                    const submitBtn =
                        registerForm.querySelector(
                            'button[type="submit"]'
                        );

                    const originalText =
                        submitBtn
                            ? submitBtn.textContent
                            : 'Créer mon compte';


                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent =
                            'Création en cours...';
                    }


                    try {

                        console.log(
                            '🔐 Création du compte...'
                        );


                        // -------------------------------------
                        // SUPABASE SIGN UP
                        // -------------------------------------

                        const {
                            data: authData,
                            error: authError
                        } =
                            await window
                                .supabaseClient
                                .auth
                                .signUp({

                                    email:
                                        data.email,

                                    password:
                                        data.password,

                                    options: {

                                        data: {

                                            first_name:
                                                data.firstName,

                                            birth_date:
                                                data.birthDate,

                                            gender:
                                                data.gender,

                                            city:
                                                data.city,

                                            country:
                                                data.country,

                                            denomination:
                                                data.denomination,

                                            church_frequency:
                                                data.churchFrequency,

                                            faith_engagement:
                                                data.faithEngagement,

                                            bio:
                                                data.bio,

                                            looking_for:
                                                data.lookingFor,

                                            favorite_verse:
                                                data.favoriteVerse,

                                            search_gender:
                                                data.searchGender,

                                            search_min_age:
                                                data.searchMinAge,

                                            search_max_age:
                                                data.searchMaxAge,

                                            search_distance:
                                                data.searchDistance
                                        }
                                    }
                                });


                        // -------------------------------------
                        // ERREUR
                        // -------------------------------------

                        if (authError) {

                            console.error(
                                '❌ Erreur inscription:',
                                authError
                            );

                            showAlert(
                                "Erreur d'inscription : " +
                                authError.message,
                                'error'
                            );

                            if (submitBtn) {
                                submitBtn.disabled =
                                    false;

                                submitBtn.textContent =
                                    originalText;
                            }

                            return;
                        }


                        // -------------------------------------
                        // UTILISATEUR NON CRÉÉ
                        // -------------------------------------

                        if (!authData.user) {

                            showAlert(
                                'Erreur lors de la création du compte.',
                                'error'
                            );

                            if (submitBtn) {
                                submitBtn.disabled =
                                    false;

                                submitBtn.textContent =
                                    originalText;
                            }

                            return;
                        }


                        console.log(
                            '✅ Compte créé:',
                            authData.user.id
                        );


                        showAlert(
                            '✅ Compte créé avec succès ! Vérifiez votre email pour confirmer votre inscription.',
                            'success'
                        );


                        setTimeout(
                            () => {

                                window.location.href =
                                    'login.html';

                            },
                            2000
                        );

                    } catch (error) {

                        console.error(
                            '❌ Erreur générale:',
                            error
                        );

                        showAlert(
                            'Erreur : ' +
                            error.message,
                            'error'
                        );

                        if (submitBtn) {
                            submitBtn.disabled =
                                false;

                            submitBtn.textContent =
                                originalText;
                        }
                    }
                }
            );
        }


        // =================================================
        // CONNEXION EMAIL
        // =================================================

        const loginForm =
            document.getElementById(
                'loginForm'
            );

        if (loginForm) {

            console.log(
                '🔐 Formulaire connexion détecté'
            );


            // Si déjà connecté
            const currentUser =
                await getCurrentUser();

            if (currentUser) {

                console.log(
                    '👤 Déjà connecté → search.html'
                );

                window.location.href =
                    'search.html';

                return;
            }


            loginForm.addEventListener(
                'submit',
                async (event) => {

                    event.preventDefault();


                    const email =
                        document
                            .getElementById(
                                'loginEmail'
                            )
                            .value
                            .trim();


                    const password =
                        document
                            .getElementById(
                                'loginPassword'
                            )
                            .value;


                    if (!email || !password) {

                        showAlert(
                            'Veuillez remplir tous les champs.',
                            'error'
                        );

                        return;
                    }


                    const submitBtn =
                        loginForm.querySelector(
                            'button[type="submit"]'
                        );


                    const originalText =
                        submitBtn
                            ? submitBtn.textContent
                            : 'Se connecter';


                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent =
                            'Connexion en cours...';
                    }


                    try {

                        const {
                            data,
                            error
                        } =
                            await window
                                .supabaseClient
                                .auth
                                .signInWithPassword({

                                    email: email,

                                    password: password
                                });


                        // Erreur
                        if (error) {

                            console.error(
                                '❌ Erreur connexion:',
                                error
                            );

                            showAlert(
                                'Email ou mot de passe incorrect.',
                                'error'
                            );

                            if (submitBtn) {
                                submitBtn.disabled =
                                    false;

                                submitBtn.textContent =
                                    originalText;
                            }

                            return;
                        }


                        // Aucun utilisateur
                        if (!data.user) {

                            showAlert(
                                'Erreur de connexion.',
                                'error'
                            );

                            if (submitBtn) {
                                submitBtn.disabled =
                                    false;

                                submitBtn.textContent =
                                    originalText;
                            }

                            return;
                        }


                        console.log(
    '✅ Connexion réussie:',
    data.user.id
);

// Vérifier le rôle du compte
const admin = await isCurrentUserAdmin(data.user);

console.log(
    admin
        ? '👑 Compte administrateur détecté'
        : '👤 Compte membre détecté'
);

showAlert(
    admin
        ? '👑 Connexion administrateur réussie !'
        : '✅ Connexion réussie !',
    'success'
);

// Redirection selon le rôle
setTimeout(() => {

    if (admin) {
        window.location.href = 'admin-dashboard.html';
    } else {
        window.location.href = 'search.html';
    }

}, 800);

} catch (error) {

    console.error(
        '❌ Erreur générale:',
        error
    );

    showAlert(
        'Erreur : ' +
        error.message,
        'error'
    );

    if (submitBtn) {
        submitBtn.disabled = false;

        submitBtn.textContent = originalText;
    }

                    }
                }
            );
        }

        const googleLoginBtn =
            document.getElementById(
                'googleLoginBtn'
            );

        if (googleLoginBtn) {

            console.log(
                '🔵 Bouton Google détecté'
            );


            googleLoginBtn.addEventListener(
                'click',
                async () => {

                    try {

                        googleLoginBtn.disabled =
                            true;

                        googleLoginBtn.textContent =
                            'Connexion avec Google...';


                        const {
                            data,
                            error
                        } =
                            await window
                                .supabaseClient
                                .auth
                                .signInWithOAuth({

                                    provider:
                                        'google',

                                    options: {

                                      redirectTo:
    window.location.origin +
    '/auth-callback.html'
                                    }
                                });


                        if (error) {

                            console.error(
                                '❌ Erreur Google:',
                                error
                            );

                            showAlert(
                                'Erreur Google : ' +
                                error.message,
                                'error'
                            );

                            googleLoginBtn.disabled =
                                false;

                            googleLoginBtn.textContent =
                                '🔵 Continuer avec Google';

                            return;
                        }


                        console.log(
                            '✅ Redirection Google...',
                            data
                        );

                    } catch (error) {

                        console.error(
                            '❌ Erreur Google:',
                            error
                        );

                        showAlert(
                            'Erreur : ' +
                            error.message,
                            'error'
                        );

                        googleLoginBtn.disabled =
                            false;

                        googleLoginBtn.textContent =
                            '🔵 Continuer avec Google';
                    }
                }
            );
        }


        // =================================================
        // MENU UTILISATEUR
        // =================================================

        const loggedUser =
            await getCurrentUser();


        if (
            loggedUser &&
            document.querySelector(
                '.user-menu'
            )
        ) {

            const userMenu =
                document.querySelector(
                    '.user-menu'
                );


            userMenu.innerHTML = `

                <div class="user-info">

                    <span>👤 Connecté</span>

                    <a
                        href="#"
                        id="logoutBtn"
                        style="
                            color: var(--danger-color);
                            font-weight: 600;
                        "
                    >
                        🚪 Déconnexion
                    </a>

                </div>

            `;


            const logoutBtn =
                document.getElementById(
                    'logoutBtn'
                );


            if (logoutBtn) {

                logoutBtn.addEventListener(
                    'click',
                    async (event) => {

                        event.preventDefault();

                        await logout();
                    }
                );
            }
        }

    }
);


console.log(
    '✅ auth.js chargé avec succès !'
);
