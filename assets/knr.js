/*
 * Maison Célestine — front-end behaviour.
 * A small set of independent, opt-in initialisers. Each scans for its own
 * data- hook so sections stay decoupled and any interaction can be dropped
 * without touching the others. Loaded with `defer`, so the DOM is ready.
 */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* Transparent header solidifies once the hero has scrolled under it.
     Passive scroll, throttled to one class toggle per frame with rAF — no
     layout reads, no jank. */
  function initHeader() {
    var header = $('[data-knr-header]');
    if (!header) return;
    var trigger = header.offsetHeight || 60;
    var ticking = false;
    var update = function () {
      header.classList.toggle('is-stuck', window.scrollY > trigger);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* Expand / collapse accordion groups (one item open at a time per group). */
  function initAccordions() {
    $$('[data-knr-acc]').forEach(function (item) {
      var head = $('[data-knr-acc-head]', item);
      var body = $('[data-knr-acc-body]', item);
      if (!head || !body) return;

      var measure = function () {
        body.style.maxHeight = item.classList.contains('is-open') ? body.scrollHeight + 'px' : '0px';
      };

      head.addEventListener('click', function () {
        var group = item.closest('[data-knr-acc-group]');
        if (group) {
          $$('[data-knr-acc]', group).forEach(function (other) {
            if (other !== item) {
              other.classList.remove('is-open');
              var b = $('[data-knr-acc-body]', other);
              if (b) b.style.maxHeight = '0px';
            }
          });
        }
        item.classList.toggle('is-open');
        measure();
      });

      measure();
    });
    // Recalculate initially-open panels once fonts/layout settle.
    requestAnimationFrame(function () {
      $$('[data-knr-acc].is-open [data-knr-acc-body]').forEach(function (b) {
        b.style.maxHeight = b.scrollHeight + 'px';
      });
    });
  }

  /* Variant switcher: updates price display + the form's variant id. */
  function initVariantPicker() {
    $$('[data-knr-variants]').forEach(function (group) {
      var buttons = $$('[data-knr-variant]', group);
      var scope = group.closest('[data-knr-buybox]') || document;
      var priceEl = $('[data-knr-price]', scope);
      var compareEl = $('[data-knr-compare]', scope);
      var unitEl = $('[data-knr-unit]', scope);
      var idInput = $('[data-knr-variant-id]', scope);
      var submit = $('[data-knr-add]', scope);

      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          buttons.forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');

          if (priceEl) priceEl.textContent = btn.dataset.price || '';
          if (compareEl) {
            compareEl.textContent = btn.dataset.compare || '';
            compareEl.hidden = !btn.dataset.compare;
          }
          if (unitEl) {
            unitEl.textContent = btn.dataset.unit || '';
            unitEl.hidden = !btn.dataset.unit;
          }
          if (idInput) idInput.value = btn.dataset.variantId || '';
          if (submit) {
            var soldOut = btn.dataset.available === 'false';
            submit.disabled = soldOut;
            if (btn.dataset.addLabel || btn.dataset.soldLabel) {
              submit.textContent = soldOut ? btn.dataset.soldLabel : btn.dataset.addLabel;
            }
          }
        });
      });
    });
  }

  /* Cart: Ajax add-to-cart, live badge, and a slide-out drawer. */
  function initCart() {
    var badges = $$('[data-knr-cart-count]');
    var drawer = $('[data-knr-drawer]');
    var body = drawer && $('[data-knr-drawer-body]', drawer);
    var foot = drawer && $('[data-knr-drawer-foot]', drawer);
    var subtotal = drawer && $('[data-knr-drawer-subtotal]', drawer);

    var money = function (cents, currency) {
      try {
        return new Intl.NumberFormat('en', { style: 'currency', currency: currency || 'EUR' }).format(cents / 100);
      } catch (e) {
        return (cents / 100).toFixed(2);
      }
    };

    var esc = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };

    var syncBadges = function (cart) {
      badges.forEach(function (b) {
        b.textContent = cart.item_count;
        b.hidden = cart.item_count === 0;
      });
    };

    var render = function (cart) {
      if (!body) return;
      if (!cart.items.length) {
        body.innerHTML = '<p class="knr-drawer__empty">Votre panier est vide.</p>';
        if (foot) foot.hidden = true;
        return;
      }
      body.innerHTML = cart.items.map(function (it) {
        var img = it.image ? '<img src="' + esc(it.image) + '" alt="" width="60" height="60">' : '<span></span>';
        var variant = (it.variant_title && it.variant_title !== 'Default Title')
          ? '<div class="knr-drawer__it-variant">' + esc(it.variant_title) + '</div>' : '';
        return '<div class="knr-drawer__item">' + img +
          '<div class="knr-drawer__it-info">' +
            '<div class="knr-drawer__it-title">' + esc(it.product_title) + '</div>' + variant +
            '<div class="knr-drawer__it-qty">Qté ' + it.quantity + '</div>' +
          '</div>' +
          '<div class="knr-drawer__it-price">' + money(it.final_line_price, cart.currency) + '</div>' +
        '</div>';
      }).join('');
      if (subtotal) subtotal.textContent = money(cart.total_price, cart.currency);
      if (foot) foot.hidden = false;
    };

    var open = function () {
      if (!drawer) return;
      drawer.hidden = false;
      document.body.style.overflow = 'hidden';
    };
    var close = function () {
      if (!drawer) return;
      drawer.hidden = true;
      document.body.style.overflow = '';
    };

    var getCart = function () {
      return fetch('/cart.js', { headers: { 'Accept': 'application/json' } }).then(function (r) { return r.json(); });
    };
    var showCart = function () {
      return getCart().then(function (cart) {
        syncBadges(cart);
        if (drawer) { render(cart); open(); } else { window.location.href = '/cart'; }
      });
    };

    if (drawer) {
      $$('[data-knr-drawer-close]', drawer).forEach(function (el) { el.addEventListener('click', close); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) close(); });
      $$('[data-knr-cart-toggle]').forEach(function (el) {
        el.addEventListener('click', function (e) { e.preventDefault(); showCart(); });
      });
    }

    $$('.knr-cart-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = $('[data-knr-add]', form);
        if (btn) btn.classList.add('is-loading');
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: new FormData(form)
        })
          .then(function (r) { if (!r.ok) throw new Error('add failed'); return r.json(); })
          .then(function () { return showCart(); })
          .catch(function () { form.submit(); })
          .finally(function () { if (btn) btn.classList.remove('is-loading'); });
      });
    });
  }

  /* Horizontal rail — reflects scroll position onto a set of pager dots. */
  function initRails() {
    $$('[data-knr-rail]').forEach(function (rail) {
      var dotsHost = $('[data-knr-dots="' + rail.dataset.knrRail + '"]') ||
        (rail.parentElement && $('[data-knr-dots]', rail.parentElement));
      var next = $('[data-knr-rail-next="' + rail.dataset.knrRail + '"]');

      if (dotsHost) {
        var dots = $$('i', dotsHost);
        rail.addEventListener('scroll', function () {
          var per = rail.scrollWidth / rail.children.length;
          var i = Math.min(Math.round(rail.scrollLeft / per), dots.length - 1);
          dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
        }, { passive: true });
      }
      if (next) {
        next.addEventListener('click', function () {
          rail.scrollBy({ left: rail.clientWidth * 0.7, behavior: 'smooth' });
        });
      }
    });
  }

  /* Drag-to-scroll ("swipe" with a mouse) for horizontal rails. */
  function initDragScroll() {
    $$('[data-knr-drag]').forEach(function (rail) {
      var down = false, startX = 0, startLeft = 0, moved = false;
      rail.style.cursor = 'grab';
      rail.addEventListener('pointerdown', function (e) {
        down = true; moved = false; startX = e.clientX; startLeft = rail.scrollLeft;
        rail.style.cursor = 'grabbing';
        rail.setPointerCapture(e.pointerId);
      });
      rail.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 3) moved = true;
        rail.scrollLeft = startLeft - dx;
      });
      var end = function () { down = false; rail.style.cursor = 'grab'; };
      rail.addEventListener('pointerup', end);
      rail.addEventListener('pointercancel', end);
      rail.addEventListener('click', function (e) { if (moved) e.preventDefault(); }, true);
    });
  }

  /* Testimonial carousel — one quote visible, prev/next cycles through them. */
  function initTestimonials() {
    $$('[data-knr-testimonial]').forEach(function (root) {
      var items = $$('[data-knr-quote]', root);
      if (items.length < 2) return;
      var i = 0;
      var show = function (n) {
        i = (n + items.length) % items.length;
        items.forEach(function (el, k) { el.hidden = k !== i; });
      };
      var prev = $('[data-knr-quote-prev]', root);
      var next = $('[data-knr-quote-next]', root);
      if (prev) prev.addEventListener('click', function () { show(i - 1); });
      if (next) next.addEventListener('click', function () { show(i + 1); });
      show(0);
    });
  }

  /* Before / after comparison slider. */
  function initBeforeAfter() {
    $$('[data-knr-ba]').forEach(function (root) {
      var after = $('[data-knr-ba-after]', root);
      var line = $('[data-knr-ba-line]', root);
      var handle = $('[data-knr-ba-handle]', root);
      if (!after || !line || !handle) return;

      var set = function (pct) {
        pct = Math.max(4, Math.min(96, pct));
        after.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
        line.style.left = pct + '%';
        handle.style.left = pct + '%';
      };
      var dragging = false;
      var move = function (e) {
        if (!dragging) return;
        var rect = root.getBoundingClientRect();
        var x = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) / rect.width * 100;
        set(x);
      };
      handle.addEventListener('mousedown', function () { dragging = true; });
      handle.addEventListener('touchstart', function () { dragging = true; }, { passive: true });
      window.addEventListener('mouseup', function () { dragging = false; });
      window.addEventListener('touchend', function () { dragging = false; });
      window.addEventListener('mousemove', move);
      window.addEventListener('touchmove', move, { passive: true });
      root.addEventListener('click', function (e) {
        var rect = root.getBoundingClientRect();
        set((e.clientX - rect.left) / rect.width * 100);
      });
      set(50);
    });
  }

  /* Click a gallery image (or its + button) to view it full-size in a lightbox. */
  function initZoom() {
    var triggers = $$('[data-knr-zoom]');
    if (!triggers.length) return;

    var overlay = document.createElement('div');
    overlay.className = 'knr-lightbox';
    overlay.hidden = true;
    overlay.innerHTML = '<button class="knr-lightbox__close" type="button" aria-label="Fermer">&times;</button><img class="knr-lightbox__img" alt="">';
    document.body.appendChild(overlay);
    var img = $('.knr-lightbox__img', overlay);

    var close = function () {
      overlay.hidden = true;
      img.removeAttribute('src');
      document.body.style.overflow = '';
    };
    var open = function (src, alt) {
      if (!src) return;
      img.src = src;
      img.alt = alt || '';
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
    };

    triggers.forEach(function (cell) {
      cell.addEventListener('click', function () {
        var inner = $('img', cell);
        open(cell.getAttribute('data-knr-zoom-src') || (inner && inner.currentSrc), inner && inner.alt);
      });
    });
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) close();
    });
  }

  function init() {
    initHeader();
    initAccordions();
    initVariantPicker();
    initCart();
    initRails();
    initDragScroll();
    initTestimonials();
    initBeforeAfter();
    initZoom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

