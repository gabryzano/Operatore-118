/**
 * Determina se un mezzo è operativo in base a giorno e orario di servizio da mezzi_sra.json
 * @param {Object} mezzo - Il mezzo da verificare
 * @param {string} orarioSimulato - Orario simulato in formato "HH:mm"
 * @param {Date} [dataSimulata=new Date()] - Data simulata (opzionale)
 * @param {string} [giornoSimulato=null] - Giorno simulato in italiano (es: "Lunedì")
 * @returns {boolean} - true se il mezzo è operativo, false altrimenti
 */
function isMezzoOperativo(mezzo, orarioSimulato, dataSimulata = new Date(), giornoSimulato = null) {
    // Mappa giorni abbreviati <-> italiano
    const giorniSettimanaIT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    const giorniSettimanaEN = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

    // Determina il giorno attuale
    let giornoCorrente;
    if (giornoSimulato) {
        const idx = giorniSettimanaIT.indexOf(giornoSimulato);
        giornoCorrente = idx !== -1 ? giorniSettimanaEN[idx] : giorniSettimanaEN[0];
    } else {
        const idx = dataSimulata.getDay();
        const idxLun = (idx === 0) ? 6 : idx - 1;
        giornoCorrente = giorniSettimanaEN[idxLun];
    }
    giornoCorrente = giornoCorrente.toUpperCase();

    // --- GESTIONE GIORNI ---
    const giorniLavoro = (mezzo.Giorni || mezzo.giorni || "LUN-DOM").toUpperCase().replace(/\s/g, '');
    const giorniIT = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
    let giornoOK = false;
    if (giorniLavoro === "LUN-DOM") {
        giornoOK = true;
    } else if (giorniLavoro.includes('-')) {
        const [start, end] = giorniLavoro.split('-');
        const idxStart = giorniIT.indexOf(start);
        const idxEnd = giorniIT.indexOf(end);
        if (idxStart !== -1 && idxEnd !== -1) {
            if (idxStart <= idxEnd) {
                giornoOK = giorniIT.slice(idxStart, idxEnd + 1).includes(giornoCorrente);
            } else {
                giornoOK = giorniIT.slice(idxStart).concat(giorniIT.slice(0, idxEnd + 1)).includes(giornoCorrente);
            }
        }
    } else if (giorniLavoro.includes(',')) {
        giornoOK = giorniLavoro.split(',').map(g => g.trim()).includes(giornoCorrente);
    } else if (giorniLavoro === "RANDOM") {
        giornoOK = Math.random() < 0.5;
    } else {
        giornoOK = giorniLavoro === giornoCorrente;
    }
    if (!giornoOK) return false;
    // Per convenzione H24, gestisci solo se full-day o non specificato, altrimenti rispetta l'orario di lavoro
    if (mezzo.convenzione && mezzo.convenzione.toUpperCase() === 'H24') {
        const orarioLavoro = mezzo["Orario di lavoro"] || "";
        // Se non specificato o indica full-day
        if (!orarioLavoro || orarioLavoro.match(/^(00:00\s*-\s*00:00|dalle\s*00:00\s*alle\s*00:00)$/i)) {
            return true;
        }
        // Altrimenti continua al controllo orario
    }

    // --- GESTIONE ORARIO ---
    // Se non viene passato orarioSimulato valido, considera il mezzo operativo tutto il giorno
    let minutoGiorno = 0;
    if (orarioSimulato && /^\d{2}:\d{2}$/.test(orarioSimulato)) {
        let [ore, minuti] = orarioSimulato.split(':').map(Number);
        minutoGiorno = ore * 60 + minuti;
    } else {
        // Se non c'è orarioSimulato, considera il mezzo operativo tutto il giorno
        return true;
    }

    const orarioLavoro = mezzo["Orario di lavoro"] || "";
    let orarioMatch = orarioLavoro.match(/(?:dalle|Dalle)\s*(\d{1,2}):(\d{2})\s*alle\s*(\d{1,2}):(\d{2})/);
    if (orarioMatch) {
        const inizio = parseInt(orarioMatch[1], 10) * 60 + parseInt(orarioMatch[2], 10);
        const fine = parseInt(orarioMatch[3], 10) * 60 + parseInt(orarioMatch[4], 10);
        if (inizio < fine) {
            return minutoGiorno >= inizio && minutoGiorno < fine;
        } else {
            return minutoGiorno >= inizio || minutoGiorno < fine;
        }
    }

    // Simple interval pattern 'HH:mm-HH:mm' (covers H24 as '00:00-00:00')
    const hyphenMatch = orarioLavoro.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (hyphenMatch) {
        const [startStr, endStr] = [hyphenMatch[1], hyphenMatch[2]];
        const [h1, m1] = startStr.split(':').map(Number);
        const [h2, m2] = endStr.split(':').map(Number);
        const inizio2 = h1 * 60 + m1;
        const fine2 = h2 * 60 + m2;
        if (inizio2 < fine2) {
            return minutoGiorno >= inizio2 && minutoGiorno < fine2;
        }
        return minutoGiorno >= inizio2 || minutoGiorno < fine2;
    }

    // Orari tipo "dalle 00:00 alle 00:00" (H24)
    if (orarioLavoro.match(/dalle\s*00:00\s*alle\s*00:00/i)) {
        return true;
    }

    // Fasce predefinite per mezzi non GET (H12, H8, etc)
    const FASCE_ORARIE = {
        DIURNA: { inizio: 8 * 60, fine: 20 * 60 },
        SERALE: { inizio: 18 * 60, fine: 24 * 60 },
        NOTTURNA: { inizio: 20 * 60, fine: 8 * 60 }
    };

    // Fasce più flessibili per mezzi GET
    const FASCE_GET = {
        DIURNA: { inizio: 7 * 60, fine: 21 * 60 }, // 7:00-21:00 più flessibile
        SERALE: { inizio: 17 * 60, fine: 24 * 60 }, // 17:00-24:00 più flessibile
        NOTTURNA: { inizio: 19 * 60, fine: 9 * 60 } // 19:00-9:00 più flessibile
    };

    // Gestione mezzi GETTONE (GET)
    if (mezzo.convenzione === 'GET') {
        const orarioString = orarioLavoro.toUpperCase();
        const isWeekend = giornoCorrente === 'SAB' || giornoCorrente === 'DOM';

        // Se il mezzo ha solo "FASCIA DIURNA"
        if (orarioString === "FASCIA DIURNA") {
            return minutoGiorno >= FASCE_GET.DIURNA.inizio && minutoGiorno < FASCE_GET.DIURNA.fine;
        }

        // Se il mezzo ha "FASCIA SERALE, SAB E DOM FASCIA DIURNA"
        if (orarioString.includes("FASCIA SERALE") && orarioString.includes("SAB E DOM FASCIA DIURNA")) {
            return isWeekend ? 
                (minutoGiorno >= FASCE_GET.DIURNA.inizio && minutoGiorno < FASCE_GET.DIURNA.fine) :
                (minutoGiorno >= FASCE_GET.SERALE.inizio && minutoGiorno < FASCE_GET.SERALE.fine);
        }

        // Se il mezzo ha "FASCIA NOTTURNA, SAB E DOM FASCIA DIURNA"
        if (orarioString.includes("FASCIA NOTTURNA") && orarioString.includes("SAB E DOM FASCIA DIURNA")) {
            if (isWeekend) {
                return minutoGiorno >= FASCE_GET.DIURNA.inizio && minutoGiorno < FASCE_GET.DIURNA.fine;
            } else {
                // Durante la fascia notturna il mezzo è sempre operativo
                if (minutoGiorno >= FASCE_GET.NOTTURNA.inizio || minutoGiorno < FASCE_GET.NOTTURNA.fine) {
                    return true;
                }
                
                // In fascia diurna, usiamo l'ID del mezzo per determinare in modo stabile se è operativo
                if (minutoGiorno >= FASCE_ORARIE.DIURNA.inizio && minutoGiorno < FASCE_ORARIE.DIURNA.fine) {
                    // Generiamo un numero casuale deterministico basato su giorno e ID mezzo
                    const mezzoId = (mezzo.nome_radio || '').replace(/\D/g, '') || '0';
                    const seed = giornoCorrente + (Math.floor(minutoGiorno / 60) * 60) + mezzoId;
                    const random = Math.abs(Math.sin(seed) * 10000);
                    const position = random % 10; // Numero da 0 a 9
                    
                    // Garantiamo che 4 mezzi su 10 siano sempre operativi (40%)
                    return position < 4;
                }
                
                return false;
            }
        }

        // Se il mezzo specifica solo giorni specifici per il GETTONE
        if (orarioString.includes("DALLE 20:00 ALLE 6:00") || orarioString.includes("DALLE 20:00 ALLE 06:00")) {
            return minutoGiorno >= 20 * 60 || minutoGiorno < 6 * 60;
        }
    }

    // Per tutti gli altri mezzi, se non è stato trovato un pattern valido, considera il mezzo non operativo
    return false;
}

// Ensure isMezzoOperativo is available immediately in browser context
if (typeof window !== 'undefined') {
    window.isMezzoOperativo = isMezzoOperativo;
}

// Also export for Node.js environments if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isMezzoOperativo };
}
