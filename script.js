/* ============================================================
   Script du site L’Aparté : comportements de la page, puis menu du jour
   (lu dans une feuille Google Sheets). Chargé par index.html.
   ============================================================ */

(() => {
  const root = document.documentElement;

  /* 1. Apparition douce des blocs au scroll (décalage progressif entre frères) */
  const items = [...document.querySelectorAll('.reveal')];
  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('visible'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(el => {
      const siblings = [...el.parentNode.children].filter(n => n.classList.contains('reveal'));
      el.style.setProperty('--d', siblings.indexOf(el) * 90 + 'ms');
      io.observe(el);
    });
  }

  /* 2. Barres fixes : visibles dès que le bouton « Réserver » du haut de page est sorti de l’écran */
  const actions = document.querySelector('.hero .actions');
  let ticking = false;
  const update = () => {
    ticking = false;
    root.classList.toggle('past-hero', actions.getBoundingClientRect().bottom < 40);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();

  /* 3. Lien actif dans la navigation (ordinateur) */
  const links = {};
  document.querySelectorAll('.topbar ul a[href^="#"]').forEach(a => { links[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const link = links[e.target.id];
        if (!link) return;
        if (e.isIntersecting) {
          Object.values(links).forEach(a => a.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');   /* la section quitte la zone centrale (ex. retour en haut de page) */
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(id => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* 4. Rangée d’avis : atteignable au clavier seulement quand elle défile (mobile / tablette) */
  const avisList = document.querySelector('.avis-list');
  if (avisList) {
    const syncAvis = () => {
      if (avisList.scrollWidth > avisList.clientWidth + 1) avisList.setAttribute('tabindex', '0');
      else avisList.removeAttribute('tabindex');
    };
    addEventListener('resize', syncAvis);
    syncAvis();
  }
})();

/* ======================= MENU DU JOUR (Google Sheets) =======================
 Lit une feuille Google Sheets publiée en CSV et remplit le bloc « Menu du jour » de la section
 Carte. Installation : NOTES-INSTALLATION.md · mode d’emploi du restaurateur : GUIDE-PLAT-DU-JOUR.md */
/* ► ADRESSE DE LA FEUILLE : à coller entre les guillemets ci-dessous (lien CSV obtenu avec
     Fichier > Partager > Publier sur le web > « Valeurs séparées par des virgules (.csv) »).
   Tant que la valeur reste « À_REMPLACER », le texte de secours (appel téléphonique) s’affiche. */
const SHEET_CSV_URL = "À_REMPLACER";

(() => {
  const NON_CONFIGURE = 'À_REMPLACER';
  const DELAI_MAX = 8000;     /* ms : sans réponse après ce délai, on affiche le texte de secours */

  /* Tous les textes du bloc, en français et en anglais.
     (Le HTML contient déjà la version française : c’est ce qui s’affiche sans JavaScript.) */
  const TEXTES = {
    fr: {
      titre: 'Menu du jour', entree: 'Entrée', plat: 'Plat', dessert: 'Dessert',
      chargement: 'Chargement du menu du jour…',
      secours: 'Le menu du jour change chaque jour. Appelez-nous au 02 31 94 97 11 pour le connaître.',
      appeler: 'Nous appeler'
    },
    en: {
      titre: 'Menu of the day', entree: 'Starter', plat: 'Main course', dessert: 'Dessert',
      chargement: 'Loading the menu of the day…',
      secours: 'Our menu of the day changes daily. Call us on +33 2 31 94 97 11.',
      appeler: 'Call us'
    }
  };

  const bloc = document.getElementById('menu-du-jour');
  const vue = bloc && {
    titre: bloc.querySelector('#mj-titre'),
    chargement: bloc.querySelector('.mj-chargement'),
    attente: bloc.querySelector('.mj-sr'),
    liste: bloc.querySelector('.mj-liste'),
    lignes: [...bloc.querySelectorAll('.mj-ligne')],
    secours: bloc.querySelector('.mj-secours'),
    secoursTexte: bloc.querySelector('.mj-secours p'),
    secoursBouton: bloc.querySelector('.mj-secours .btn span')
  };
  /* HTML modifié par erreur : on ne touche à rien, le texte de secours du HTML reste affiché */
  if (!vue || !vue.lignes.length || Object.values(vue).some((v) => !v)) return;

  /* Ce qui est affiché : 'chargement', 'menu' (données dans « menu ») ou 'secours' */
  let etat = { vue: 'secours', menu: null };

  /* Langue de la page : anglais si <html lang="en…">, français sinon */
  const langue = () => (document.documentElement.lang || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';

  /* ---------- 1. Lecture du CSV ---------- */

  /* Transforme le texte CSV en tableau de lignes (une ligne = un tableau de cellules).
     Gère : cellule entre guillemets, virgules et retours à la ligne dans une cellule, guillemet
     doublé ("") = un guillemet, fins de ligne Windows (\r\n) ou Mac (\r), BOM en début de fichier. */
  const parserCsv = (texte) => {
    if (texte.charCodeAt(0) === 0xFEFF) texte = texte.slice(1);        /* BOM éventuel */
    const lignes = [];
    let ligne = [], cellule = '', entreGuillemets = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (entreGuillemets) {
        if (c !== '"') cellule += c;
        else if (texte[i + 1] === '"') { cellule += '"'; i++; }        /* "" = un vrai guillemet */
        else entreGuillemets = false;                                  /* guillemet fermant */
      } else if (c === '"' && cellule === '') {
        entreGuillemets = true;                                        /* guillemet ouvrant (début de cellule) */
      } else if (c === ',') {
        ligne.push(cellule); cellule = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && texte[i + 1] === '\n') i++;                  /* \r\n = un seul saut de ligne */
        ligne.push(cellule); lignes.push(ligne);
        ligne = []; cellule = '';
      } else {
        cellule += c;
      }
    }
    if (cellule !== '' || ligne.length) { ligne.push(cellule); lignes.push(ligne); }   /* dernière ligne sans saut de ligne final */
    return lignes;
  };

  /* Une cellule inutilisable (vide, erreur de formule, traduction pas encore prête) devient '' ;
     les retours à la ligne Windows (\r\n) à l’intérieur d’une cellule sont ramenés à \n */
  const nettoyer = (valeur) => {
    const texte = (valeur || '').replace(/\r\n?/g, '\n').trim();
    if (/^#[A-Z0-9\/]+[!?]?$/i.test(texte)) return '';                 /* #ERROR!, #N/A, #VALUE!, #REF!, #NAME?, #DIV/0!… */
    if (/^(loading|chargement)(\.{3}|…)?$/i.test(texte)) return '';    /* « Loading... » : traduction en cours */
    return texte;
  };

  /* « Entrée », « entree », « ENTREE_EN »… : les titres se comparent sans accents ni majuscules */
  const normaliserTitre = (titre) => (titre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase().replace(/\s+/g, '_');

  /* Ligne 1 = titres, ligne 2 = menu du jour (le reste de la feuille est ignoré).
     Les colonnes sont repérées par leur titre, jamais par leur position.
     Renvoie null si les trois cases françaises sont vides. */
  const lireMenu = (lignesCsv) => {
    if (lignesCsv.length < 2) return null;
    const titres = lignesCsv[0].map(normaliserTitre);
    const donnees = lignesCsv[1];
    const valeur = (titre) => nettoyer(donnees[titres.indexOf(titre)]);   /* titre absent : '' */
    const menu = {};
    let toutVide = true;
    ['entree', 'plat', 'dessert'].forEach((nom) => {
      menu[nom] = { fr: valeur(nom), en: valeur(nom + '_en') };
      if (menu[nom].fr) toutVide = false;
    });
    return toutVide ? null : menu;
  };

  /* ---------- 2. Affichage ---------- */

  /* Texte d’une ligne : le français ; en version anglaise, la traduction si elle est exploitable,
     sinon le français. Pas de texte français = pas de texte (la ligne est alors masquée). */
  const choisirTexte = (donnees, lang) => {
    if (!donnees || !donnees.fr) return { texte: '', lang: 'fr' };
    if (lang === 'en' && donnees.en) return { texte: donnees.en, lang: 'en' };
    return { texte: donnees.fr, lang: 'fr' };
  };

  const afficher = () => {
    const lang = langue();
    const t = TEXTES[lang];
    bloc.setAttribute('aria-busy', etat.vue === 'chargement' ? 'true' : 'false');
    vue.titre.textContent = t.titre;
    vue.attente.textContent = t.chargement;
    vue.secoursTexte.textContent = t.secours;
    vue.secoursBouton.textContent = t.appeler;
    vue.chargement.hidden = etat.vue !== 'chargement';
    vue.liste.hidden = etat.vue !== 'menu';
    vue.secours.hidden = etat.vue !== 'secours';
    if (etat.vue !== 'menu') return;

    vue.lignes.forEach((ligne) => {
      const nom = ligne.dataset.col;
      const choix = choisirTexte(etat.menu[nom], lang);
      const dd = ligne.querySelector('dd');
      ligne.querySelector('dt').textContent = t[nom];
      /* textContent : le texte de la feuille n’est jamais interprété comme du HTML (équivalent d’un échappement) */
      dd.textContent = choix.texte;
      if (choix.lang !== lang) dd.setAttribute('lang', choix.lang); else dd.removeAttribute('lang');   /* français dans une page anglaise */
      ligne.hidden = !choix.texte;
    });
  };

  const montrer = (nouvelEtat) => { etat = nouvelEtat; afficher(); };

  /* ---------- 3. Chargement de la feuille ---------- */

  const charger = async () => {
    const adresse = (typeof SHEET_CSV_URL === 'string' ? SHEET_CSV_URL : '').trim();
    if (!adresse || adresse === NON_CONFIGURE) return montrer({ vue: 'secours' });   /* feuille pas encore branchée */

    montrer({ vue: 'chargement' });
    const arret = new AbortController();
    const minuteur = setTimeout(() => arret.abort(), DELAI_MAX);
    try {
      /* Paramètre t=… : l’adresse change à chaque chargement, donc jamais de menu périmé gardé en cache */
      const separateur = adresse.includes('?') ? '&' : '?';
      const reponse = await fetch(adresse + separateur + 't=' + Date.now(), { cache: 'no-store', signal: arret.signal });
      if (!reponse.ok) throw new Error('HTTP ' + reponse.status);
      const menu = lireMenu(parserCsv(await reponse.text()));
      montrer(menu ? { vue: 'menu', menu } : { vue: 'secours' });   /* trois cases vides : texte de secours */
    } catch (erreur) {
      montrer({ vue: 'secours' });                                  /* réseau, délai dépassé, accès refusé, CSV illisible… */
    } finally {
      clearTimeout(minuteur);
    }
  };

  charger();

  /* Si un sélecteur de langue change l’attribut lang de la page, le bloc suit (sans recharger la feuille) */
  if ('MutationObserver' in window) {
    new MutationObserver(afficher).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
})();
