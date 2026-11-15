/* ============================================================
   Script du site L’Aparté — pages index.html et mentions-legales.html
   ------------------------------------------------------------
   0. Menu du jour : adresse de la feuille Google Sheets (juste en dessous)
   1. Langue FR / EN (choix mémorisé dans le navigateur)
   2. Comportements de la page (apparition, barres fixes, navigation, année)
   3. Haut de page : arrière-plan flou tiré de la photo de façade
   4. Menu du jour : lecture de la feuille et affichage
   Aucune bibliothèque externe.
   ============================================================ */

/* ► MENU DU JOUR — ADRESSE DE LA FEUILLE GOOGLE SHEETS (TODO CONTENU)
   À remplacer par le lien CSV obtenu avec Fichier > Partager > Publier sur le web >
   « Valeurs séparées par des virgules (.csv) » (pas à pas : NOTES-INSTALLATION.md).
   Tant que la valeur reste « À_REMPLACER », le site affiche le texte de secours
   (« Appelez-nous… ») à la place du menu. */
const SHEET_CSV_URL = "À_REMPLACER";


/* ======================= 1. LANGUE FR / EN =======================
   Le français est écrit dans le HTML (c’est ce que voient les moteurs de recherche et les visiteurs
   sans JavaScript). La version anglaise est portée par des attributs « data-en… » :
     data-en="…"               remplace le texte de l’élément (l’élément ne doit contenir aucune autre balise)
     data-en-alt / -aria-label / -title / -content / -href="…"   remplacent l’attribut du même nom
   Les boutons FR | EN (attribut data-lang-btn) changent la langue ; le choix est gardé dans localStorage. */
(() => {
  const racine = document.documentElement;
  const CLE = 'laparte-lang';
  const ATTRIBUTS = ['alt', 'aria-label', 'title', 'content', 'href'];

  /* localStorage peut être refusé (navigation privée, stockage bloqué) : le site fonctionne sans */
  const lireChoix = () => { try { return localStorage.getItem(CLE); } catch (e) { return null; } };
  const garderChoix = (lang) => { try { localStorage.setItem(CLE, lang); } catch (e) { /* tant pis : le choix ne sera pas retenu */ } };

  /* On mémorise le français d’origine AVANT toute traduction, pour pouvoir y revenir */
  const elements = [];
  document.querySelectorAll('[data-en]').forEach((el) => {
    elements.push({ el, attribut: null, fr: el.textContent, en: el.getAttribute('data-en') });
  });
  ATTRIBUTS.forEach((attribut) => {
    document.querySelectorAll('[data-en-' + attribut + ']').forEach((el) => {
      elements.push({ el, attribut, fr: el.getAttribute(attribut), en: el.getAttribute('data-en-' + attribut) });
    });
  });
  const boutons = [...document.querySelectorAll('[data-lang-btn]')];

  const appliquer = (lang) => {
    elements.forEach(({ el, attribut, fr, en }) => {
      const texte = lang === 'en' ? en : fr;
      if (attribut) el.setAttribute(attribut, texte); else el.textContent = texte;
    });
    racine.lang = lang;                                         /* lecteurs d’écran, césure, guillemets… */
    boutons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langBtn === lang)));
    racine.classList.remove('i18n-attente');                    /* la page peut s’afficher */
  };

  boutons.forEach((b) => b.addEventListener('click', () => {
    const lang = b.dataset.langBtn === 'en' ? 'en' : 'fr';
    appliquer(lang);
    garderChoix(lang);
  }));

  appliquer(lireChoix() === 'en' ? 'en' : 'fr');
})();


