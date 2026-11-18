# bjj-fighter — testna verzija: dizajn

Odobreno od vlasnika 14. 11. 2026. Izvor zahtjeva: odjeljak „MMA / BJJ borilačka igra” u korijenskom `IDEJE.md` (prenesen u README projekta).

## Namjera
Browser igra u kojoj igrač gradi no-gi BJJ borca od bijelog pojasa. Napredak ide na timer (stil igara poput Clash Royalea), pa igrač ne mora stalno igrati. Borba je zanimljiva zbog kritičnih trenutaka: vrijeme se uspori i igrač bira jednu od pet opcija (jedna ili više točnih, jedna ili više krivih). Testna verzija služi da vlasnik brzo isproba cijeli krug: trening → borba → napredak.

## Ciljevi
- Potezi s razinama; razina n traje `osnova × 2^(n-1) × faktor pojasa`. Faktor pojasa: bijeli 1,0, plavi 0,8, ljubičasti 0,55, smeđi 0,35, crni 0,15.
- Novi potez izvan treninga: seminar 90 %, open mat 10–20 %, natjecanje 5 %.
- Borba protiv AI-a: 3 runde × 3 min (igraći sat ubrzan 3x) ili do submissiona. Bodovanje kao u BJJ-u: takedown 2, sweep 2, knee on belly 2, prolaz 3, mount 4, leđa 4; bodovi tek nakon 3 s držanja; prednosti i kazne; heel hookovi dopušteni.
- Kritični trenuci: uvijek kad igrača napadaju submissionom, ponekad kod sweepa, prolaza ili vlastite prilike; 5 opcija, ograničeno vrijeme; kriva opcija može otvoriti novu opasnost.
- Testni panel: ubrzanje vremena 1–10x, prekidač „sve otključano” (svi potezi naučeni na razini 1 i svi se mogu trenirati), izbor pojasa, reset.
- Spremanje u `localStorage`.

## Ne-ciljevi (za sada)
MMA, PvP, računi i server, prilagodba izgleda, klub koji se nadograđuje, 3D.

## Anti-ciljevi
- Logika borbe ne smije ovisiti o crtanju (mora se moći zamijeniti 3D-om).
- Borba ne smije biti sama animacija bez odluka niti stalno prekidana odlukama (cilj ~8–12 kritičnih trenutaka po borbi).

## Pristupi
1. **Čisti JS moduli + Canvas 2D, bez paketa (odabrano).** Isto kao dev-farm: nula instalacije, testovi s `node --test`, logika u čistim modulima.
2. Phaser ili sličan engine: brže animacije i scene, ali ovisnost i build, a borci su ionako proceduralni.
3. React + Canvas: lakši UI izbornika, ali build korak i veći projekt za testnu verziju.

## Odluke (Claude, uz obrazloženje)
- Pozicije su graf: stojeći, zatvoreni gard, polugard, butterfly, side control, knee on belly, mount, leđa, north-south, turtle (front headlock), leg entanglement. Akcije su vezane uz potez, ulogu (gore/dolje) i ciljnu poziciju.
- Uspjeh akcije ovisi o razini napadačkog poteza naspram razine najbolje obrane protivnika, uz slučajnost.
- Faktor pojasa vrijedi za sve učenje (novi potez i više razine); jedna konstanta, lako se mijenja.
- Jedan trening poteza istovremeno + jedna aktivnost (seminar ili open mat) istovremeno.
- Valuta (€): natjecanje i sparing donose novac, seminar košta.
- Promocija u pojas: uvjeti po broju naučenih poteza i pobjeda; u testnom panelu pojas se bira ručno.
- Max razina poteza 10.
