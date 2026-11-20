// Reusable Google Ads tracking standard (RISE playbook §12d). Copied into a build only when
// client.json has a `tracking` block; it holds no client IDs. Configuration comes from the
// page's #rise-tracking-config JSON. Google tags, call tracking, click_to_call, generate_lead
// and live form submission run ONLY on a configured production hostname and never under
// Global Privacy Control. The Essential Only / Allow Optional choice does not gate them.
// Attribution capture into hidden form fields runs everywhere; it sends nothing by itself.
(function () {
  'use strict';
  var configNode = document.getElementById('rise-tracking-config');
  if (!configNode) return;
  var config;
  try { config = JSON.parse(configNode.textContent); } catch (error) { return; }

  var ATTRIBUTION_KEYS = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var STORE_KEY = 'rise_attribution_v1';
  var LEAD_KEY = 'rise_lead_pending_v1';
  var STORE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  var LEAD_TTL_MS = 30 * 60 * 1000;
  var GCLID_PATTERN = /^[A-Za-z0-9_-]{6,256}$/;
  var gpc = navigator.globalPrivacyControl === true;
  var hostname = String(window.location.hostname || '').toLowerCase().replace(/\.$/, '');
  var productionHost = Array.isArray(config.domains) && config.domains.indexOf(hostname) !== -1;

  function cleanValue(key, value) {
    if (typeof value !== 'string') return '';
    var trimmed = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 256);
    if (key === 'gclid' && !GCLID_PATTERN.test(trimmed)) return '';
    return trimmed;
  }

  // 1. Attribution: capture the six parameters, persist first-party for 90 days (last touch).
  function readStoredAttribution() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
      if (stored && stored.expires > Date.now() && stored.values) return stored.values;
      window.localStorage.removeItem(STORE_KEY);
    } catch (error) {}
    return {};
  }
  function captureAttribution() {
    var params = new URLSearchParams(window.location.search);
    var found = {};
    var any = false;
    ATTRIBUTION_KEYS.forEach(function (key) {
      var value = cleanValue(key, params.get(key));
      if (value) { found[key] = value; any = true; }
    });
    if (!any) return readStoredAttribution();
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify({ values: found, expires: Date.now() + STORE_TTL_MS })); } catch (error) {}
    return found;
  }
  var attribution = captureAttribution();
  function fillAttributionFields() {
    document.querySelectorAll('form input[type="hidden"][data-rise-attribution]').forEach(function (input) {
      input.value = attribution[input.getAttribute('data-rise-attribution')] || '';
    });
  }
  fillAttributionFields();

  // 2. GA4 receives only a validated gclid plus the fixed Google Ads UTMs; utm_term,
  //    utm_content and every other query parameter are stripped from page_location/referrer.
  function ga4PageLocation() {
    var params = new URLSearchParams(window.location.search);
    var allowed = [];
    var gclid = cleanValue('gclid', params.get('gclid'));
    if (gclid) allowed.push(['gclid', gclid]);
    if (params.get('utm_source') === 'google') allowed.push(['utm_source', 'google']);
    if (params.get('utm_medium') === 'cpc') allowed.push(['utm_medium', 'cpc']);
    if (config.campaign_slug && params.get('utm_campaign') === config.campaign_slug) allowed.push(['utm_campaign', config.campaign_slug]);
    var query = allowed.map(function (pair) { return encodeURIComponent(pair[0]) + '=' + encodeURIComponent(pair[1]); }).join('&');
    return window.location.origin + window.location.pathname + (query ? '?' + query : '');
  }
  function ga4PageReferrer() {
    if (!document.referrer) return '';
    try { var ref = new URL(document.referrer); return ref.origin + ref.pathname; } catch (error) { return ''; }
  }

  function swapPhoneNumber(formattedNumber, mobileNumber) {
    if (!formattedNumber) return;
    var telNumber = String(mobileNumber || formattedNumber).replace(/[^0-9+]/g, '');
    document.querySelectorAll('a[href^="tel:"]').forEach(function (link) { link.setAttribute('href', 'tel:' + telNumber); });
    var displayed = config.phone_conversion_number;
    if (!displayed || displayed === formattedNumber || !document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      var parent = walker.currentNode.parentNode;
      if (parent && /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(parent.nodeName)) continue;
      if (walker.currentNode.nodeValue.indexOf(displayed) !== -1) nodes.push(walker.currentNode);
    }
    nodes.forEach(function (node) { node.nodeValue = node.nodeValue.split(displayed).join(formattedNumber); });
  }

  // 3. One plain gtag.js (never Google Tag Manager), loaded only behind the hostname + GPC guard.
  function startGoogleTag() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    var pageFields = { page_location: ga4PageLocation(), page_referrer: ga4PageReferrer() };
    window.gtag('js', new Date());
    window.gtag('set', pageFields);
    window.gtag('config', config.ga4_measurement_id, pageFields);
    if (config.google_ads_id) window.gtag('config', config.google_ads_id, pageFields);
    if (config.google_ads_id && config.call_conversion) {
      window.gtag('config', config.call_conversion, {
        phone_conversion_number: config.phone_conversion_number,
        phone_conversion_callback: swapPhoneNumber
      });
    }
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(config.ga4_measurement_id);
    document.head.appendChild(tag);

    // click_to_call on every tel: tap (secondary signal).
    document.addEventListener('click', function (event) {
      var link = event.target && event.target.closest ? event.target.closest('a[href^="tel:"]') : null;
      if (link) window.gtag('event', 'click_to_call');
    });

    // generate_lead fires on /thanks/ only, once, behind the one-use flag set by a successful POST.
    if (window.location.pathname === config.thanks_path && takeLeadFlag()) window.gtag('event', 'generate_lead');
  }

  function setLeadFlag() {
    try { window.sessionStorage.setItem(LEAD_KEY, String(Date.now())); } catch (error) {}
  }
  function takeLeadFlag() {
    var stamp = null;
    try {
      stamp = window.sessionStorage.getItem(LEAD_KEY);
      window.sessionStorage.removeItem(LEAD_KEY);
    } catch (error) { return false; }
    var age = Date.now() - Number(stamp);
    return stamp !== null && age >= 0 && age < LEAD_TTL_MS;
  }

  if (productionHost && !gpc) startGoogleTag();
  else if (window.location.pathname === config.thanks_path) takeLeadFlag();

  // 4. Live form: only on a production hostname with a configured endpoint. Elsewhere the
  //    review-only behavior in main.js stays in charge and nothing is transmitted.
  if (!productionHost) return;
  document.querySelectorAll('form[data-quote-form][data-endpoint]').forEach(function (form) {
    var note = form.querySelector('[data-form-note]');
    var status = form.querySelector('[data-form-status]');
    var button = form.querySelector('button[type="submit"]');
    if (note && form.getAttribute('data-live-note')) note.textContent = form.getAttribute('data-live-note');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (form.getAttribute('data-sending') === 'true') return;
      fillAttributionFields();
      var payload = {};
      new FormData(form).forEach(function (value, key) { payload[key] = String(value); });
      payload.page_path = window.location.pathname;
      form.setAttribute('data-sending', 'true');
      if (button) button.disabled = true;
      if (status) { status.hidden = true; status.textContent = ''; }
      window.fetch(form.getAttribute('data-endpoint'), {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (response) {
        if (!response.ok) throw new Error('Form endpoint returned ' + response.status);
        setLeadFlag();
        window.location.assign(config.thanks_path);
      }).catch(function () {
        form.removeAttribute('data-sending');
        if (button) button.disabled = false;
        if (status) { status.textContent = 'Sorry, your request did not go through. Please try again or call us.'; status.hidden = false; }
      });
    }, true);
  });
}());
