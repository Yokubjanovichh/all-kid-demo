/* all-kid.ru landing: lead form, phone formatting, old URLs matched to a service. No dependencies. */
(function () {
  'use strict';

  // Metrika JS-event goal for a lead (exact identifier from Metrika -> Цели). The Direct strategy uses
  // «Отправка формы с главной» (form goal), «Телефон» and «WhatsApp» (link clicks): none is a JS event,
  // so this stays empty (brief, section 5).
  var LEAD_GOAL = '';

  var SEND_URL = '/send.php';
  var DEMO = true; // GitHub Pages demo: the form is shown, nothing is sent
  var TIMEOUT_MS = 15000;
  var startedAt = Date.now();

  var form = document.getElementById('order-form');
  if (!form) return;

  var serviceInput = document.getElementById('f-service');
  var serviceNote = document.getElementById('f-service-note');
  var phoneInput = document.getElementById('f-phone');
  var submitButton = form.querySelector('.btn-submit');
  var submitLabel = submitButton.textContent;
  var done = document.getElementById('form-done');
  var fail = document.getElementById('form-fail');
  var failText = document.getElementById('form-fail-text');
  var hint = document.getElementById('form-hint');
  var sending = false;

  function setService(name) {
    serviceInput.value = name;
    serviceNote.textContent = 'Услуга: ' + name;
    serviceNote.hidden = false;
  }

  /* ---------- the old URL that was opened ---------- */
  var match = document.documentElement.getAttribute('data-match');
  if (match) {
    var tile = document.querySelector('.tile[data-key="' + match + '"]');
    if (tile && tile.parentNode) {
      tile.parentNode.insertBefore(tile, tile.parentNode.firstChild);
      var tileLink = tile.querySelector('[data-service-name]');
      if (tileLink && match !== 'optom') setService(tileLink.getAttribute('data-service-name'));
    }
  }
  var sectionForPath = { '/contact/': 'kontakty', '/kontakty/': 'kontakty', '/dostavka/': 'kontakty', '/karta-tovara/': 'raschet' };
  var path = location.pathname.replace(/^\/all-kid-demo(?=\/|$)/i, '').toLowerCase().replace(/\/?$/, '/');
  if (sectionForPath[path] && !location.hash) {
    var section = document.getElementById(sectionForPath[path]);
    if (section) window.addEventListener('load', function () { section.scrollIntoView(); });
  }

  /* ---------- the phone call bar steps aside while the hero buttons or the form are visible ---------- */
  var callbar = document.querySelector('.callbar');
  var heroActions = document.querySelector('.hero-actions');
  var orderSection = document.getElementById('raschet');
  if (callbar && heroActions && orderSection && 'IntersectionObserver' in window) {
    var onScreen = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { onScreen[entry.target === heroActions ? 'hero' : 'order'] = entry.isIntersecting; });
      callbar.classList.toggle('is-away', !!(onScreen.hero || onScreen.order));
    });
    observer.observe(heroActions);
    observer.observe(orderSection);
  }

  /* ---------- "Рассчитать заказ" on a service tile remembers the service ---------- */
  document.addEventListener('click', function (event) {
    var link = event.target.closest ? event.target.closest('[data-service-name]') : null;
    if (link) setService(link.getAttribute('data-service-name'));
  });

  /* ---------- phone ---------- */
  function digitsOf(value) {
    return String(value).replace(/\D+/g, '');
  }

  // Same rule as normalize_phone() in send.php.
  function phoneIsValid(value) {
    var d = digitsOf(value);
    if (d.length === 11 && d.charAt(0) === '8') d = '7' + d.slice(1);
    else if (d.length === 10) d = '7' + d;
    return d.length >= 11 && d.length <= 15;
  }

  // Formats Russian numbers as +7 903 123-45-67 while typing. Other country codes are left as typed.
  function formatRussian(value) {
    var trimmed = value.replace(/^\s+/, '');
    var d = digitsOf(trimmed);
    if (!d) return value;
    if (trimmed.charAt(0) === '+' && d.charAt(0) !== '7') return value;
    if (d.charAt(0) === '8') d = '7' + d.slice(1);
    else if (d.charAt(0) === '9') d = '7' + d;
    if (d.charAt(0) !== '7') return value;
    d = d.slice(0, 11);
    var out = '+7';
    if (d.length > 1) out += ' ' + d.slice(1, 4);
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }

  phoneInput.addEventListener('input', function (event) {
    if (event.inputType && event.inputType.indexOf('delete') === 0) return;
    var value = phoneInput.value;
    if (phoneInput.selectionStart !== value.length) return;
    var formatted = formatRussian(value);
    if (formatted !== value) phoneInput.value = formatted;
  });

  /* ---------- validation ---------- */
  function setError(name, message) {
    var box = document.getElementById('e-' + name);
    var input = form.elements[name];
    if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function validate() {
    var errors = {};
    if (form.elements.name.value.replace(/\s+/g, ' ').trim().length < 2) errors.name = 'Укажите имя';
    if (!phoneIsValid(phoneInput.value)) errors.phone = 'Укажите телефон полностью, например +7 903 123-45-67';
    if (form.elements.comment.value.length > 2000) errors.comment = 'Комментарий длиннее 2000 знаков, сократите его';
    if (!form.elements.consent.checked) errors.consent = 'Отметьте согласие на обработку персональных данных';
    return errors;
  }

  function showErrors(errors) {
    var first = null;
    ['name', 'phone', 'comment', 'consent'].forEach(function (name) {
      setError(name, errors[name]);
      if (errors[name] && !first) first = form.elements[name];
    });
    if (first) first.focus();
    return !first;
  }

  /* ---------- the submit button works only when the form is filled in ----------
     Metrika counts the «Отправка формы» goal on every click of the submit button, even when the
     form is invalid, and the strategy pays for each conversion. A disabled button gets no clicks,
     so only real leads count. Without JavaScript the button stays active and send.php validates. */
  function missingText(errors) {
    var fields = [];
    if (errors.name) fields.push('имя');
    if (errors.phone) fields.push(digitsOf(phoneInput.value) ? 'телефон полностью' : 'телефон');
    var actions = [];
    if (fields.length) actions.push('укажите ' + fields.join(' и '));
    if (errors.consent) actions.push('отметьте согласие');
    if (errors.comment) actions.push('сократите комментарий');
    return actions.length ? 'Чтобы отправить заявку, ' + actions.join(', ') + '.' : '';
  }

  function updateReady() {
    var errors = validate();
    var ready = !errors.name && !errors.phone && !errors.comment && !errors.consent;
    if (!sending) submitButton.disabled = !ready;
    if (hint) {
      hint.textContent = ready ? '' : missingText(errors);
      hint.hidden = ready;
    }
  }

  form.addEventListener('input', function (event) {
    if (event.target.name) setError(event.target.name, '');
    updateReady();
  });
  form.addEventListener('change', function (event) {
    if (event.target.name === 'consent') setError('consent', '');
    updateReady();
  });
  // Values restored by the browser (autofill, back button) arrive without an input event.
  window.addEventListener('pageshow', updateReady);
  updateReady();

  /* ---------- sending ---------- */
  function setSending(on) {
    sending = on;
    submitButton.classList.toggle('is-sending', on);
    submitButton.textContent = on ? 'Отправляем…' : submitLabel;
    if (on) submitButton.disabled = true;
    else updateReady();
  }

  function succeed() {
    document.getElementById('done-phone').textContent = phoneInput.value.trim();
    form.hidden = true;
    done.hidden = false;
    done.focus();
    if (LEAD_GOAL && typeof window.ym === 'function' && window.METRIKA_ID) {
      window.ym(window.METRIKA_ID, 'reachGoal', LEAD_GOAL);
    }
  }

  function failWith(kind) {
    failText.textContent = kind === 'rate'
      ? 'С этого адреса уже отправили несколько заявок. Подождите несколько минут или позвоните.'
      : 'Заявка не отправилась.';
    fail.hidden = false;
    setSending(false);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (sending) return;
    fail.hidden = true;
    if (!showErrors(validate())) return;

    setSending(true);
    var data = new FormData(form);
    data.set('elapsed', String(Date.now() - startedAt));
    data.set('page', location.pathname + location.search);
    data.set('referrer', document.referrer || '');

    if (DEMO) { setTimeout(succeed, 600); return; }

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;

    fetch(SEND_URL, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        return response.json().then(
          function (body) { return { status: response.status, body: body }; },
          function () { return { status: response.status, body: null }; }
        );
      })
      .then(function (result) {
        if (timer) clearTimeout(timer);
        if (result.body && result.body.ok) {
          succeed();
        } else if (result.status === 422 && result.body && result.body.fields) {
          setSending(false);
          showErrors(result.body.fields);
        } else {
          failWith(result.status === 429 ? 'rate' : 'send');
        }
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        failWith('send');
      });
  });
})();
