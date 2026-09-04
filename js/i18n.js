const SUPPORTED_LANGUAGES = ['fr', 'en', 'es'];

let currentTranslations = {};

window.i18nReady = null;

function t(key, fallback = key) {

    const value = key
        .split('.')
        .reduce(
            (obj, part) => obj?.[part],
            currentTranslations
        );

    return value !== undefined && value !== null
        ? value
        : fallback;
}

window.t = t;

async function loadLanguage(lang = 'fr') {

    if (!SUPPORTED_LANGUAGES.includes(lang)) {
        console.warn(`⚠️ Langue inconnue : ${lang}`);
        lang = 'fr';
    }

    try {

        console.log(`🌍 Chargement de la langue : ${lang}`);

        const response = await fetch(
            `i18n/${lang}.json?v=${Date.now()}`
        );

        if (!response.ok) {
            throw new Error(
                `Impossible de charger i18n/${lang}.json (${response.status})`
            );
        }

        const translations = await response.json();

        currentTranslations = translations;

        console.log(`✅ ${lang}.json chargé`, translations);

        document
            .querySelectorAll('[data-i18n]')
            .forEach(element => {

                const key = element.dataset.i18n;

                const value = key
                    .split('.')
                    .reduce(
                        (obj, part) => obj?.[part],
                        translations
                    );

                if (value !== undefined && value !== null) {

                    element.textContent = value;

                } else {

                    console.warn(
                        `⚠️ Traduction manquante : ${key} dans ${lang}.json`
                    );
                }
            });

        document
            .querySelectorAll('[data-i18n-placeholder]')
            .forEach(element => {

                const key = element.dataset.i18nPlaceholder;

                const value = key
                    .split('.')
                    .reduce(
                        (obj, part) => obj?.[part],
                        translations
                    );

                if (value !== undefined && value !== null) {

                    element.placeholder = value;

                } else {

                    console.warn(
                        `⚠️ Placeholder manquant : ${key} dans ${lang}.json`
                    );
                }
            });

        document.documentElement.lang = lang;

        localStorage.setItem('language', lang);

        const selector =
            document.getElementById('languageSelector');

        if (selector) {
            selector.value = lang;
        }

        console.log(
            `🌐 Langue chargée avec succès : ${lang}`
        );

        return translations;

    } catch (error) {

        console.error(
            `❌ Erreur de traduction pour ${lang} :`,
            error
        );

        return null;
    }
}

document.addEventListener(
    'DOMContentLoaded',
    () => {

        console.log('🚀 Initialisation i18n...');

        const selector =
            document.getElementById('languageSelector');

        const savedLanguage =
            localStorage.getItem('language') || 'fr';

        console.log(
            `💾 Langue sauvegardée : ${savedLanguage}`
        );

        window.i18nReady =
            loadLanguage(savedLanguage);

        if (selector) {

            selector.addEventListener(
                'change',
                async function () {

                    const selectedLanguage =
                        this.value;

                    console.log(
                        `🔄 Changement de langue : ${selectedLanguage}`
                    );

                    await loadLanguage(
                        selectedLanguage
                    );
                }
            );

            console.log(
                '✅ Sélecteur de langue détecté'
            );

        } else {

            console.warn(
                '⚠️ #languageSelector introuvable'
            );
        }
    }
);