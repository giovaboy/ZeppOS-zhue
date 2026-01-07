/**
 * ESLint Configuration per progetti Zepp OS (ZML)
 * Aiuta a far rispettare le convenzioni ES6 e a prevenire ReferenceError.
 */
module.exports = {
    // 1. Parser: Analizza il codice JS (Babel è ottimo per l'ES6)
    parserOptions: {
        // Obbligatorio per le features moderne (ES6/ES2015)
        ecmaVersion: 2020,
        sourceType: 'module',
    },

    // 2. Ambiente: Definisce le variabili globali pre-definite
    env: {
        // Abilita le variabili globali del browser (come setTimeout, console, ecc.)
        browser: true,
        // Abilita le features ES6
        es6: true
    },

    // 3. Regole base: Raccomandazioni standard per un codice pulito
    extends: [
        'eslint:recommended',
    ],

    // 4. Regole Custom e Setup Zepp OS
    rules: {
        // REGOLA FONDAMENTALE (per evitare l'errore COLORS)
        // Rende "error" la segnalazione di variabili non definite.
        'no-undef': 'error',

        // VARIABILI GLOBALI SPECIFICHE DI ZEPP OS (ZeppOS Runtime Globals)
        // Aggiungiamo qui le variabili che il linter *non* deve considerare "non definite".
        // Ad esempio, App(), Page(), console, ecc.
        // Nota: se usi 'App' e 'Page' in tutti i file, puoi lasciarle fuori da globals
        // ma è più sicuro definirle qui, insieme agli oggetti API globali.
        'no-unused-vars': ['warn', { 'args': 'none' }],
        'no-prototype-builtins': 'off',
    },

    // 5. Variabili Globali Zepp OS
    globals: {
        // API ZeppOS di primo livello
        App: 'readonly',
        Page: 'readonly',
        AppWidget: 'readonly',
        AppSideService: 'readonly',
        AppSettingsPage: 'readonly',
        SecondaryWidget: 'readonly',
        getApp: 'readonly',
        // Oggetti e API comuni
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        // Includi qui le costanti usate in modo implicito se non riesci a importarle ovunque
    }
};