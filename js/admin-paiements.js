/* ==========================================================
   💰 ADMIN — PAIEMENTS
   ALLIANCE CHRÉTIENNE
   ========================================================== */

let tousLesPaiements = [];


/* ==========================================================
   🚀 INITIALISATION
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {

    console.log('🔥 admin-paiements.js chargé');

    chargerPaiements();

    initialiserFiltres();

});


/* ==========================================================
   💰 CHARGER LES PAIEMENTS
========================================================== */

async function chargerPaiements() {

    try {

        if (!window.supabaseClient) {

            throw new Error(
                'Client Supabase non disponible.'
            );

        }

        console.log('💰 Chargement des paiements...');


        /* ======================================================
           🔐 VÉRIFIER LA SESSION
        ====================================================== */

        const {
            data: { user },
            error: authError
        } = await window.supabaseClient.auth.getUser();


        if (authError) {

            throw authError;

        }


        if (!user) {

            throw new Error(
                'Administrateur non connecté.'
            );

        }


        console.log(
            '👤 Administrateur connecté :',
            user.email
        );


        /* ======================================================
           💰 RÉCUPÉRER LES PAIEMENTS
           
           IMPORTANT :
           Ici on fait SELECT et non INSERT.
        ====================================================== */

        const {
            data,
            error
        } = await window.supabaseClient
            .from('certification_requests')
            .select(`
                id,
                user_id,
                full_name,
                phone,
                email,
                payment_phone,
                amount,
                transaction_id,
                payment_date,
                payment_proof_url,
                message,
                status,
                payment_confirmed,
                admin_note,
                created_at,
                updated_at
            `)
            .order('created_at', {
                ascending: false
            });


        if (error) {

            throw error;

        }


        console.log(
            '💰 DONNÉES SUPABASE :',
            data
        );


        /* ======================================================
           👑 EXCLURE L'ADMINISTRATEUR
        ====================================================== */

        const paiementsMembres =
            (data || []).filter(item => {

                const nom =
                    String(
                        item.full_name || ''
                    )
                    .trim()
                    .toLowerCase();


                const estAdmin =
                    nom === 'yelo joël' ||
                    nom === 'yelo joel';


                if (estAdmin) {

                    console.log(
                        '👑 Demande administrateur ignorée :',
                        item
                    );

                    return false;

                }


                return true;

            });


        /* ======================================================
           🔄 TRANSFORMATION DES DONNÉES
        ====================================================== */

        tousLesPaiements =
            paiementsMembres.map(item => {

                let statut = 'pending';


                /* ⭐ PAIEMENT CONFIRMÉ */

                if (
                    item.payment_confirmed === true
                ) {

                    statut = 'confirmed';

                }


                /* ❌ PAIEMENT REJETÉ */

                else if (
                    String(
                        item.status || ''
                    ).toLowerCase() === 'rejected'
                ) {

                    statut = 'rejected';

                }


                return {

                    id:
                        item.id,

                    userId:
                        item.user_id,

                    membre:
                        item.full_name ||
                        'Membre',

                    email:
                        item.email ||
                        '—',

                    montant:
                        Number(
                            item.amount || 0
                        ),

                    transaction:
                        item.transaction_id ||
                        '—',

                    telephone:
                        item.payment_phone ||
                        item.phone ||
                        '—',

                    date:
                        item.payment_date ||
                        item.updated_at ||
                        item.created_at,

                    statut:
                        statut,

                    preuve:
                        item.payment_proof_url,

                    message:
                        item.message,

                    adminNote:
                        item.admin_note

                };

            });


        console.log(
            '💳 PAIEMENTS DES MEMBRES :',
            tousLesPaiements
        );


        /* ======================================================
           📊 STATISTIQUES
        ====================================================== */

        calculerStatistiques();


        /* ======================================================
           📋 AFFICHAGE
        ====================================================== */

        afficherPaiements(
            tousLesPaiements
        );

    }


    catch (error) {

        console.error(
            '❌ ERREUR PAIEMENTS :',
            error
        );


        afficherErreur(
            error.message
        );

    }

}


