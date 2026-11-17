/* The Yard Force — site interactions. Vanilla JS, no dependencies. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* Header: solid after scroll, hide on scroll down */
  const header = $('.site-header');
  const callbar = $('.callbar');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    if (header) {
      header.classList.toggle('is-solid', y > 40 || header.dataset.solid === 'true');
      header.classList.toggle('is-hidden', y > 500 && y > lastY && !document.body.classList.contains('menu-open'));
    }
    if (callbar) callbar.classList.toggle('is-visible', y > 400);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  const toggle = $('.menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', String(open));
      header?.classList.add('is-solid');
    });
    $$('.mobile-menu a').forEach((a) => a.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }
  const megaBtn = $('.has-mega > button');
  if (megaBtn) {
    megaBtn.addEventListener('click', () => {
      const li = megaBtn.parentElement;
      const open = li.classList.toggle('is-open');
      megaBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!megaBtn.parentElement.contains(e.target)) {
        megaBtn.parentElement.classList.remove('is-open');
        megaBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* Reveal on scroll — elements already in view never hide */
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.remove('is-pre'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal, .reveal-img').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.95) { el.classList.add('is-pre'); io.observe(el); }
    });
  }

  /* Hero chapters: rotating media + title + progress */
  const hero = $('[data-chapters]');
  if (hero) {
    const medias = $$('.chapter-media', hero);
    const words = $$('.hero-title-swap span', hero);
    const btns = $$('.chapter-btn', hero);
    const ms = Number(hero.dataset.chapterMs || 7000);
    hero.style.setProperty('--chapter-ms', ms + 'ms');
    let i = 0; let timer;
    const playVideo = (m, on) => {
      const v = $('video', m);
      if (!v) return;
      if (on) { v.currentTime = 0; v.play().catch(() => {}); } else { v.pause(); }
    };
    const go = (n) => {
      const prev = i; i = (n + medias.length) % medias.length;
      medias.forEach((m, k) => { m.classList.toggle('is-active', k === i); playVideo(m, k === i); });
      words.forEach((w, k) => {
        w.classList.remove('is-leaving');
        if (k === prev && prev !== i) w.classList.add('is-leaving');
        w.classList.toggle('is-active', k === i);
      });
      btns.forEach((b, k) => {
        b.classList.remove('is-active', 'is-done');
        void b.offsetWidth; // restart the progress animation
        if (k < i) b.classList.add('is-done');
        if (k === i) b.classList.add('is-active');
        b.setAttribute('aria-pressed', String(k === i));
      });
      clearTimeout(timer);
      if (!reduced) timer = setTimeout(() => go(i + 1), ms);
    };
    btns.forEach((b, k) => b.addEventListener('click', () => go(k)));
    go(0);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(timer); else go(i);
    });
  }

  /* Autoplay muted background videos only when visible */
  const bgVideos = $$('video[data-autoplay]');
  if (bgVideos.length && 'IntersectionObserver' in window) {
    const vio = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) en.target.play().catch(() => {}); else en.target.pause();
    }), { threshold: 0.15 });
    bgVideos.forEach((v) => vio.observe(v));
  }

  /* Count-up stats */
  const counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduced) {
    const cio = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target; cio.unobserve(el);
      const end = parseFloat(el.dataset.count); const dec = (el.dataset.count.split('.')[1] || '').length;
      const t0 = performance.now(); const dur = 1600;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3);
        el.textContent = (end * e).toFixed(dec);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  }

  /* Draggable horizontal rails */
  $$('[data-rail]').forEach((rail) => {
    let down = false; let startX = 0; let startScroll = 0; let moved = false;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; startX = e.clientX; startScroll = rail.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) { moved = true; rail.classList.add('is-dragging'); }
      rail.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', () => { down = false; rail.classList.remove('is-dragging'); });
    rail.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    const ctrl = rail.dataset.rail && document.getElementById(rail.dataset.rail);
    if (ctrl) {
      const step = () => Math.max(300, rail.clientWidth * 0.7);
      $('[data-dir="prev"]', ctrl)?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
      $('[data-dir="next"]', ctrl)?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
    }
  });

  /* Before / after sliders */
  $$('.ba').forEach((ba) => {
    const input = $('input[type=range]', ba);
    const set = (v) => ba.style.setProperty('--pos', v + '%');
    input.addEventListener('input', () => set(input.value));
    set(input.value);
    if (!reduced && 'IntersectionObserver' in window) {
      const o = new IntersectionObserver((en) => {
        if (!en[0].isIntersecting) return; o.disconnect();
        let t0; const sweep = (t) => {
          t0 ??= t; const p = Math.min(1, (t - t0) / 1800);
          const v = 50 + Math.sin(p * Math.PI * 2) * 22 * (1 - p);
          input.value = v; set(v);
          if (p < 1) requestAnimationFrame(sweep);
        };
        requestAnimationFrame(sweep);
      }, { threshold: 0.5 });
      o.observe(ba);
    }
  });

  /* Lightbox for [data-lightbox] groups */
  const lb = $('#lightbox');
  if (lb) {
    const img = $('img', lb); const cap = $('.lb-cap', lb); const count = $('.lb-count', lb);
    let group = []; let idx = 0; let lastFocus = null;
    const show = () => {
      const it = group[idx];
      img.src = it.dataset.full; img.alt = it.dataset.alt || '';
      cap.textContent = it.dataset.caption || '';
      count.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(group.length).padStart(2, '0');
    };
    const open = (btn) => {
      const name = btn.dataset.lightbox;
      group = $$(`[data-lightbox="${name}"]`).filter((b) => !b.closest('[hidden]'));
      idx = group.indexOf(btn); lastFocus = btn;
      show(); lb.hidden = false; document.body.style.overflow = 'hidden';
      $('.lb-close', lb).focus();
    };
    const close = () => { lb.hidden = true; document.body.style.overflow = ''; lastFocus?.focus(); };
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lightbox]');
      if (b) { e.preventDefault(); open(b); }
    });
    $('.lb-close', lb).addEventListener('click', close);
    $('[data-lb="prev"]', lb).addEventListener('click', () => { idx = (idx - 1 + group.length) % group.length; show(); });
    $('[data-lb="next"]', lb).addEventListener('click', () => { idx = (idx + 1) % group.length; show(); });
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') $('[data-lb="next"]', lb).click();
      if (e.key === 'ArrowLeft') $('[data-lb="prev"]', lb).click();
    });
    let sx = null;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) $(dx < 0 ? '[data-lb="next"]' : '[data-lb="prev"]', lb).click();
    });
  }

  /* Cursor tag over galleries */
  const tag = $('.cursor-tag');
  if (tag && window.matchMedia('(hover: hover)').matches) {
    let tx = 0; let ty = 0; let cx = 0; let cy = 0;
    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
    const loop = () => { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; tag.style.left = cx + 'px'; tag.style.top = cy + 'px'; requestAnimationFrame(loop); };
    loop();
    $$('[data-cursor]').forEach((el) => {
      el.addEventListener('pointerenter', () => { tag.textContent = el.dataset.cursor; tag.classList.add('is-on'); });
      el.addEventListener('pointerleave', () => tag.classList.remove('is-on'));
    });
  }

  /* Filter chips */
  $$('[data-filter-group]').forEach((group) => {
    const target = document.getElementById(group.dataset.filterGroup);
    const chips = $$('.chip', group);
    const apply = (val) => {
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === val)));
      $$('[data-cat]', target).forEach((it) => { it.hidden = !(val === 'all' || it.dataset.cat.split(' ').includes(val)); });
      $$('[data-hide-empty]', target).forEach((b) => { b.hidden = !$$('[data-cat]', b).some((it) => !it.hidden); });
      $$('video', target).forEach((v) => { if (v.closest('[hidden]')) v.pause(); });
    };
    chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.filter)));
    const fromHash = location.hash.slice(1);
    if (fromHash && chips.some((c) => c.dataset.filter === fromHash)) apply(fromHash);
  });

  /* Quote slider */
  $$('.quote-slider').forEach((s) => {
    const slides = $$('.quote-slide', s); const dots = $$('.quote-dots button', s);
    let i = 0; let t;
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((sl, k) => sl.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
      clearTimeout(t); if (!reduced) t = setTimeout(() => go(i + 1), 7000);
    };
    dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
    go(0);
  });

  /* YouTube testimonial cards: load the player only on click */
  $$('.video-card [data-yt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const box = btn.closest('.vc-media');
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1&rel=0&modestbranding=1`;
      f.title = btn.getAttribute('aria-label') || 'Video';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      box.replaceChildren(f);
    });
  });

  /* Inline video cards: click to play local video with sound */
  $$('.video-card [data-play]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = $$('video', btn.closest('.vc-media')).find((x) => x.offsetParent !== null) || $('video', btn.closest('.vc-media'));
      if (!v) return;
      v.controls = true; v.muted = false; v.play().catch(() => {});
      btn.remove();
    });
  });

  /* Pricing estimator */
  const est = $('[data-estimator]');
  if (est) {
    const data = JSON.parse($('#estimator-data').textContent);
    const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
    const out = $('.est-figure', est); const note = $('.est-note', est); const bar = $('.est-bar i', est);
    const tierWrap = $('#est-tiers');
    const render = () => {
      const svc = $('input[name=est-service]:checked', est).value;
      const conf = data[svc];
      if (tierWrap.dataset.for !== svc) {
        tierWrap.dataset.for = svc;
        tierWrap.innerHTML = conf.tiers.map((t, k) => `<label><input type="radio" name="est-tier" value="${k}" ${k === 0 ? 'checked' : ''}><span>${t.label}</span></label>`).join('');
        $('#est-tier-legend').textContent = conf.tierLabel;
        $$('input', tierWrap).forEach((r) => r.addEventListener('change', render));
      }
      const t = conf.tiers[Number($('input[name=est-tier]:checked', est).value)];
      const unit = t.unit ? ` <small>${t.unit}</small>` : '';
      if (t.custom) out.innerHTML = t.custom.replace(/^(\$[\d,]+)/, '$1<small>') + '</small>';
      else if (t.high) out.innerHTML = `${fmt(t.low)} <span aria-hidden="true">–</span> ${fmt(t.high)}${t.plus ? '+' : ''}${unit}`;
      else out.innerHTML = `<small style="margin:0 .4rem 0 0">from</small>${fmt(t.low)}${unit}`;
      note.textContent = t.note + '. ' + conf.note;
      const hi = t.high || t.low * 1.6;
      bar.style.left = Math.min(96, (t.low / conf.scaleMax) * 100) + '%';
      bar.style.right = Math.max(0, 100 - Math.min(100, (hi / conf.scaleMax) * 100)) + '%';
    };
    $$('input[name=est-service]', est).forEach((r) => r.addEventListener('change', render));
    render();
  }

  /* Forms: post JSON to the configured endpoint; always confirm on page */
  $$('form[data-form]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const btn = $('button[type=submit]', form); const label = btn.innerHTML;
      btn.disabled = true; btn.textContent = 'Sending…';
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.services = new FormData(form).getAll('services').join(', ');
      payload.form = form.dataset.form; payload.tag = form.dataset.tag; payload.pipeline = form.dataset.pipeline || ''; payload.page = location.pathname;
      payload.submittedAt = new Date().toISOString();
      const endpoint = form.dataset.endpoint;
      let ok = true;
      if (endpoint) {
        try {
          const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          ok = res.ok;
        } catch {
          // Webhook without CORS headers: send as a simple request (no preflight). The response can't be read, so count it as sent.
          try { await fetch(endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) }); ok = true; } catch { ok = false; }
        }
      }
      if (ok && form.dataset.thanks) { location.href = form.dataset.thanks + '?form=' + encodeURIComponent(form.dataset.form); return; }
      if (ok) {
        const tpl = document.getElementById(form.dataset.success);
        form.innerHTML = tpl ? tpl.innerHTML : '<div class="form-success"><h3>Thank you.</h3><p>We received your request.</p></div>';
      } else {
        btn.disabled = false; btn.innerHTML = label;
        let err = $('.form-error', form);
        if (!err) { err = document.createElement('p'); err.className = 'form-error full'; form.appendChild(err); }
        err.textContent = 'Your message did not send. Please call (865) 290-8815 or try again in a moment.';
      }
    });
  });

  /* Topographic contour canvas — the survey-plat motif */
  const noise = (() => {
    const p = new Uint8Array(512); const perm = Array.from({ length: 256 }, (_, i) => i);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
    return (x, y) => {
      const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x); const v = fade(y); const a = p[X] + Y; const b = p[X + 1] + Y;
      return lerp(lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u), lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v);
    };
  })();
  const drawTopo = (canvas) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const cell = 14; const cols = Math.ceil(w / cell) + 1; const rows = Math.ceil(h / cell) + 1;
    const off = Number(canvas.dataset.seed || 0);
    const field = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const nx = x * cell / 260 + off; const ny = y * cell / 260;
      field[y * cols + x] = noise(nx, ny) + 0.5 * noise(nx * 2.1, ny * 2.1);
    }
    const levels = 16;
    ctx.lineWidth = 1;
    for (let l = 0; l < levels; l++) {
      const iso = -0.9 + (l / levels) * 1.8;
      ctx.strokeStyle = l % 4 === 0 ? 'rgba(220,189,134,.30)' : 'rgba(220,189,134,.12)';
      ctx.beginPath();
      for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
        const a = field[y * cols + x]; const b = field[y * cols + x + 1];
        const c = field[(y + 1) * cols + x + 1]; const d = field[(y + 1) * cols + x];
        const pts = [];
        const edge = (v1, v2, x1, y1, x2, y2) => {
          if ((v1 < iso) !== (v2 < iso)) { const t = (iso - v1) / (v2 - v1); pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); }
        };
        const px = x * cell; const py = y * cell;
        edge(a, b, px, py, px + cell, py); edge(b, c, px + cell, py, px + cell, py + cell);
        edge(c, d, px + cell, py + cell, px, py + cell); edge(d, a, px, py + cell, px, py);
        if (pts.length >= 2) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); }
        if (pts.length === 4) { ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[3][0], pts[3][1]); }
      }
      ctx.stroke();
    }
  };
  const topos = $$('canvas.topo');
  const redraw = () => topos.forEach(drawTopo);
  redraw();
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redraw, 200); });

  /* Copy-to-clipboard for phone/email */
  $$('[data-copy]').forEach((b) => b.addEventListener('click', () => {
    const text = b.dataset.copy;
    navigator.clipboard?.writeText(text).then(() => { const o = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = o; }, 1600); }).catch(() => {});
  }));


  /* Review carousels (live-site testimonial carousel) */
  $$('[data-tcar]').forEach((car) => {
    const slides = $$('.slide', car); const dots = $$('.dots button', car);
    if (slides.length < 2) return;
    let i = 0; let t;
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
      clearTimeout(t); if (!reduced) t = setTimeout(() => go(i + 1), 8000);
    };
    $('.prev', car)?.addEventListener('click', () => go(i - 1));
    $('.next', car)?.addEventListener('click', () => go(i + 1));
    dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
    go(0);
  });

  /* Home hero reel: "A New Standard in ___" follows the service on screen */
  const reel = $('[data-reel]'); const word = $('[data-reel-word]');
  if (reel && word) {
    const marks = [[0, 'Hardscapes'], [3.4, 'Irrigation'], [7.2, 'Land Clearing'], [10.2, 'Lawn Maintenance'], [13.6, 'Landscape Design'], [17, 'Outdoor Living']];
    // One size for every service: scale so the longest name fits on one line, so the headline never jumps.
    const fit = () => {
      word.style.fontSize = '';
      if (getComputedStyle(word).whiteSpace === 'normal') return; // phones: wraps instead (CSS reserves two lines)
      const cur = word.textContent; let max = 0;
      marks.forEach(([, l]) => { word.textContent = l; max = Math.max(max, word.scrollWidth); });
      word.textContent = cur;
      const box = word.parentElement.clientWidth;
      if (max > box) word.style.fontSize = `${(box / max) * 0.98}em`;
    };
    let shown = '';
    const show = (lab) => {
      if (lab === shown) return;
      shown = lab;
      word.classList.remove('in'); word.classList.add('out');
      setTimeout(() => { word.textContent = lab; word.classList.remove('out'); void word.offsetWidth; word.classList.add('in'); }, shown === 'Hardscapes' && !word.dataset.started ? 0 : 260);
      word.dataset.started = '1';
    };
    reel.addEventListener('timeupdate', () => show(marks.filter(([s]) => reel.currentTime >= s).pop()[1]));
    // If the video can't autoplay (low-power mode, reduced data), still cycle the words.
    let i = 0;
    setInterval(() => { if (reel.paused || reel.readyState < 2) { i = (i + 1) % marks.length; show(marks[i][1]); } }, 3400);
    addEventListener('resize', fit); fit();
    if (document.fonts) document.fonts.ready.then(fit);
  }

  /* Service Locations dropdown (tap support) */
  $$('.has-dd > button').forEach((dd) => {
    dd.addEventListener('click', () => { const li = dd.parentElement; const open = li.classList.toggle('is-open'); dd.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('click', (e) => { if (!dd.parentElement.contains(e.target)) { dd.parentElement.classList.remove('is-open'); dd.setAttribute('aria-expanded', 'false'); } });
  });


  /* Header compacts and floating quote button appears after scrolling */
  const fq = $('.float-quote');
  const onScroll2 = () => {
    const y = window.scrollY;
    header?.classList.toggle('is-compact', y > 120);
    fq?.classList.toggle('is-visible', y > 700);
  };
  window.addEventListener('scroll', onScroll2, { passive: true }); onScroll2();

  /* Gentle reveal for cards, photos and service boxes below the fold */
  if ('IntersectionObserver' in window && !reduced) {
    const io2 = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.remove('is-pre'); io2.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px' });
    $$('.ibox, .w-img, .svc-photo, .price-table, .sig-card, .trust-item, .factor, .acc, .gallery').forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.95) { el.classList.add('reveal', 'is-pre'); io2.observe(el); }
    });
  }

  const yr = $('[data-year]'); if (yr) yr.textContent = new Date().getFullYear();
})();
