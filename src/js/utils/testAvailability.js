// Script di test per la disponibilità dei mezzi
// Esegui questo script nella console del browser per validare il comportamento degli aggiornamenti di disponibilità

function testVehicleAvailabilitySync() {
  console.log("---- TEST SINCRONIZZAZIONE DISPONIBILITÀ MEZZI ----");
  
  // Verifica che il gioco sia inizializzato e abbia la proprietà mezzi
  if (!window.game || !window.game.mezzi) {
    console.error("[ERRORE] Il gioco non è stato inizializzato o non ha la proprietà 'mezzi'.");
    console.error("Assicurati di iniziare il gioco selezionando una centrale prima di eseguire il test.");
    return;
  }
  
  // Memorizza il tempo di simulazione originale
  const originalSimTime = window.simTime;
  const originalSimDay = window.simDay;
  
  // Ottieni tutti i mezzi dalla SOREU corrente
  const currentSoreuMezzi = window.game.mezzi.filter(m => !m.nome_radio.startsWith('('));
  // Ottieni i mezzi dalle altre SOREU
  const otherSoreuMezzi = window.game.mezzi.filter(m => m.nome_radio.startsWith('('));
  
  // Ottieni i mezzi H24
  const h24Mezzi = window.game.mezzi.filter(m => 
    m.convenzione && m.convenzione.toUpperCase() === 'H24' && 
    (!m["Orario di lavoro"] || m["Orario di lavoro"].match(/^(00:00\s*-\s*00:00|dalle\s*00:00\s*alle\s*00:00)$/i))
  );
  
  console.log(`Trovati ${currentSoreuMezzi.length} mezzi nella SOREU corrente`);
  console.log(`Trovati ${otherSoreuMezzi.length} mezzi da altre SOREU`);
  console.log(`Trovati ${h24Mezzi.length} mezzi H24`);
  
  // Casi di test
  const testCases = [
    { time: 0, day: "Lunedì", desc: "Lunedì a mezzanotte (00:00)" },
    { time: 16*3600 + 11*60, day: "Lunedì", desc: "Lunedì alle 16:11" },
    { time: 8*3600, day: "Lunedì", desc: "Lunedì alle 08:00 (inizio turno mattina)" },
    { time: 20*3600, day: "Lunedì", desc: "Lunedì alle 20:00 (inizio turno notte)" },
    { time: 23*3600 + 59*60, day: "Lunedì", desc: "Lunedì alle 23:59 (un minuto prima di mezzanotte)" },
    { time: 0, day: "Sabato", desc: "Sabato a mezzanotte (00:00)" },
    { time: 12*3600, day: "Domenica", desc: "Domenica a mezzogiorno (12:00)" }
  ];
  
  // Funzione di test per verificare la disponibilità
  async function runTest(testCase) {
    console.log(`\n--- TEST: ${testCase.desc} ---`);
    
    // Imposta orario e giorno di simulazione
    window.simDay = testCase.day;
    window.simTime = testCase.time;
    if(typeof updateSimClock === 'function') updateSimClock();
    
    // Forza aggiornamento disponibilità
    window._forceAvailabilityUpdate = true;
    if(typeof aggiornaDisponibilitaMezzi === 'function') {
      console.log(`[TEST] Forzando aggiornamento disponibilità mezzi per ${testCase.desc}`);
      aggiornaDisponibilitaMezzi();
    }
    
    // Attendi che l'aggiornamento sia completato
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Conta mezzi per stato
    const currentSoreuAvailable = currentSoreuMezzi.filter(m => m.stato === 1).length;
    const currentSoreuUnavailable = currentSoreuMezzi.filter(m => m.stato === 8).length;
    const otherSoreuAvailable = otherSoreuMezzi.filter(m => m.stato === 1).length;
    const otherSoreuUnavailable = otherSoreuMezzi.filter(m => m.stato === 8).length;
    const h24Available = h24Mezzi.filter(m => m.stato === 1).length;
    
    console.log(`SOREU corrente: ${currentSoreuAvailable} disponibili, ${currentSoreuUnavailable} non disponibili`);
    console.log(`Altre SOREU: ${otherSoreuAvailable} disponibili, ${otherSoreuUnavailable} non disponibili`);
    console.log(`Mezzi H24: ${h24Available} disponibili su ${h24Mezzi.length}`);
    
    // Verifica che i mezzi H24 siano sempre disponibili
    if (h24Available !== h24Mezzi.length) {
      console.error(`[ERRORE] Alcuni mezzi H24 non sono disponibili alle ${testCase.desc}`);
      
      // Elenca i mezzi H24 problematici
      h24Mezzi.filter(m => m.stato !== 1).forEach(m => {
        console.error(`[ERRORE H24] Mezzo ${m.nome_radio} è in stato ${m.stato} alle ${testCase.desc}`);
      });
    }
    
    // Controllo a campione di alcuni mezzi casuali per verificare che corrispondano al loro orario di servizio
    const sampleSize = Math.min(5, currentSoreuMezzi.length);
    const sampleVehicles = currentSoreuMezzi.slice(0, sampleSize);
    
    console.log("\nControllo disponibilità mezzi campione:");
    for (const mezzo of sampleVehicles) {
      const now = new Date();
      now.setHours(Math.floor(testCase.time/3600), Math.floor((testCase.time%3600)/60), 0, 0);
      const orarioSimulato = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      const shouldBeAvailable = window.isMezzoOperativo(mezzo, orarioSimulato, now, testCase.day);
      const isActuallyAvailable = mezzo.stato === 1;
      
      console.log(`Mezzo ${mezzo.nome_radio}: dovrebbe essere ${shouldBeAvailable ? 'disponibile' : 'non disponibile'}, è effettivamente ${isActuallyAvailable ? 'disponibile' : 'non disponibile'}`);
      
      if (shouldBeAvailable !== isActuallyAvailable) {
        console.error(`[ERRORE] Il mezzo ${m.nome_radio} ha disponibilità errata alle ${testCase.desc}`);
        console.error(`  - Orario di servizio: ${mezzo["Orario di lavoro"] || "non specificato"}`);
        console.error(`  - Convenzione: ${mezzo.convenzione || "non specificata"}`);
        console.error(`  - Giorni lavorativi: ${mezzo.Giorni || "non specificati"}`);
      }
    }
  }
  
  // Esegui i test in sequenza
  async function runAllTests() {
    for (const testCase of testCases) {
      await runTest(testCase);
    }
    
    // Ripristina l'orario originale
    window.simDay = originalSimDay;
    window.simTime = originalSimTime;
    if(typeof updateSimClock === 'function') updateSimClock();
    
    // Aggiornamento finale della disponibilità
    window._forceAvailabilityUpdate = true;
    if(typeof aggiornaDisponibilitaMezzi === 'function') {
      console.log(`\n[TEST] Ripristino orario originale: ${originalSimDay} ${Math.floor(originalSimTime/3600)}:${Math.floor((originalSimTime%3600)/60).toString().padStart(2, '0')}`);
      aggiornaDisponibilitaMezzi();
    }
    
  console.log("\n---- TEST DISPONIBILITÀ MEZZI COMPLETATO ----");
  }
  
  // Esegui i test
  runAllTests();
}

// Non eseguire automaticamente all'inclusione
// testVehicleAvailabilitySync();
