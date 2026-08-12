  gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    /* Native anchor jumps (href="#...") don't play well with Lenis, since
       Lenis owns/overrides scroll behavior — a plain hash click was
       effectively doing nothing. Route every in-page hash link through
       Lenis's own scrollTo instead. #home explicitly targets 0 (the true
       top of the page) rather than the hero element's own position,
       which is the safest target given the hero is pinned. */
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const hash = link.getAttribute('href');
      if (!hash || hash.length < 2) return;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        lenis.scrollTo(hash === '#home' ? 0 : hash);
      });
    });

    /* Mobile hamburger menu — plain vanilla JS/CSS, no GSAP involved at
       all, so it works identically regardless of screen size or the
       matchMedia breakpoint below. */
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        const open = mobileMenu.classList.toggle('is-open');
        mobileMenuBtn.classList.toggle('is-open', open);
        mobileMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      mobileMenu.querySelectorAll('a').forEach((a) => {
        a.addEventListener('click', () => {
          mobileMenu.classList.remove('is-open');
          mobileMenuBtn.classList.remove('is-open');
          mobileMenuBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    /* Shared active-nav helper — keeps the desktop sidebar links AND the
       mobile menu links in sync from a single call, since both sets use
       the same data-nav ids. */
    function setActiveNav(id) {
      document.querySelectorAll('.morph-links a, .mobile-nav-link').forEach((a) => {
        a.classList.toggle('active', a.dataset.nav === id);
      });
    }

    const mm = gsap.matchMedia();

    /* ===================================================================
       DESKTOP ONLY: the morph.
       Below 981px the .morph layer is hidden entirely (CSS) and the hero
       behaves like a normal static section — no pin, no transform tricks.

       Registration itself is deferred until window 'load' — iOS Safari
       can briefly report a default ~980px layout viewport width before
       the <meta viewport> tag fully takes effect. If matchMedia happened
       to evaluate during that split-second window, a phone could
       momentarily be misread as desktop-width and the morph would
       flash on before self-correcting on the next resize. Waiting for
       load means the real viewport has already settled by the time the
       check runs at all.
       =================================================================== */
    function registerDesktopMorph() {
      mm.add('(min-width: 981px)', () => {

        const morph = document.getElementById('morph');
        const heroWord = document.getElementById('heroWord');
        const logo = document.getElementById('morphLogo');
        const stat1 = document.getElementById('stat1');
        const stat2 = document.getElementById('stat2');
        const cta = document.getElementById('morphCta');
        const ctaSecondary = document.getElementById('morphCtaSecondary');
        const navHome = document.getElementById('navHome');
        const navAbout = document.getElementById('navAbout');
        const navEducation = document.getElementById('navEducation');
        const navSkills = document.getElementById('navSkills');
        const navProjects = document.getElementById('navProjects');
        const navContact = document.getElementById('navContact');

        const navLeftCluster = [navHome, navAbout, navEducation];
        const navRightCluster = [navSkills, navProjects, navContact];
        const positioned = [stat1, stat2, cta, ctaSecondary, ...navLeftCluster, ...navRightCluster];

        let heroTl = null;

        // About's reveal: a paused timeline whose progress() is driven
        // directly from heroTl's own onUpdate below — not a separate
        // ScrollTrigger calculating its own position on the pinned hero
        // (that cross-referencing proved unreliable twice). This way it is
        // mathematically guaranteed to be in sync with the morph, since it
        // reads the exact same progress value already confirmed correct.
        gsap.set('#about .section-head, #about .about-body p', { opacity: 0, y: 60, filter: 'blur(6px)' });
        gsap.set('#about .info-card', { opacity: 0, y: 70, x: 30 });
        const aboutTl = gsap.timeline({ paused: true })
          .to('#about .section-head', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'none' })
          .to('#about .about-body p', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: 0.15, ease: 'none' }, '<0.1')
          .to('#about .info-card', { opacity: 1, y: 0, x: 0, duration: 1, ease: 'none' }, '<0.15');

        /* Places `el` (its real, final position inside the fixed sidebar)
           so that it VISUALLY appears at xFrac/yFrac of the viewport and
           `scale` times bigger, via a GSAP transform. Because .morph has no
           overflow:hidden, the translated element renders anywhere on
           screen even though its DOM box lives in the slim 272px column.
           IMPORTANT: transform is reset to identity right before measuring
           — otherwise a second call (e.g. on resize) measures the ALREADY
           -offset box and compounds the error, which is what sent things
           flying off-screen before. */
        function placeInHero(el, xFrac, yFrac, scale) {
          gsap.set(el, { x: 0, y: 0, scale: 1 });
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const tx = window.innerWidth * xFrac;
          const ty = window.innerHeight * yFrac;
          gsap.set(el, { x: Math.round(tx - cx), y: Math.round(ty - cy), scale });
        }

        /* The wordmark handoff: target a fixed pixel anchor near the top-left
           of the sidebar (roughly where the badge sits — 28px padding + half
           the badge's own size) instead of measuring the live badge element.
           Measuring the badge was timing-fragile (opacity:0 elements can
           still report a rect, but only once it's actually laid out) and
           occasionally sent the word to the wrong spot. A fixed anchor is
           simple and always correct since the sidebar is a constant width
           regardless of viewport size. */
        function layoutHeroWord() {
          gsap.set(heroWord, { x: 0, y: 0, scale: 1 });
          gsap.set(logo, { opacity: 0 });
          const word = heroWord.getBoundingClientRect();
          const wordCenterX = word.left + word.width / 2;
          const wordCenterY = word.top + word.height / 2;
          const targetX = 68.5;
          const targetY = 48.5;
          const scale = Math.max(10 / word.height, 0.03);
          return { x: Math.round(targetX - wordCenterX), y: Math.round(targetY - wordCenterY), scale };
        }

        /* True centered nav row: measures each link's ACTUAL rendered width
           and lays the whole row (both clusters + the gap reserved for the
           word) out as one horizontally-centered block using real pixel
           math — not just centering each item's midpoint on a fraction of
           the viewport. Fraction-based centers looked unbalanced because
           "CONTACT" is much wider than "HOME", so their edges (not their
           centers) ended up asymmetric from the viewport edges. */
        function layoutNavRow() {
          const gap = Math.min(window.innerWidth * 0.02, 10);
          const centerGap = 250;
          const items = [...navLeftCluster, ...navRightCluster];
          gsap.set(items, { x: 0, y: 0, scale: 1 });

          const widths = items.map(el => el.getBoundingClientRect().width);
          const leftWidths = widths.slice(0, 3);
          const rightWidths = widths.slice(3);
          const sum = arr => arr.reduce((a, b) => a + b, 0);
          const leftGroupWidth = sum(leftWidths) + gap * 2;
          const rightGroupWidth = sum(rightWidths) + gap * 2;
          const totalWidth = leftGroupWidth + centerGap + rightGroupWidth;
          const startX = (window.innerWidth - totalWidth) / 2 + 60;
          const targetY = window.innerHeight * 0.055;

          const centers = [];
          function layRow(list, cursorStart) {
            let cursor = cursorStart;
            list.forEach((w, i) => {
              centers.push(cursor + w / 2);
              cursor += w + (i < list.length - 1 ? gap : 0);
            });
            return cursor;
          }
          let cursor = layRow(leftWidths, startX);
          cursor += centerGap;
          layRow(rightWidths, cursor);

          items.forEach((el, i) => {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            gsap.set(el, { x: Math.round(centers[i] - cx), y: Math.round(targetY - cy), scale: 1 });
          });
        }

        function layoutHeroPositions() {
          layoutNavRow();

          placeInHero(stat1, 0.185, 0.66, 1);
          placeInHero(stat2, 0.200, 0.785, 1);

          placeInHero(cta, 0.425, 0.885, 1);
          placeInHero(ctaSecondary, 0.575, 0.885, 1);
        }

        /* Builds (or rebuilds, on resize) the entire pinned morph timeline
           from a clean slate. Rebuilding rather than mutating an existing
           timeline avoids ever animating from a stale/corrupted position. */
        function buildHeroMorph() {
          if (heroTl) { heroTl.scrollTrigger && heroTl.scrollTrigger.kill(); heroTl.kill(); }

          const heroImg = document.getElementById('heroImg');
          const heroBackdrop = document.querySelector('#heroPortrait .backdrop');

          layoutHeroPositions();
          const wordTarget = layoutHeroWord();
          morph.classList.remove('is-settled');

          heroTl = gsap.timeline({
            scrollTrigger: {
              trigger: '.hero',
              start: 'top top',
              end: '+=80%',
              scrub: 0.7,
              pin: true,
              pinSpacing: false,
              anticipatePin: 1,
              onUpdate(self) {
                morph.classList.toggle('is-settled', self.progress > 0.78);
                heroWord.classList.toggle('is-flying', self.progress > 0.12);
                const ap = Math.max(0, Math.min(1, (self.progress - 0.6) / 0.25));
                aboutTl.progress(ap);

                const navHome = document.getElementById('navHome');
                if (self.progress < 0.5) {
                  setActiveNav('home');
                } else if (navHome.classList.contains('active')) {
                  setActiveNav(null);
                }
              }
            }
          });

          heroTl.to(positioned, { x: 0, y: 0, scale: 1, ease: 'none', duration: 0.72 }, 0);
          heroTl.to([document.getElementById('morphTagline'), document.getElementById('morphSocials'), document.getElementById('morphEmail')],
            { opacity: 1, ease: 'none', duration: 0.15 }, 0.83);

          // giant wordmark: shrinks and travels toward the badge simultaneously
          // — one continuous motion, matching the reference frame-by-frame
          // (bigger to smaller, moving the whole time, never static-then-move).
          // This is safe now that it's z-index'd above the sidebar, so it can
          // never be covered mid-flight regardless of timing.
          heroTl.to(heroWord, { x: wordTarget.x, y: wordTarget.y, scale: wordTarget.scale, ease: 'none', duration: 0.8 }, 0);
          heroTl.to(heroWord, { opacity: 0, ease: 'none', duration: 0.08 }, 0.8);
          heroTl.to(logo, { opacity: 1, ease: 'none', duration: 0.08 }, 0.82);

          // headline (and the side note) travel up and away
          heroTl.to('#heroHeadlineGroup, #heroSideNote', { y: '-=140', opacity: 0, filter: 'blur(3px)', ease: 'none', duration: 0.6 }, 0);

          // portrait: fast, strongly-noticeable blur onset right from the
          // start of the scroll — driven by this same timeline (already
          // proven reliable for the sidebar morph) rather than a separate
          // cross-referenced trigger.
          heroTl.to(heroImg, { filter: 'saturate(1.06) contrast(1.04) blur(26px)', scale: 1.06, opacity: 0.4, ease: 'none', duration: 0.15 }, 0);
          heroTl.to(heroBackdrop, { opacity: 0, ease: 'none', duration: 0.15 }, 0);
        }

          /* Portrait persistence, part two: once the pin/morph finishes, this
         picks up right where heroTl left off and finishes dissolving the
         (already blurred) portrait across the About section — hooked to
         the SAME trigger driving About's own reveal, which is already
         proven to fire correctly, rather than an independent one. */
      function buildPortraitFade() {
        ScrollTrigger.getById('portraitFade')?.kill();
        const heroImg = document.getElementById('heroImg');
        gsap.timeline({
          scrollTrigger: {
            id: 'portraitFade',
            trigger: '#about',
            start: 'top 85%',
            end: 'bottom top',
            scrub: 0.4
          }
        })
          .to(heroImg, { filter: 'saturate(1.06) contrast(1.04) blur(44px)', scale: 1.14, opacity: 0, ease: 'none' }, 0);
      }
 
      /* ========================================================================
         >>> UPDATED BY CLAUDE (v2): Projects horizontal scroll (desktop only) <<<
         Standard GSAP pin-and-drag horizontal scroll: .hproj-pin pins for
         exactly as much extra scroll distance as the row is wider than the
         viewport, and the row's x position is scrubbed across that distance.
         Using function-based end/x values (recalculated on every refresh via
         invalidateOnRefresh) instead of numbers computed once — so a resize
         doesn't leave it scrolling the wrong distance.

         Fix vs. the reference: removed the per-card vertical "rise into
         place" tween that was here before. Checking your screenshots again,
         nothing moves vertically in the reference — it's a pure horizontal
         drag, full stop. The intro slide (.hproj-intro) is now just the
         first item in the same track, so it drags away with the rest for
         free — no separate animation needed for it either.
         ======================================================================== */
      function buildProjectsScroll() {

  // MOBILE: completely disable Projects GSAP
  if (window.innerWidth <= 980) {
    ScrollTrigger.getById('hprojScroll')?.kill();

    const track = document.getElementById('hprojTrack');
    if (track) {
      gsap.set(track, {
        clearProps: 'all'
      });
    }

    return;
  }

  const track = document.getElementById('hprojTrack');
  if (!track) return;

  ScrollTrigger.getById('hprojScroll')?.kill();
  gsap.set(track, { x: 0 });

  const distance = () => Math.max(
    track.scrollWidth - window.innerWidth + 320,
    1
  );

  gsap.to(track, {
    x: () => -distance(),
    ease: 'none',

    scrollTrigger: {
      id: 'hprojScroll',
      trigger: '.hproj-pin',
      start: 'top top',
      end: () => '+=' + distance(),
      scrub: 0.8,
      pin: true,
      invalidateOnRefresh: true
    }
  });
}
      /* >>> END UPDATED BY CLAUDE (v2): Projects horizontal scroll <<< */

      function init() {
        buildHeroMorph();
        buildPortraitFade();
        buildProjectsScroll(); // UPDATED BY CLAUDE
        gsap.set(morph, { opacity: 1 });
        requestAnimationFrame(() => morph.classList.add('is-ready'));
        ScrollTrigger.refresh();
      }

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(init);
      } else {
        init();
      }

      /* ========================================================================
         >>> UPDATED BY CLAUDE (v4): fixed the jump/snap bug <<<
         Root cause: this page has two pinned scroll sections (hero +
         projects). As you scroll through a pin, its spacer element
         grows/shrinks, which can shift total document height enough to
         toggle the browser's vertical scrollbar. That toggle fires a
         native window "resize" event — even though nothing the user
         did actually resized anything. The old handler below caught
         that false resize and, 200ms later, KILLED AND REBUILT the
         pinned ScrollTrigger you were currently scrolled inside of —
         which is exactly the jump/snap in your video.
         Fix: only rebuild when the viewport WIDTH actually changed.
         Width is the only thing that legitimately affects this layout
         (vw-based card sizing, hero positions); height-only changes
         (scrollbar toggling, mobile browser chrome show/hide) are now
         ignored instead of tearing down an active pin mid-scroll.
         ======================================================================== */
      let lastViewportWidth = window.innerWidth;
      let resizeTimer;
      const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          const w = window.innerWidth;
          if (w === lastViewportWidth) return; // height-only change — ignore, don't rebuild active pins
          lastViewportWidth = w;
          buildHeroMorph(); buildPortraitFade(); buildProjectsScroll();
        }, 200);
      };
      window.addEventListener('resize', onResize);
      /* >>> END UPDATED BY CLAUDE (v4) <<< */

      return () => {
        window.removeEventListener('resize', onResize);
        if (heroTl) { heroTl.scrollTrigger && heroTl.scrollTrigger.kill(); heroTl.kill(); }
        ScrollTrigger.getById('portraitFade')?.kill();

        // Fully reset every inline style GSAP may have written, so
        // nothing can visually freeze mid-animation if the breakpoint
        // is crossed — killing a timeline stops future updates but
        // does NOT undo styles it already applied.
        gsap.set([heroWord, ...positioned, logo], { clearProps: 'all' });
        gsap.set('#heroHeadlineGroup, #heroSideNote', { clearProps: 'all' });
        const heroImgEl = document.getElementById('heroImg');
        const heroBackdropEl = document.querySelector('#heroPortrait .backdrop');
        if (heroImgEl) gsap.set(heroImgEl, { clearProps: 'all' });
        if (heroBackdropEl) gsap.set(heroBackdropEl, { clearProps: 'all' });
        gsap.set(morph, { clearProps: 'opacity' });
        morph.classList.remove('is-ready', 'is-settled');
        heroWord.classList.remove('is-flying');

        // UPDATED BY CLAUDE: projects horizontal scroll cleanup
        ScrollTrigger.getById('hprojScroll')?.kill();
        const hprojTrackEl = document.getElementById('hprojTrack');
        if (hprojTrackEl) gsap.set(hprojTrackEl, { clearProps: 'all' });
        gsap.set('.hproj-card', { clearProps: 'all' });
      };
    });
    }

    if (document.readyState === 'complete') {
      registerDesktopMorph();
    } else {
      window.addEventListener('load', registerDesktopMorph);
    }

    /* active sidebar nav link, synced to whichever section is centered.
       "Home" is skipped here and handled separately below — it's pinned
       for an extra 130% of scroll, but its own DOM box is only 100vh tall,
       so a plain top-center/bottom-center check thought Home ended (and
       About began) as soon as that first 100vh passed, long before the
       pin/morph actually finished. That's why About was lighting up while
       still deep in the hero.
  
       This whole block is deferred until document.fonts.ready — the same
       signal the desktop pin setup uses above, registered AFTER it, so it
       fires after the pin-spacer already exists in the DOM. Creating these
       triggers too early (before the pin-spacer adds its extra scroll
       height) meant every trigger below the hero calculated its position
       against a shorter, stale document height — which is why the
       highlight was skipping ahead by a section or more. */
    function setupNavTracking() {
      document.querySelectorAll('.morph-links a').forEach((link) => {
        const id = link.dataset.nav;
        if (id === 'home') return;
        ScrollTrigger.create({
          trigger: '#' + id,
          start: 'top center',
          end: 'bottom center',
          onToggle: (self) => {
            if (self.isActive) setActiveNav(id);
          }
        });
      });
    }

    /* nav-tracking references '.hero' start/end positions that only
       become correct once the hero's pin-spacer actually exists in the
       DOM — so it's deferred until after fonts are ready (the same
       signal the pin setup uses, registered after it so it runs after),
       followed by one refresh to lock in correct positions for everyone. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { setupNavTracking(); ScrollTrigger.refresh(); });
    } else {
      setupNavTracking();
    }

    /* remaining sections: simple stagger fade-up */
    gsap.utils.toArray('.reveal').forEach((el) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });

    gsap.utils.toArray('.skill-fill').forEach((el) => {
      gsap.to(el, {
        width: el.dataset.pct + '%', duration: 1.2, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%' }
      });
    });
    
    const heroImg = document.getElementById("heroImg");

      function updateHeroImage() {
        if (window.innerWidth <= 980) {
          heroImg.src = "assets/me3.png";
        } else {
          heroImg.src = "assets/me1.webp";
        }
      }

      updateHeroImage();
      window.addEventListener("resize", updateHeroImage);

      alert(window.innerWidth);