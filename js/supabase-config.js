const SUPABASE_URL = 'https://qyavfkdjhrbrqytmfyqr.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_3pcPJefEfJyVfMIxPl_y8Q_ZiKNeFu7';
// Création du client Supabase
window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// Récupérer l'utilisateur connecté
async function getCurrentUser() {
    try {
        const {
            data: { user },
            error
        } = await window.supabaseClient.auth.getUser();

        if (error) {
            console.error('Erreur getCurrentUser:', error);
            return null;
        }

        return user;
    } catch (error) {
        console.error('Erreur getCurrentUser:', error);
        return null;
    }
}

// Vérifier que l'utilisateur est connecté
async function requireAuth() {
    const user = await getCurrentUser();

    if (!user) {
        window.location.href = 'login.html';
        return null;
    }

    return user;
}

// Déconnexion
async function logout() {
    try {
        await window.supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erreur logout:', error);
    }
}

console.log('✅ Supabase configuré avec succès !');
console.log('✅ Client Supabase disponible :', !!window.supabaseClient);