/* ======================= 2. COMPORTEMENTS DE LA PAGE ======================= */
(() => {
  const racine = document.documentElement;

  /* Année du pied de page (le HTML contient déjà l’année de mise en ligne) */
  document.querySelectorAll('[data-annee]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* Apparition douce des blocs au scroll (décalage progressif entre frères) */
  const items = [...document.querySelectorAll('.reveal')];
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('visible'));
  } else if (items.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach((el) => {
      const freres = [...el.parentNode.children].filter((n) => n.classList.contains('reveal'));
      el.style.setProperty('--d', freres.indexOf(el) * 90 + 'ms');
      io.observe(el);
    });
  }

  /* Barres fixes : visibles dès que le bouton « Réserver » du haut de page est sorti de l’écran */
  const actions = document.querySelector('.hero .actions');
  if (actions) {
    let attente = false;
    const maj = () => {
      attente = false;
      racine.classList.toggle('past-hero', actions.getBoundingClientRect().bottom < 40);
    };
    addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
    addEventListener('resize', maj);
    maj();
  }

  /* Lien actif dans la navigation (ordinateur) */
  const liens = {};
  document.querySelectorAll('.topbar ul a[href^="#"]').forEach((a) => { liens[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window && Object.keys(liens).length) {
    const espion = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const lien = liens[e.target.id];
        if (!lien) return;
        if (e.isIntersecting) {
          Object.values(liens).forEach((a) => a.removeAttribute('aria-current'));
          lien.setAttribute('aria-current', 'true');
        } else {
          lien.removeAttribute('aria-current');   /* la section quitte la zone centrale (ex. retour en haut de page) */
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(liens).forEach((id) => { const s = document.getElementById(id); if (s) espion.observe(s); });
  }

  /* Rangée d’avis : atteignable au clavier seulement quand elle défile (mobile / tablette) */
  const avis = document.querySelector('.avis-list');
  if (avis) {
    const synchroniser = () => {
      if (avis.scrollWidth > avis.clientWidth + 1) avis.setAttribute('tabindex', '0');
      else avis.removeAttribute('tabindex');
    };
    addEventListener('resize', synchroniser);
    synchroniser();
  }
})();


/* ======================= 3. HAUT DE PAGE : ARRIÈRE-PLAN FLOU =======================
   L’arrière-plan est une mini-version de la photo de façade, agrandie par le navigateur (donc floue, sans
   filtre coûteux). Elle est recalculée ici à partir de images/facade.jpg : quand la photo change, rien à refaire.
   Si le calcul est impossible (photo absente, page ouverte depuis un fichier), le CSS garde images/facade-flou.jpg. */
(() => {
  const fond = document.querySelector('.hero-bg');
  const photo = document.querySelector('.hero-photo img');
  if (!fond || !photo) return;

  const flouter = () => {
    if (!photo.naturalWidth) return;                            /* photo absente : fond neutre du CSS */
    try {
      const CIBLE = 24;                                         /* largeur finale, en pixels */
      let source = photo, l = photo.naturalWidth, h = photo.naturalHeight;
      do {                                                      /* on divise par deux à chaque passe : résultat plus doux */
        const nl = Math.max(CIBLE, Math.round(l / 2));
        const nh = Math.max(1, Math.round(h * nl / l));
        const toile = document.createElement('canvas');
        toile.width = nl; toile.height = nh;
        toile.getContext('2d').drawImage(source, 0, 0, nl, nh);
        source = toile; l = nl; h = nh;
      } while (l > CIBLE);
      fond.style.backgroundImage = 'url("' + source.toDataURL('image/jpeg', 0.8) + '")';
    } catch (erreur) { /* canvas bloqué : on garde le fond du CSS */ }
  };

  if (photo.complete) flouter(); else photo.addEventListener('load', flouter, { once: true });
})();


/* ======================= 4. MENU DU JOUR (Google Sheets) =======================
 Lit la feuille Google Sheets publiée en CSV (adresse : SHEET_CSV_URL, tout en haut) et remplit le bloc
 « Menu du jour » de index.html. Installation : NOTES-INSTALLATION.md · mode d’emploi du restaurateur :
 GUIDE-PLAT-DU-JOUR.md.
 La feuille : ligne 1 = titres des colonnes (entree, plat, dessert, entree_en, plat_en, dessert_en),
 ligne 2 = le menu du jour. Les colonnes sont repérées par leur titre, jamais par leur position. */
(() => {
  const NON_CONFIGURE = 'À_REMPLACER';
  const DELAI_MAX = 8000;     /* ms : sans réponse après ce délai, on affiche le texte de secours */

  const section = document.getElementById('menu-du-jour');
  const bloc = section && section.querySelector('.menu-jour');
  const vue = bloc && {
    chargement: bloc.querySelector('.mj-chargement'),
    liste: bloc.querySelector('.mj-liste'),
    lignes: [...bloc.querySelectorAll('.mj-ligne')],
    secours: bloc.querySelector('.mj-secours')
  };
  /* HTML modifié par erreur : on ne touche à rien, le texte de secours du HTML reste affiché */
  if (!vue || !vue.chargement || !vue.liste || !vue.secours || !vue.lignes.length) return;

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

  /* Les libellés fixes (« Entrée », texte de secours, bouton…) sont traduits par la section 1 (data-en) :
     ici on ne gère que l’état affiché et le texte venant de la feuille. */
  const afficher = () => {
    const lang = langue();
    bloc.setAttribute('aria-busy', etat.vue === 'chargement' ? 'true' : 'false');
    vue.chargement.hidden = etat.vue !== 'chargement';
    vue.liste.hidden = etat.vue !== 'menu';
    vue.secours.hidden = etat.vue !== 'secours';
    if (etat.vue !== 'menu') return;

    vue.lignes.forEach((ligne) => {
      const choix = choisirTexte(etat.menu[ligne.dataset.col], lang);
      const dd = ligne.querySelector('dd');
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

  /* Quand la langue change (boutons FR | EN), le menu suit sans recharger la feuille */
  if ('MutationObserver' in window) {
    new MutationObserver(afficher).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
})();