/* ==========================================================
   📊 STATISTIQUES
   ========================================================== */

function calculerStatistiques() {


    const confirmes =
        tousLesPaiements.filter(
            paiement =>
                paiement.statut === 'confirmed'
        );


    const enAttente =
        tousLesPaiements.filter(
            paiement =>
                paiement.statut === 'pending'
        );


    const rejetes =
        tousLesPaiements.filter(
            paiement =>
                paiement.statut === 'rejected'
        );


    /*
     * 💰 TOTAL ENCAISSÉ
     */

    const totalEncaisse =
        confirmes.reduce(
            (
                total,
                paiement
            ) => {

                return (
                    total +
                    paiement.montant
                );

            },
            0
        );


    /*
     * 💳 TOTAL PAIEMENTS
     *
     * On compte les demandes affichées.
     */

   const totalPaiements =
    confirmes.length +


    enAttente.length;
    const totalAmount =
        document.getElementById(
            'totalAmount'
        );


    const totalPayments =
        document.getElementById(
            'totalPayments'
        );


    const confirmedPayments =
        document.getElementById(
            'confirmedPayments'
        );


    const pendingPayments =
        document.getElementById(
            'pendingPayments'
        );


    if (totalAmount) {

        totalAmount.textContent =
            formaterMontant(
                totalEncaisse
            );

    }


    if (totalPayments) {

        totalPayments.textContent =
            totalPaiements;

    }


    if (confirmedPayments) {

        confirmedPayments.textContent =
            confirmes.length;

    }


    if (pendingPayments) {

        pendingPayments.textContent =
            enAttente.length;

    }


    console.log(
        '📊 STATISTIQUES :',
        {
            totalEncaisse,
            totalPaiements,
            confirmes: confirmes.length,
            enAttente: enAttente.length,
            rejetes: rejetes.length
        }
    );

}


/* ==========================================================
   📋 AFFICHER LES PAIEMENTS
   ========================================================== */

function afficherPaiements(
    paiements
) {

    const tbody =
        document.getElementById(
            'paymentsTableBody'
        );


    if (!tbody) {

        console.error(
            '❌ paymentsTableBody introuvable.'
        );

        return;

    }


    if (!paiements.length) {

        tbody.innerHTML = `

            <tr>

                <td colspan="6">

                    <div class="empty-state">

                        <div class="empty-icon">
                            💳
                        </div>

                        <h3>
                            Aucun paiement à afficher
                        </h3>

                        <p>
                            Les paiements des membres
                            apparaîtront ici.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        paiements.map(
            paiement => {


                let statutHTML = '';


                if (
                    paiement.statut ===
                    'confirmed'
                ) {

                    statutHTML = `

                        <span class="
                            status-badge
                            status-confirmed
                        ">
                            ✅ Confirmé
                        </span>

                    `;

                }
else if (
    String(paiement.statut || '').toLowerCase() === 'rejected'
) {

    statutHTML = `

        <span class="status-badge status-rejected">
            ❌ Rejeté
        </span>

    `;

}

                else {

                    statutHTML = `

                        <span class="
                            status-badge
                            status-pending
                        ">
                            ⏳ En attente
                        </span>

                    `;

                }


                const avatar = `
                    <div
                        class="member-avatar"
                        style="
                            display:grid;
                            place-items:center;
                            font-size:18px;
                        "
                    >
                        👤
                    </div>
                `;


                return `

                    <tr>

                        <td>

                            <div class="member-cell">

                                ${avatar}

                                <div>

                                    <div class="member-name">

                                        ${escapeHtml(
                                            paiement.membre
                                        )}

                                    </div>

                                    <span class="member-email">

                                        ${escapeHtml(
                                            paiement.email
                                        )}

                                    </span>

                                </div>

                            </div>

                        </td>


                        <td>

                            <span class="payment-type">

                                🔵 Certification

                            </span>

                        </td>


                        <td>

                            <span class="amount">

                                ${formaterMontant(
                                    paiement.montant
                                )}

                            </span>

                        </td>


                        <td>

                            <span class="transaction">

                                ${escapeHtml(
                                    paiement.transaction
                                )}

                            </span>

                        </td>


                        <td>

                            ${formaterDate(
                                paiement.date
                            )}

                        </td>


                        <td>

                            ${statutHTML}

                        </td>

                    </tr>

                `;

            }
        ).join('');

}


/* ==========================================================
   🔎 RECHERCHE + FILTRE
   ========================================================== */

function initialiserFiltres() {

    const search =
        document.getElementById(
            'paymentSearch'
        );


    const filter =
        document.getElementById(
            'paymentStatusFilter'
        );


    if (search) {

        search.addEventListener(
            'input',
            appliquerFiltres
        );

    }


    if (filter) {

        filter.addEventListener(
            'change',
            appliquerFiltres
        );

    }

}


/* ==========================================================
   🔎 APPLIQUER LES FILTRES
   ========================================================== */

function appliquerFiltres() {

    const search =
        document.getElementById(
            'paymentSearch'
        );


    const filter =
        document.getElementById(
            'paymentStatusFilter'
        );


    const recherche =
        (
            search?.value ||
            ''
        )
        .trim()
        .toLowerCase();


    const statut =
        filter?.value ||
        'all';


    const resultats =
        tousLesPaiements.filter(
            paiement => {


                const texte =
                    [
                        paiement.membre,
                        paiement.email,
                        paiement.transaction,
                        paiement.telephone
                    ]
                    .join(' ')
                    .toLowerCase();


                const correspondRecherche =
                    !recherche ||
                    texte.includes(
                        recherche
                    );


                const correspondStatut =
                    statut === 'all' ||
                    paiement.statut === statut;


                return (
                    correspondRecherche &&
                    correspondStatut
                );

            }
        );


    afficherPaiements(
        resultats
    );

}


/* ==========================================================
   💰 FORMAT FCFA
   ========================================================== */

function formaterMontant(
    montant
) {

    return (
        Number(
            montant || 0
        ).toLocaleString(
            'fr-FR'
        ) +
        ' FCFA'
    );

}


/* ==========================================================
   📅 FORMAT DATE
   ========================================================== */

function formaterDate(
    date
) {

    if (!date) {

        return '—';

    }


    try {

        return new Date(
            date
        ).toLocaleString(
            'fr-FR',
            {
                dateStyle: 'short',
                timeStyle: 'short'
            }
        );

    }

    catch {

        return '—';

    }

}


/* ==========================================================
   🛡️ PROTECTION HTML
   ========================================================== */

function escapeHtml(
    value
) {

    return String(
        value ?? ''
    )
    .replace(
        /&/g,
        '&amp;'
    )
    .replace(
        /</g,
        '&lt;'
    )
    .replace(
        />/g,
        '&gt;'
    )
    .replace(
        /"/g,
        '&quot;'
    )
    .replace(
        /'/g,
        '&#039;'
    );

}


/* ==========================================================
   ❌ AFFICHER ERREUR
   ========================================================== */

function afficherErreur(
    message
) {

    const tbody =
        document.getElementById(
            'paymentsTableBody'
        );


    if (!tbody) {

        return;

    }


    tbody.innerHTML = `

        <tr>

            <td colspan="6">

                <div class="empty-state">

                    <div class="empty-icon">
                        ❌
                    </div>

                    <h3>
                        Impossible de charger les paiements
                    </h3>

                    <p>
                        ${escapeHtml(
                            message
                        )}
                    </p>

                </div>

            </td>

        </tr>

    `;

}