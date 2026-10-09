(() => {
  "use strict";
  const { NICHES, MODELS, THEMES, BLOCKS, OPTIONS, PRESETS } = window.CFG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const el = {
    stage: $("#stage"), stageCol: $("#stageCol"), hint: $("#hint"), openFull: $("#openFull"), closeFull: $("#closeFull"),
    steps: $("#steps"), dock: $("#dock"),
    name: $("#name"), niches: $("#niches"), models: $("#models"), themes: $("#themes"), themeName: $("#themeName"),
    blocks: $("#blocks"), options: $("#options"), summary: $("#summary"), term: $("#term"),
    send: $("#send"), copy: $("#copy"), dockSend: $("#dockSend"), dockName: $("#dockName"), dockMeta: $("#dockMeta"),
    dockDays: $("#dockDays"), toast: $("#toast"),
  };

  /* ---------------- два устройства из одного шаблона ----------------
     Раньше MacBook «растягивался» в iPhone, и сайт внутри перестраивался на каждом кадре —
     отсюда подтормаживание. Теперь это два готовых устройства: одно уходит, другое всплывает,
     анимируются только transform и opacity. */
  const tpl = $("#pos");
  const phonePos = tpl.cloneNode(true);
  tpl.after(phonePos);
  const D = {};
  for (const [mode, pos] of [["mac", tpl], ["phone", phonePos]]) {
    $$("[id]", pos).forEach((n) => n.removeAttribute("id"));
    pos.removeAttribute("id");
    pos.classList.add(`pos--${mode}`);
    const rig = $(".rig", pos);
    rig.classList.toggle("is-mac", mode === "mac");
    rig.classList.toggle("is-phone", mode === "phone");
    $$(mode === "mac" ? ".phone-only" : ".mac-only", pos).forEach((n) => n.remove());
    D[mode] = {
      pos, rig, webview: $(".webview", pos), island: $(".island", pos),
      islandL: $(".island__l", pos), islandT: $(".island__t", pos), islandR: $(".island__r", pos),
      banner: $(".banner", pos), bannerText: $(".banner__text", pos), infobar: $(".infobar", pos),
      observer: null, islandTimer: 0, bannerTimer: 0,
    };
  }

  /* ---------------- состояние (и чтение «примерки» из ссылки) ---------------- */
  const q = new URLSearchParams(location.search);
  const pick = (v, dict, def) => (v && Object.hasOwn(dict, v) ? v : def);
  const list = (v, dict) => (v ? v.split(",").filter((k) => Object.hasOwn(dict, k)) : null);
  const cleanName = (v) => (v || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 32);

  const S = {
    name: cleanName(q.get("n")),
    niche: pick(q.get("t"), NICHES, "coffee"),
    model: pick(q.get("m"), MODELS, "landing"),
    theme: pick(q.get("s"), THEMES, "premium"),
    blocks: null, opts: null,
    device: pick(q.get("d"), { mac: 1, phone: 1 }, innerWidth < 700 ? "phone" : "mac"),
    fitting: !!q.get("n"),
    themeTouched: !!q.get("s"), // стиль выбрали руками — сборка под нишу его не трогает
    cart: 0,
  };
  S.blocks = new Set(list(q.get("b"), BLOCKS) || MODELS[S.model].blocks);
  S.opts = new Set(list(q.get("o"), OPTIONS) || ["tg"]);

  const niche = () => NICHES[S.niche];
  const theme = () => THEMES[S.theme];
  const shownName = () => S.name || niche().name;
  const active = () => D[S.device];

  /* ---------------- помощники ---------------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, f) => f[(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][Math.min(n % 10, 5)]];
  const daysWord = (n) => `~${n} ${plural(n, ["день", "дня", "дней"])}`;
  const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  const domain = (name) => {
    const slug = name.toLowerCase().split("").map((c) => (c in TR ? TR[c] : c)).join("")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28).replace(/-+$/, "");
    return (slug || "vash-sait") + ".ru";
  };
  const initial = (name) => (name.trim()[0] || "•").toUpperCase();
  // Эмодзи как на iPhone и в Telegram: картинки Apple вместо системных (на Windows они плоские).
  // Если картинка не загрузится, на её место встанет обычный символ.
  const EMO = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/";
  const emo = (s) => `<img class="emo" src="${EMO}${[...s].map((c) => c.codePointAt(0).toString(16)).join("-")}.png" alt="" data-e="${esc(s)}" draggable="false" decoding="async" onerror="this.replaceWith(this.dataset.e)">`;
  // Эмодзи на кнопках ниш и опций — из набора Google Noto: статичная картинка и анимация к ней рисованы вместе,
  // поэтому при нажатии эмодзи оживает на месте, без подмены рисунка (как анимированные эмодзи в Telegram).
  const NOTO = "https://fonts.gstatic.com/s/e/notoemoji/latest/";
  const notoCode = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join("_");
  const noto = (s) => `<span class="em"><img class="emo" src="${NOTO}${notoCode(s)}/emoji.svg" alt="" data-e="${esc(s)}" draggable="false" decoding="async" onerror="this.replaceWith(this.dataset.e)"></span>`;
  const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  // Срок всегда в вилке модели: голая модель — нижняя граница, включено всё — верхняя
  // (визитка не дольше 5 дней, самый большой сайт — не дольше 3 недель).
  function totalDays() {
    const m = MODELS[S.model];
    let extra = 0, all = 0;
    for (const [k, b] of Object.entries(BLOCKS)) {
      if (m.blocks.includes(k)) continue;
      all += b.days;
      if (S.blocks.has(k)) extra += b.days;
    }
    for (const [k, o] of Object.entries(OPTIONS)) {
      all += o.days;
      if (S.opts.has(k)) extra += o.days;
    }
    return Math.round(m.days + (m.max - m.days) * (all ? extra / all : 0));
  }

  /* ---------------- эффекты: полёт по дуге, всплывающие «+1 день», конфетти ---------------- */
  const EASE = "cubic-bezier(.32,.72,0,1)";
  const fx = document.createElement("div");
  fx.className = "fx";
  fx.setAttribute("aria-hidden", "true");
  document.body.append(fx);

  // Точка на экране активного устройства (доли ширины и высоты сайта).
  function screenPoint(px = 0.5, py = 0.35) {
    const r = active().webview.getBoundingClientRect();
    return [r.left + r.width * px, r.top + r.height * py];
  }

  // Капля краски летит от кружка стиля в экран устройства.
  // X, Y и «подброс» анимируются на разных обёртках — так получается дуга.
  function fly(html, from, to, { dur = 650, color } = {}) {
    if (reduced || from.bottom < 0 || from.top > innerHeight) return;
    const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2;
    const dx = to[0] - x0, dy = to[1] - y0;
    const lift = Math.min(150, Math.hypot(dx, dy) * 0.3);
    const n = document.createElement("span");
    n.className = "fly";
    n.style.left = `${x0}px`;
    n.style.top = `${y0}px`;
    n.innerHTML = `<span class="fly__y"><span class="fly__l"><span class="fly__b">${html}</span></span></span>`;
    fx.append(n);
    const y = n.firstChild, l = y.firstChild, b = l.firstChild;
    n.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], { duration: dur, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" });
    y.animate([{ transform: "translateY(0)" }, { transform: `translateY(${dy}px)` }], { duration: dur, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
    l.animate([
      { transform: "translateY(0)", easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: `translateY(${-lift}px)`, offset: 0.45, easing: "cubic-bezier(.6,0,.8,.3)" },
      { transform: "translateY(0)" },
    ], { duration: dur, fill: "forwards" });
    b.animate([
      { transform: "translate(-50%,-50%) scale(1) rotate(0deg)", opacity: 1 },
      { transform: "translate(-50%,-50%) scale(1.55) rotate(-14deg)", opacity: 1, offset: 0.35 },
      { transform: "translate(-50%,-50%) scale(.7) rotate(10deg)", opacity: 1, offset: 0.9 },
      { transform: "translate(-50%,-50%) scale(.35) rotate(0deg)", opacity: 0 },
    ], { duration: dur, fill: "forwards" }).onfinish = () => { n.remove(); land(to, color); };
  }
  function land([x, y], color) {
    const r = document.createElement("span");
    r.className = "land";
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    if (color) r.style.setProperty("--c", color);
    fx.append(r);
    r.animate([{ transform: "scale(.3)", opacity: 0.9 }, { transform: "scale(2.6)", opacity: 0 }], { duration: 600, easing: "cubic-bezier(.2,.7,.3,1)" })
      .onfinish = () => r.remove();
  }

  /* ---------------- анимированные эмодзи: при нажатии проигрываются один раз, как в Telegram ----------------
     Анимации — Google Noto Animated Emoji (CC BY 4.0). Плеер Lottie и файл анимации грузятся, только когда нужны. */
  const LOTTIE_JS = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";
  // Только эмодзи, у которых первый кадр анимации совпадает со статичной картинкой (проверено попиксельно).
  const ANIM = new Set([
    "2615", "2702_fe0f", "2699_fe0f", "1f697", "1f48b", "1f62c", "1f4aa", "1f6e0_fe0f", "1f3e0", "1f354", "1f388",
    "1f4f7", "1f393", "1f490", "1f30a", "1f43e", "1f6f8", "2708_fe0f", "23f3", "1fa99", "2728", "1f30d", "1f916",
  ]);
  let lottieReady = null;
  const loadLottie = () => (lottieReady ||= new Promise((ok, fail) => {
    const sc = document.createElement("script");
    sc.src = LOTTIE_JS;
    sc.async = true;
    sc.onload = () => (window.lottie ? ok(window.lottie) : fail(new Error("lottie")));
    sc.onerror = fail;
    document.head.append(sc);
  }));
  const animData = new Map();
  function getAnim(s) {
    const code = s && notoCode(s);
    if (!code || !ANIM.has(code)) return null;
    if (!animData.has(code)) {
      const p = fetch(`${NOTO}${code}/lottie.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
      p.catch(() => {});
      animData.set(code, p);
    }
    return animData.get(code);
  }
  // host — обёртка .em со статичной картинкой. Анимация рисуется поверх неё в той же рамке,
  // картинка прячется на первом кадре и возвращается на последнем — подмены не видно.
  function playEmoji(host, s) {
    if (reduced || !host || host.classList.contains("is-playing")) return;
    const data = getAnim(s);
    if (!data) { restart(host, "is-jelly"); return; }
    host.classList.add("is-playing");
    const t0 = performance.now();
    Promise.all([loadLottie(), data]).then(([lottie, json]) => {
      if (performance.now() - t0 > 1500) throw new Error("late"); // не успели — не догоняем через секунды
      const box = document.createElement("span");
      box.className = "lot";
      host.append(box);
      const a = lottie.loadAnimation({ container: box, renderer: "svg", loop: false, autoplay: false, animationData: structuredClone(json) });
      a.setSpeed(Math.max(1, (json.op - json.ip) / json.fr / 2.2)); // слишком длинные чуть ускоряем
      const clean = () => { a.destroy(); box.remove(); host.classList.remove("is-playing"); };
      // короткое перетекание картинка ⇄ анимация прячет даже мелкие отличия первого и последнего кадра
      a.addEventListener("DOMLoaded", () => { host.classList.add("is-hidden"); a.play(); });
      a.addEventListener("complete", () => { host.classList.remove("is-hidden"); setTimeout(clean, 180); });
    }).catch(() => { host.classList.remove("is-playing", "is-hidden"); restart(host, "is-jelly"); });
  }

  // «+1 день» всплывает над карточкой, которую нажали.
  function floatTag(node, diff) {
    if (!diff || reduced) return;
    const r = node.getBoundingClientRect();
    const t = document.createElement("span");
    t.className = `ftag${diff < 0 ? " is-neg" : ""}`;
    t.textContent = `${diff > 0 ? "+" : "−"}${Math.abs(diff)} ${plural(Math.abs(diff), ["день", "дня", "дней"])}`;
    t.style.left = `${r.right - 10}px`;
    t.style.top = `${r.top + 6}px`;
    fx.append(t);
    t.animate([
      { transform: "translate(-100%, 0) scale(.7)", opacity: 0 },
      { transform: "translate(-100%, -22px) scale(1)", opacity: 1, offset: 0.22 },
      { transform: "translate(-100%, -34px) scale(1)", opacity: 1, offset: 0.7 },
      { transform: "translate(-100%, -52px) scale(.95)", opacity: 0 },
    ], { duration: 1100, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => t.remove();
  }

  // Конфетти с сопротивлением воздуха: взлетают быстро, падают плавно.
  function confetti(node) {
    if (reduced) return;
    const r = node.getBoundingClientRect();
    const colors = [theme().v.acc, "#0071e3", "#34c759", "#ff9f0a", "#ff375f", "#bf5af2", "#5ac8fa"];
    const K = 1.6, G = 1500;
    for (let i = 0; i < 46; i++) {
      const p = document.createElement("i");
      p.className = "confetti";
      p.style.left = `${r.left + r.width / 2 + (Math.random() - 0.5) * r.width * 0.6}px`;
      p.style.top = `${r.top + r.height / 3}px`;
      p.style.background = colors[i % colors.length];
      const a = (-90 + (Math.random() - 0.5) * 120) * Math.PI / 180;
      const v = 700 + Math.random() * 800;
      const vx = Math.cos(a) * v, vy = Math.sin(a) * v;
      const spin = (Math.random() - 0.5) * 1080, flip = 360 + Math.random() * 720;
      const T = 1.6 + Math.random() * 0.7;
      const frames = [];
      for (let s = 0; s <= 10; s++) {
        const t = (T * s) / 10, e = (1 - Math.exp(-K * t)) / K;
        const x = vx * e, y = (G / K) * t + (vy - G / K) * e;
        frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(spin * t).toFixed(0)}deg) rotateY(${(flip * t).toFixed(0)}deg)`, opacity: s > 7 ? 1 - (s - 7) / 3 : 1 });
      }
      fx.append(p);
      p.animate(frames, { duration: T * 1000, delay: Math.random() * 80, fill: "backwards" }).onfinish = () => p.remove();
    }
  }

  // Волна от пальца по карточке (только на клик мышью или пальцем, не с клавиатуры).
  document.addEventListener("click", (e) => {
    if (reduced || e.detail === 0) return;
    const t = e.target.closest(".tile, .card, .chk, .opt");
    if (!t) return;
    const r = t.getBoundingClientRect();
    const s = Math.hypot(r.width, r.height) * 2;
    const rip = document.createElement("span");
    rip.className = "rip";
    Object.assign(rip.style, { width: `${s}px`, height: `${s}px`, left: `${e.clientX - r.left - s / 2}px`, top: `${e.clientY - r.top - s / 2}px` });
    t.append(rip);
    rip.addEventListener("animationend", () => rip.remove(), { once: true });
  });

  let toastTimer;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("is-on"), 2600);
  }

  /* ---------------- Dynamic Island и уведомления (на активном устройстве) ---------------- */
  function island(left, text, right = "●", ms = 2300) {
    const d = active();
    d.islandL.innerHTML = emo(left);
    d.islandT.textContent = text;
    d.islandR.textContent = right;
    d.island.classList.add("is-wide");
    clearTimeout(d.islandTimer);
    d.islandTimer = setTimeout(() => d.island.classList.remove("is-wide"), ms);
  }
  function notify(text) {
    const d = active();
    d.bannerText.textContent = text;
    d.banner.classList.remove("is-on");
    void d.banner.offsetWidth;
    d.banner.classList.add("is-on");
    clearTimeout(d.bannerTimer);
    d.bannerTimer = setTimeout(() => d.banner.classList.remove("is-on"), 3600);
  }

  /* ---------------- часы и батарея 67% ---------------- */
  const fmtTime = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const fmtDay = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  function tick() {
    const now = new Date();
    const t = fmtTime.format(now);
    const day = fmtDay.format(now).replace(/\.$/, "").replace(/^(.)/, (c) => c.toUpperCase()).replace(",", "");
    $$("[data-clock]").forEach((n) => (n.textContent = t));
    $$("[data-clock-long]").forEach((n) => (n.textContent = `${day} ${t}`));
  }
  tick();
  setInterval(tick, 15000);

  /* ---------------- сайт-превью ---------------- */
  function bookingDays() {
    const fmtW = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i + 1);
      return [fmtW.format(d).replace(".", ""), d.getDate()];
    });
  }

  const sbtn = (text, cls = "", act = "cta") => `<button type="button" class="s-btn ${cls}" data-act="${act}">${esc(text)}</button>`;

  /* ---------------- объёмные сцены (опция «Анимации и 3D») ---------------- */
  const S3 = { car: 0, paint: "black", prod: null, pop: -1, lit: false };
  const paintColor = () => (P3D.PAINTS.find((p) => p.k === S3.paint) || P3D.PAINTS[0]).c;
  function stageHTML(mode, extra = {}) {
    const st = { initial: esc(initial(shownName())), car: S3.car, paint: S3.paint, pop: S3.pop, ...extra };
    return `<div class="s-3d${S3.lit ? " is-lit" : ""}" data-act="poke" data-scene="${S.niche}" style="--paint:${paintColor()}">${P3D.scene(S.niche, st, `${mode}-h`)}</div>`;
  }
  // Магазин. С включённым 3D у кофейни товары объёмные: нажал — открывается карточка, у банки поднимается крышка.
  function shopHTML(mode) {
    const n = niche();
    const p3 = S.opts.has("motion") && P3D.hasProducts(S.niche);
    const pic = (i, e) => (p3
      ? `<span class="s-item__pic s-item__pic--3d" data-act="prod" data-i="${i}"><span class="s-3d s-3d--mini">${P3D.product(S.niche, i, `${mode}-pi${i}`)}</span></span>`
      : `<span class="s-item__pic">${emo(e)}</span>`);
    let panel = "";
    if (p3 && n.shop[S3.prod]) {
      const [a, pr] = n.shop[S3.prod];
      panel = `<div class="s-prod">
          <div class="s-3d s-3d--prod is-open" data-act="prodpoke">${P3D.product(S.niche, S3.prod, `${mode}-pp`)}<span class="s3d-hint">Нажмите — откроем ещё раз</span></div>
          <div class="s-prod__info"><small>Вы выбрали</small><b>${esc(a)}</b><span>${esc(pr)}</span>
            <div class="s-prod__btns">${sbtn("В корзину", "", "add")}${sbtn("Закрыть", "s-btn--ghost", "prodclose")}</div></div>
        </div>`;
    }
    return `<h2>${S.opts.has("pay") ? "Купить онлайн" : "Магазин"}<small>${p3 ? "Нажмите на товар — откроем его" : "Корзина работает — попробуйте"}</small></h2>
      ${panel}<div class="s-shop">${n.shop.map(([a, p, e], i) => `
        <div class="s-item${p3 && S3.prod === i ? " is-on" : ""}">${pic(i, e)}<b>${esc(a)}</b><span>${esc(p)}</span>${sbtn("В корзину", "s-btn--sm", "add")}</div>`).join("")}</div>`;
  }

  function siteHTML(mode) {
    const n = niche(), th = theme(), name = shownName();
    const has = (b) => S.blocks.has(b);
    const opt = (o) => S.opts.has(o);
    const img = (i, eager) => `<img src="img/${S.niche}-${i}.webp" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async" onload="this.classList.add('is-loaded')">`;
    const blk = (key, on, inner, alt) =>
      `<div class="blk${on ? "" : " off"}" data-b="${key}"><div class="blk__in"><section class="s-sec${alt ? " s-sec--alt" : ""}"><div class="rv">${inner}</div></section></div></div>`;
    const btn = sbtn;
    const pay = opt("pay") ? `<span class="s-pay"><i>Карта</i><i>СБП</i></span>` : "";

    const nav = `
      <nav class="s-nav">
        <a class="s-logo" href="#" data-act="top"><i data-initial>${esc(initial(name))}</i><span data-name>${esc(name)}</span></a>
        <ul>${n.nav.map((x, i) => `<li><a href="#" data-act="nav" data-i="${i}">${esc(x)}</a></li>`).join("")}</ul>
        <div class="s-tools">
          ${opt("lang") ? `<span class="s-lang" data-act="lang"><span class="on">RU</span><span>EN</span></span>` : ""}
          ${has("shop") ? `<span class="s-cart${S.cart ? " has" : ""}" data-act="cart"><svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="20" r="1.4" fill="currentColor"/><circle cx="17" cy="20" r="1.4" fill="currentColor"/></svg><b>${S.cart}</b></span>` : ""}
          ${btn(n.cta.split(" ")[0], "s-btn--sm")}
          <span class="s-burger" aria-hidden="true"><i></i></span>
        </div>
      </nav>`;

    const hero = `
      <header class="s-hero${opt("motion") ? " has-3d" : ""}">
        <div class="s-hero__txt">
          <span class="s-kicker s-in" style="--d:0">${esc(n.kicker)}</span>
          <h1 class="s-in" style="--d:1" data-name>${esc(name)}</h1>
          <p class="s-lead s-in" style="--d:2">${esc(n.lead)}</p>
          <div class="s-cta s-in" style="--d:3">${btn(n.cta)}${pay}</div>
        </div>
        ${opt("motion") ? stageHTML(mode) : `<figure>${img(0, true)}</figure>`}
      </header>`;

    const services = `<h2>${esc(n.hServices)}<small>Цены без звонков и «уточняйте у менеджера»</small></h2>
      <div class="s-list">${n.services.map(([a, p]) => `<div class="s-row"><b>${esc(a)}</b><span>${esc(p)}</span></div>`).join("")}</div>`;

    const booking = `<h2>Онлайн-запись<small>Выберите день и время — подтвердим за 5 минут</small></h2>
      <div class="s-book">
        <div class="s-chips">${bookingDays().map(([w, d], i) => `<span class="s-chip${i === 1 ? " on" : ""}" data-act="chip">${esc(w)}<small>${d}</small></span>`).join("")}</div>
        <div class="s-chips">${["10:00", "12:30", "15:00", "18:00", "19:30"].map((t, i) => `<span class="s-chip${i === 3 ? " on" : ""}" data-act="chip">${t}</span>`).join("")}</div>
        <div>${btn(opt("pay") ? "Записаться и оплатить" : "Записаться", "", "book")}</div>
      </div>`;

    const gallery = `<h2>Как у нас</h2>
      <div class="s-gal"><figure>${img(1)}</figure><figure>${img(2)}</figure><div class="s-gal__note">${esc(n.stats[0][0])} — ${esc(n.stats[0][1])}</div></div>`;

    const stats = `<div class="s-stats">${n.stats.map(([a, b]) => `<div class="s-stat"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>`;

    const reviews = `<h2>Отзывы</h2><div class="s-revs">${n.reviews.map(([who, t]) => `
      <div class="s-rev"><span class="s-stars">★★★★★</span><p>«${esc(t)}»</p><span class="s-who"><i class="s-ava">${esc(initial(who))}</i>${esc(who)}</span></div>`).join("")}</div>`;

    const team = `<h2>Команда</h2><div class="s-team">${n.team.map(([who, role]) => `
      <div class="s-person"><i>${esc(initial(who))}</i><b>${esc(who)}</b><span>${esc(role)}</span></div>`).join("")}</div>`;

    const faq = `<h2>Вопросы и ответы</h2><div class="s-faq">${n.faq.map(([qq, a], i) => `
      <details${i === 0 ? " open" : ""}><summary>${esc(qq)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;

    const shop = shopHTML(mode);

    const contacts = `<h2>Как нас найти</h2>
      <div class="s-contacts">
        <div class="s-map" aria-hidden="true"><i class="s-ping"></i><i class="s-pin"></i></div>
        <div class="s-info">
          <p><small>Адрес</small><b>ул. Примерная, 37</b></p>
          <p><small>Часы работы</small><b>ежедневно, 9:00–21:00</b></p>
          <p><small>Телефон</small><b>+7 900 000-00-37</b></p>
          <div class="s-socials"><span>Telegram</span><span>ВКонтакте</span><span>WhatsApp</span></div>
        </div>
      </div>`;

    const form = `<div class="s-form">
        <div><h2>Оставьте заявку</h2><p class="s-note">${opt("tg") ? "Заявка придёт владельцу в <b>Telegram за секунду</b> — перезвонят быстро." : "Перезвоним в течение 15 минут."}</p></div>
        <div class="s-fields">
          <div class="s-input">Ваше имя</div><div class="s-input">+7 (___) ___-__-__</div>
          ${btn("Отправить заявку", "", "submit")}
          <span class="s-note">Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности</span>
        </div>
      </div>`;

    const foot = `<footer class="s-foot"><span>© ${new Date().getFullYear()} <b data-name>${esc(name)}</b></span><span>${opt("bot") ? "Цены и фото обновляются через Telegram-бота · " : ""}Сайт собран в конфигураторе ALMES37</span></footer>`;

    return `
      <div class="site T-${S.theme} L-${th.layout}${opt("motion") ? " is-motion" : ""}">
        <div class="s-try${S.fitting ? " is-fitting" : ""}">${emo("🪄")} Примерка от Ивана — так мог бы выглядеть ваш сайт</div>
        ${nav}${hero}
        ${blk("services", has("services"), services)}
        ${blk("booking", opt("booking"), booking, true)}
        ${blk("gallery", has("gallery"), gallery)}
        ${blk("stats", has("stats"), stats, true)}
        ${blk("shop", has("shop"), shop)}
        ${blk("reviews", has("reviews"), reviews, true)}
        ${blk("team", has("team"), team)}
        ${blk("faq", has("faq"), faq)}
        ${blk("contacts", has("contacts"), contacts, true)}
        ${blk("form", has("form"), form)}
        ${foot}
      </div>`;
  }

  function applyTheme() {
    const th = theme(), v = th.v;
    const r = parseFloat(v.r);
    const vars = {
      "--bg": v.bg, "--bg2": v.bg2, "--fg": v.fg, "--muted": v.muted, "--acc": v.acc, "--acc2": v.acc2 || v.acc,
      "--accFg": v.accFg, "--line": v.line, "--r": v.r, "--btnr": r === 0 ? "0px" : r <= 6 ? "3px" : "999px",
      "--head": v.head, "--hw": v.hw, "--ht": v.ht, "--hcase": v.hcase,
    };
    for (const site of $$(".site")) for (const [k, val] of Object.entries(vars)) site.style.setProperty(k, val);
    el.stage.style.setProperty("--glow", v.acc);
    for (const d of Object.values(D)) {
      const st = d.rig.style;
      st.setProperty("--wall", th.wall);
      st.setProperty("--site-bg", v.bg);
      st.setProperty("--acc", v.acc);
      st.setProperty("--acc-fg", v.accFg);
      st.setProperty("--status-fg", th.dark ? "#fff" : "#000");
      st.setProperty("--status-bg", th.dark ? "#000" : "#fff");
    }
    sizeHeading();
  }

  function sizeHeading() {
    const len = shownName().length;
    const wide = theme().v.hcase === "uppercase" ? 10 : 13;
    const k = Math.max(0.42, Math.min(1, wide / Math.max(len, 1))).toFixed(3);
    $$(".site").forEach((s) => s.style.setProperty("--h1s", k));
  }

  function renderSite(keepScroll = true) {
    for (const [mode, d] of Object.entries(D)) {
      const top = d.webview.scrollTop;
      d.webview.innerHTML = siteHTML(mode); // id градиентов у каждого устройства свои
      if (keepScroll) d.webview.scrollTop = top;
    }
    applyTheme();
    setupReveal();
    setup3D();
  }

  // Сцена, которую пролистали, ставится на паузу — анимации не тратят батарею впустую.
  function setup3D() {
    for (const d of Object.values(D)) {
      d.obs3d?.disconnect();
      const stages = $$(".s-3d:not(.s-3d--mini)", d.webview);
      if (!stages.length) continue;
      d.obs3d = new IntersectionObserver((entries) => {
        for (const e of entries) e.target.classList.toggle("is-paused", !e.isIntersecting);
      }, { root: d.webview });
      stages.forEach((st) => d.obs3d.observe(st));
    }
  }
  function refreshStage(extra) {
    for (const [mode, d] of Object.entries(D)) {
      const old = $(".s-hero .s-3d", d.webview);
      if (!old) continue;
      const touched = old.classList.contains("is-touched");
      old.outerHTML = stageHTML(mode, extra);
      if (touched) $(".s-hero .s-3d", d.webview).classList.add("is-touched");
    }
    setup3D();
  }
  function refreshShop() {
    for (const [mode, d] of Object.entries(D)) {
      const box = $('.blk[data-b="shop"] .rv', d.webview);
      if (box) box.innerHTML = shopHTML(mode);
    }
    setup3D();
  }

  // Анимации, которые крутятся по кругу (шестерёнки, полосы), на секунду разгоняем — без рывка.
  function boost(stg) {
    const anims = stg.getAnimations({ subtree: true })
      .filter((a) => a.effect?.getComputedTiming().iterations === Infinity && !a.effect.target?.classList?.contains("p3d__sw"));
    const t0 = performance.now(), dur = 1500;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const rate = 1 + 5 * (p < 0.2 ? p / 0.2 : (1 - (p - 0.2) / 0.8) ** 2);
      for (const a of anims) a.playbackRate = p < 1 ? rate : 1;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function pokeStage(stg) {
    stg.classList.add("is-touched");
    const k = stg.dataset.scene;
    if (k === "kids") {
      const bl = $$(".bl", stg);
      S3.pop = (S3.pop + 1) % bl.length;
      restart(bl[S3.pop], "is-pop");
      return;
    }
    if (k === "realty") {
      S3.lit = !S3.lit;
      for (const d of Object.values(D)) $(".s-hero .s-3d", d.webview)?.classList.toggle("is-lit", S3.lit);
      return;
    }
    if (["auto", "barber", "beauty", "photo"].includes(k)) boost(stg);
    restart(stg, "is-poke");
  }
  let carTimer = 0;
  function switchCar(dir) {
    const from = S3.car, n = P3D.CARS.length;
    S3.car = (S3.car + dir + n) % n;
    clearTimeout(carTimer);
    refreshStage({ from, dir });
    carTimer = setTimeout(() => refreshStage(), 1300); // после въезда убираем уехавшую машину из разметки
  }
  function setPaint(k) {
    const p = P3D.PAINTS.find((x) => x.k === k);
    if (!p) return;
    S3.paint = k;
    for (const d of Object.values(D)) {
      const stg = $(".s-hero .s-3d", d.webview);
      if (!stg) continue;
      stg.style.setProperty("--paint", p.c);
      $$(".s3d-dot", stg).forEach((b) => b.classList.toggle("on", b.dataset.v === k));
      const nm = $(".s3d-paint__name", stg);
      if (nm) nm.textContent = p.t;
    }
  }
  // Прокрутить сайт внутри устройства до нужного места (устройство уменьшено, поэтому делим на масштаб).
  function revealIn(wv, node) {
    const k = wv.getBoundingClientRect().height / wv.clientHeight || 1;
    const nav = $(".s-nav", wv);
    const top = wv.scrollTop + (node.getBoundingClientRect().top - wv.getBoundingClientRect().top) / k - (nav ? nav.offsetHeight : 0) - 10;
    wv.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }

  function setupReveal() {
    for (const d of Object.values(D)) {
      d.observer?.disconnect();
      if (!S.opts.has("motion") || reduced) continue;
      const obs = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
      }, { root: d.webview, threshold: 0.12 });
      $$(".rv", d.webview).forEach((n) => obs.observe(n));
      d.observer = obs;
    }
  }

  // Плавная смена содержимого экрана через View Transitions: перекраска «волной», смена ниши — шторкой.
  function screenTransition(kind, fn) {
    const d = active();
    if (!document.startViewTransition || reduced || document.hidden) { fn(); return; }
    document.documentElement.dataset.vt = kind;
    d.webview.style.viewTransitionName = "scr";
    const vt = document.startViewTransition(fn);
    vt.finished.finally(() => {
      d.webview.style.viewTransitionName = "";
      delete document.documentElement.dataset.vt;
    });
  }

  function updateNameEverywhere() {
    const name = shownName();
    $$(".webview [data-name]").forEach((n) => (n.textContent = name));
    $$(".webview [data-initial]").forEach((n) => (n.textContent = initial(name)));
    $$("[data-domain]").forEach((n) => (n.textContent = domain(name)));
    $$("[data-tabtitle]").forEach((n) => (n.textContent = name));
    $$("[data-fav]").forEach((n) => (n.textContent = initial(name)));
    sizeHeading();
    document.title = S.fitting ? `${name} — примерка сайта` : "Конфигуратор сайта — ALMES37";
  }

  function scrollToBlock(key) {
    for (const d of Object.values(D)) {
      const b = $(`.blk[data-b="${key}"]`, d.webview);
      if (!b) continue;
      restart(b, "flash");
      const nav = $(".s-nav", d.webview);
      setTimeout(() => {
        d.webview.scrollTo({ top: b.offsetTop - (nav ? nav.offsetHeight : 0), behavior: reduced || d !== active() ? "auto" : "smooth" });
      }, 80);
    }
  }

  /* ---------------- элементы управления ---------------- */
  function radio(btn, on) { btn.classList.toggle("is-on", on); btn.setAttribute("aria-checked", on); }

  // Схемы моделей: рамка страницы и блоки внутри (--j — очередь появления).
  const FRAME = `<rect class="fr" x="1" y="1" width="38" height="46" rx="6"/>`;
  const SCHEME = {
    card: FRAME + `<circle class="p p--c" cx="20" cy="15" r="6" style="--j:0"/><rect class="p" x="10" y="25" width="20" height="3.5" rx="1.75" style="--j:1"/><rect class="p" x="13" y="31" width="14" height="3" rx="1.5" style="--j:2"/><rect class="p" x="11" y="37.5" width="18" height="5" rx="2.5" style="--j:3"/>`,
    landing: FRAME + `<rect class="p" x="6" y="6" width="28" height="13" rx="2.5" style="--j:0"/><rect class="p" x="6" y="22.5" width="28" height="4" rx="2" style="--j:1"/><rect class="p" x="6" y="29.5" width="19" height="4" rx="2" style="--j:2"/><rect class="p" x="6" y="36.5" width="28" height="5.5" rx="2" style="--j:3"/>`,
    shop: FRAME + `<rect class="p" x="6" y="6" width="28" height="4" rx="2" style="--j:0"/><rect class="p" x="6" y="13.5" width="13" height="13" rx="2.5" style="--j:1"/><rect class="p" x="21" y="13.5" width="13" height="13" rx="2.5" style="--j:2"/><rect class="p" x="6" y="29" width="13" height="13" rx="2.5" style="--j:3"/><rect class="p" x="21" y="29" width="13" height="13" rx="2.5" style="--j:4"/>`,
    big: `<rect class="fr" x="10" y="1" width="29" height="37" rx="5"/><rect class="fr" x="5.5" y="5.5" width="29" height="37" rx="5"/><rect class="fr" x="1" y="10" width="29" height="37" rx="5"/><rect class="p" x="5" y="14.5" width="21" height="9" rx="2" style="--j:0"/><rect class="p" x="5" y="26.5" width="21" height="3.5" rx="1.75" style="--j:1"/><rect class="p" x="5" y="32.5" width="14" height="3.5" rx="1.75" style="--j:2"/><rect class="p" x="5" y="38.5" width="21" height="4.5" rx="2" style="--j:3"/>`,
  };

  function buildControls() {
    el.niches.innerHTML = Object.entries(NICHES).map(([k, n], i) =>
      `<button type="button" class="tile" role="radio" data-k="${k}" style="--i:${i}"><i>${noto(n.emoji)}</i>${esc(n.title)}</button>`).join("");
    el.models.innerHTML = Object.entries(MODELS).map(([k, m], i) =>
      `<button type="button" class="card" role="radio" data-k="${k}" style="--i:${i}"><span class="mdl" aria-hidden="true"><svg viewBox="0 0 40 48">${SCHEME[k] || FRAME}</svg></span><b>${esc(m.title)}</b><small>${esc(m.note)}</small><em>${m.days}–${m.max} ${plural(m.max, ["день", "дня", "дней"])}</em></button>`).join("");
    el.themes.innerHTML = Object.entries(THEMES).map(([k, t], i) =>
      `<button type="button" class="sw" role="radio" data-k="${k}" style="--i:${i}" aria-label="${esc(t.title)}"><i style="background:linear-gradient(135deg, ${t.sw[0]} 50%, ${t.sw[1]} 50%)"></i>${esc(t.title)}</button>`).join("");
    const tick = `<svg viewBox="0 0 12 12"><path d="m2.5 6.3 2.4 2.4 4.6-5" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>`;
    el.blocks.innerHTML = Object.entries(BLOCKS).map(([k, b], i) =>
      `<button type="button" class="chk" role="switch" data-k="${k}" style="--i:${i}"><span class="chk__box">${tick}</span><b>${esc(b.title)}</b><small>${esc(b.note)}</small></button>`).join("");
    el.options.innerHTML = Object.entries(OPTIONS).map(([k, o], i) =>
      `<button type="button" class="opt" role="switch" data-k="${k}" style="--i:${i}"><span class="opt__ico">${noto(o.icon)}</span><b>${esc(o.title)}</b><small>${esc(o.note)}</small><span class="switch" aria-hidden="true"></span></button>`).join("");
  }

  /* ---------------- бегунок выбора: рамка переезжает к выбранной плитке ---------------- */
  const gliders = [];
  function addGlider(box, pick) {
    const g = document.createElement("span");
    g.className = "glider";
    g.setAttribute("aria-hidden", "true");
    box.append(g);
    gliders.push({ g, pick });
  }
  function glide(animate = true) {
    for (const { g, pick } of gliders) {
      const t = pick();
      if (!t) continue;
      const geo = `${t.offsetLeft},${t.offsetTop},${t.offsetWidth},${t.offsetHeight}`;
      if (g.dataset.geo === geo) continue;
      const smooth = animate && !!g.dataset.geo; // первый раз — сразу на место, без полёта из угла
      g.dataset.geo = geo;
      if (!smooth) g.classList.add("no-tr");
      g.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop}px)`;
      g.style.width = `${t.offsetWidth}px`;
      g.style.height = `${t.offsetHeight}px`;
      if (!smooth) { void g.offsetWidth; g.classList.remove("no-tr"); }
    }
  }
  // Ниши на телефоне листаются вбок — выбранную подвигаем к центру.
  function centerInScroller(box, item, smooth = true) {
    if (!item || box.scrollWidth <= box.clientWidth + 1) return;
    box.scrollTo({ left: item.offsetLeft - (box.clientWidth - item.offsetWidth) / 2, behavior: smooth && !reduced ? "smooth" : "auto" });
  }

  function syncControls() {
    $$(".tile", el.niches).forEach((b) => radio(b, b.dataset.k === S.niche));
    $$(".card", el.models).forEach((b) => radio(b, b.dataset.k === S.model));
    $$(".sw", el.themes).forEach((b) => radio(b, b.dataset.k === S.theme));
    $$(".chk", el.blocks).forEach((b) => radio(b, S.blocks.has(b.dataset.k)));
    $$(".opt", el.options).forEach((b) => radio(b, S.opts.has(b.dataset.k)));
    glide();
    if (el.themeName.textContent !== theme().title) {
      el.themeName.textContent = theme().title;
      restart(el.themeName, "fade-up");
    }
    el.name.placeholder = `Например, ${niche().name}`;
  }

  /* ---------------- итог, ссылки, нижняя панель ---------------- */
  function shareURL() {
    const p = new URLSearchParams();
    p.set("n", shownName());
    p.set("t", S.niche); p.set("m", S.model); p.set("s", S.theme);
    p.set("b", [...S.blocks].join(","));
    p.set("o", [...S.opts].join(","));
    return `${location.origin}${location.pathname}?${p}`;
  }

  function specRows() {
    const blocks = Object.keys(BLOCKS).filter((k) => S.blocks.has(k)).map((k) => BLOCKS[k].title);
    const opts = Object.keys(OPTIONS).filter((k) => S.opts.has(k)).map((k) => OPTIONS[k].title);
    return [
      ["Бизнес", shownName()],
      ["Ниша", niche().title],
      ["Модель", MODELS[S.model].title],
      ["Стиль", theme().title],
      ["Блоки", blocks.join(", ") || "—"],
      ["Опции", opts.join(", ") || "без опций"],
    ];
  }

  // Срок «перещёлкивается», как цифры на табло.
  let shownDays = 0, daysRaf = 0;
  function animateDays(to) {
    cancelAnimationFrame(daysRaf);
    const from = shownDays || to;
    if (reduced || from === to) { shownDays = to; el.dockDays.textContent = daysWord(to); return; }
    const t0 = performance.now(), dur = 520;
    const stepFn = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - p) ** 3;
      const v = Math.round(from + (to - from) * e);
      el.dockDays.textContent = daysWord(v);
      if (p < 1) daysRaf = requestAnimationFrame(stepFn);
      else shownDays = to;
    };
    daysRaf = requestAnimationFrame(stepFn);
    restart(el.dockDays, "bump");
  }

  function updateSummary() {
    const d = totalDays();
    const rows = specRows();
    el.summary.innerHTML = rows.map(([a, b]) => `<div class="sum__row"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join("")
      + `<div class="sum__row sum__row--total"><span>Срок сборки</span><span>${daysWord(d)}</span></div>`;
    el.dockName.textContent = shownName();
    el.dockMeta.textContent = `${MODELS[S.model].title} · ${theme().title} · ${S.blocks.size} ${plural(S.blocks.size, ["блок", "блока", "блоков"])}`;
    animateDays(d);

    const text = "Привет, Иван! Собрал сайт в конфигураторе 👇\n"
      + rows.map(([a, b]) => `${a}: ${b}`).join("\n")
      + `\nСрок: ${daysWord(d)}\n\nПосмотреть: ${shareURL()}`;
    const href = "https://t.me/ALMES37?text=" + encodeURIComponent(text);
    el.send.href = href;
    el.dockSend.href = href;
    history.replaceState(null, "", S.fitting || S.name ? shareURL() : location.pathname);
  }

  /* ---------------- смена всего ---------------- */
  function update({ site = true } = {}) {
    syncControls();
    if (site) renderSite();
    updateNameEverywhere();
    updateSummary();
  }

  el.name.addEventListener("input", () => {
    S.name = cleanName(el.name.value);
    updateNameEverywhere();
    updateSummary();
  });

  const popTile = (b) => restart(b, "is-pop");

  // Экран перекрашивается, когда капля краски долетает до устройства.
  let screenTimer = 0;
  function later(ms, fn) {
    clearTimeout(screenTimer);
    if (reduced) fn(); else screenTimer = setTimeout(fn, ms);
  }

  // Сборка под нишу: модель, блоки, опции и стиль. «Анимации и 3D» остаются как были.
  function applyPreset(k) {
    const p = PRESETS?.[k];
    if (!p) return;
    S.model = p.model;
    S.blocks = new Set(p.blocks);
    S.opts = new Set([...p.opts, ...(S.opts.has("motion") ? ["motion"] : [])]);
    if (!S.themeTouched && p.theme) S.theme = p.theme;
    S3.prod = null;
    S3.pop = -1;
  }

  el.niches.addEventListener("click", (e) => {
    const b = e.target.closest(".tile"); if (!b || b.dataset.k === S.niche) return;
    const before = totalDays();
    popTile(b);
    S.niche = b.dataset.k; S.cart = 0;
    applyPreset(S.niche);
    syncControls(); updateSummary();
    floatTag(b, totalDays() - before);
    centerInScroller(el.niches, b);
    playEmoji($(".em", b), niche().emoji);
    later(0, () => screenTransition("niche", () => { update(); for (const d of Object.values(D)) d.webview.scrollTop = 0; }));
    island(niche().emoji, `${shownName()} · ${MODELS[S.model].title}`, "●");
  });
  el.models.addEventListener("click", (e) => {
    const b = e.target.closest(".card"); if (!b || b.dataset.k === S.model) return;
    const before = totalDays();
    popTile(b);
    S.model = b.dataset.k;
    S.blocks = new Set(MODELS[S.model].blocks);
    update();
    floatTag(b, totalDays() - before);
    island("🧩", `${MODELS[S.model].title}: ${daysWord(totalDays()).slice(1)}`, "●");
  });
  el.themes.addEventListener("click", (e) => {
    const b = e.target.closest(".sw"); if (!b || b.dataset.k === S.theme) return;
    popTile(b);
    S.theme = b.dataset.k;
    S.themeTouched = true;
    syncControls(); updateSummary();
    const t = theme();
    el.stage.style.setProperty("--glow", t.v.acc);
    fly(`<i class="drop" style="background:linear-gradient(135deg, ${t.sw[0]} 50%, ${t.sw[1]} 50%)"></i>`,
      $("i", b).getBoundingClientRect(), screenPoint(0.92, 0.05), { dur: 520, color: t.v.acc });
    later(420, () => screenTransition("theme", () => update()));
    island("🎨", t.title, "●", 1800);
  });
  el.blocks.addEventListener("click", (e) => {
    const b = e.target.closest(".chk"); if (!b) return;
    const k = b.dataset.k, on = !S.blocks.has(k), before = totalDays();
    on ? S.blocks.add(k) : S.blocks.delete(k);
    for (const d of Object.values(D)) $(`.blk[data-b="${k}"]`, d.webview)?.classList.toggle("off", !on);
    if (k === "shop") renderSite(); // в меню появляется/исчезает корзина
    syncControls(); updateSummary();
    floatTag(b, totalDays() - before);
    if (on) scrollToBlock(k);
  });
  el.options.addEventListener("click", (e) => {
    const b = e.target.closest(".opt"); if (!b) return;
    const k = b.dataset.k, on = !S.opts.has(k), before = totalDays();
    on ? S.opts.add(k) : S.opts.delete(k);
    update();
    floatTag(b, totalDays() - before);
    if (!on) return;
    playEmoji($(".em", b), OPTIONS[k].icon);
    if (k === "tg") setTimeout(() => notify(niche().notify), 250);
    if (k === "booking") scrollToBlock("booking");
    if (k === "pay") { scrollToBlock(S.blocks.has("shop") ? "shop" : "booking"); island("💳", "Оплата картой и СБП", "✓"); }
    if (k === "motion") { for (const d of Object.values(D)) d.webview.scrollTo({ top: 0, behavior: "smooth" }); island("✨", "Сайт ожил", "✓"); }
    if (k === "lang") island("🌍", "RU / EN — в меню сайта", "✓");
    if (k === "bot") island("🤖", "Правки через Telegram-бота", "✓");
  });

  /* ---------------- клики внутри превью: всё «живое» ---------------- */
  function onSiteClick(e) {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    e.preventDefault();
    const wv = e.currentTarget;
    const act = t.dataset.act;
    if (act === "poke") {
      if (wv.swiped) { wv.swiped = false; return; }
      pokeStage(t);
    } else if (act === "car") {
      switchCar(+t.dataset.v);
    } else if (act === "paint") {
      setPaint(t.dataset.v);
    } else if (act === "prod") {
      S3.prod = +t.dataset.i;
      refreshShop();
      const panel = $(".s-prod", wv);
      if (panel) revealIn(wv, panel);
    } else if (act === "prodpoke") {
      restart(t, "is-open");
      t.classList.add("is-touched");
    } else if (act === "prodclose") {
      S3.prod = null;
      refreshShop();
    } else if (act === "chip") {
      $$(".s-chip", t.parentElement).forEach((c) => c.classList.toggle("on", c === t));
    } else if (act === "add") {
      S.cart++;
      for (const d of Object.values(D)) {
        const cart = $(".s-cart", d.webview);
        if (!cart) continue;
        cart.classList.add("has");
        $("b", cart).textContent = S.cart;
        if (d.webview === wv) restart(cart, "pop");
      }
      t.textContent = "✓ В корзине";
    } else if (act === "submit" || act === "book") {
      t.textContent = "Отправлено ✓";
      restart(t, "is-sent");
      if (S.opts.has("tg")) notify(niche().notify);
      else island("📨", "Заявка отправлена", "✓");
    } else if (act === "lang") {
      island("🌍", "Английская версия — в настоящем сайте", "✓");
    } else if (act === "cta") {
      scrollToBlock(S.opts.has("booking") ? "booking" : S.blocks.has("form") ? "form" : "contacts");
    } else if (act === "nav") {
      const order = ["services", "gallery", "reviews", "team", "contacts"].filter((k) => S.blocks.has(k));
      scrollToBlock(order[+t.dataset.i] || order[0] || "form");
    } else if (act === "top") {
      wv.scrollTo({ top: 0, behavior: "smooth" });
    } else if (act === "cart") {
      island("🛒", S.cart ? `В корзине: ${S.cart}` : "Корзина пока пуста", "●");
    }
  }
  for (const d of Object.values(D)) d.webview.addEventListener("click", onSiteClick);

  // Наклон сцены за мышью и свайп машин пальцем.
  for (const d of Object.values(D)) {
    const wv = d.webview;
    let raf = 0, last = null, sw = null;
    const tilt = () => {
      raf = 0;
      for (const stg of $$(".s-3d:not(.s-3d--mini)", wv)) {
        const inn = $(".p3d__in", stg);
        if (!inn) continue;
        if (!last || last.stg !== stg) { inn.style.removeProperty("--rx"); inn.style.removeProperty("--ry"); continue; }
        const r = stg.getBoundingClientRect();
        inn.style.setProperty("--ry", `${(((last.x - r.left) / r.width - 0.5) * 22).toFixed(2)}deg`);
        inn.style.setProperty("--rx", `${(-((last.y - r.top) / r.height - 0.5) * 14).toFixed(2)}deg`);
      }
    };
    wv.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || reduced) return;
      last = { x: e.clientX, y: e.clientY, stg: e.target.closest(".s-3d:not(.s-3d--mini)") };
      raf ||= requestAnimationFrame(tilt);
    });
    wv.addEventListener("pointerleave", () => { last = null; raf ||= requestAnimationFrame(tilt); });
    wv.addEventListener("pointerdown", (e) => {
      wv.swiped = false;
      sw = e.target.closest('.s-3d[data-scene="detailing"]') && !e.target.closest("button") ? { x: e.clientX, y: e.clientY } : null;
    });
    wv.addEventListener("pointerup", (e) => {
      if (!sw) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      sw = null;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.3) { wv.swiped = true; switchCar(dx > 0 ? 1 : -1); }
    });
  }

  /* ---------------- кнопки итога ---------------- */
  async function copyLink() {
    const url = shareURL();
    try { await navigator.clipboard.writeText(url); }
    catch {
      const ta = Object.assign(document.createElement("textarea"), { value: url });
      document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    toast("Ссылка скопирована — по ней откроется именно этот сайт");
  }
  el.copy.addEventListener("click", copyLink);
  for (const a of [el.send, el.dockSend]) a.addEventListener("click", () => { island("✈️", "Отправляю Ивану…", "✓", 2600); confetti(a); });
  D.mac.infobar?.addEventListener("click", (e) => {
    if (!e.target.closest("[data-close-info]")) return;
    D.mac.infobar.hidden = true; D.mac.rig.classList.remove("has-info");
  });

  /* ---------------- компьютер ⇄ телефон ---------------- */
  const seg = $(".seg");
  // Устройства собраны в реальных размерах — подбираем только масштаб под сцену.
  // На планшете и телефоне сцена компактная (сверху переключатель, снизу кнопка «На весь экран»).
  const SIZE = { mac: [1580, 960], phone: [450, 900] };
  const CY = { compact: 0, normal: 14 }; // то же смещение центра, что --cy в CSS
  const compactMQ = matchMedia("(max-width: 1100px)");
  let isFull = false;
  const compactNow = () => compactMQ.matches && !isFull;
  function kFor(r, compact) {
    const k = {};
    for (const [mode, [w, h]] of Object.entries(SIZE)) {
      // в компактном виде переключатель и кнопка стоят по углам: телефону — вся высота, ноутбуку — вся ширина
      const availW = r.width - (compact && mode === "phone" ? 120 : 32);
      const availH = r.height - (compact ? (mode === "phone" ? 24 : 100) : r.height < 560 ? 64 : 104);
      k[mode] = Math.max(0.12, Math.min(availW / w, availH / h, mode === "phone" ? 1 : 0.75));
    }
    return k;
  }
  // Ставит масштаб и сдвиг устройствам; instant — без анимации (для перелёта «из точки А»).
  function place(dx, dy, k, instant) {
    for (const [mode, d] of Object.entries(D)) {
      if (instant) d.pos.classList.add("no-tr");
      d.pos.style.setProperty("--fx", `${dx.toFixed(1)}px`);
      d.pos.style.setProperty("--fy", `${dy.toFixed(1)}px`);
      d.pos.style.setProperty("--k", k[mode].toFixed(4));
      if (instant) { void d.pos.offsetWidth; d.pos.classList.remove("no-tr"); }
    }
  }
  function sizeDevice() {
    const k = kFor(el.stage.getBoundingClientRect(), compactNow());
    for (const [mode, d] of Object.entries(D)) d.pos.style.setProperty("--k", k[mode].toFixed(4));
  }

  /* ---------------- превью на весь экран (планшет и телефон) ----------------
     Сцена раскрывается из своего места (clip-path), а устройство перелетает в центр и растёт. */
  const insetOf = (r, box, rad) => `inset(${r.top - box.top}px ${box.right - r.right}px ${box.bottom - r.bottom}px ${r.left - box.left}px round ${rad}px)`;
  function openFull() {
    if (isFull || !compactMQ.matches) return;
    const from = el.stage.getBoundingClientRect();
    const pr = active().pos.getBoundingClientRect();
    const k0 = {};
    for (const [mode, d] of Object.entries(D)) k0[mode] = parseFloat(d.pos.style.getPropertyValue("--k")) || 0.3;
    isFull = true;
    el.stageCol.classList.add("is-full");
    el.stage.classList.add("is-full");
    document.documentElement.classList.add("is-locked");
    const to = el.stage.getBoundingClientRect();
    const k1 = kFor(to, false);
    if (reduced) place(0, 0, k1, true);
    else {
      place(pr.left + pr.width / 2 - (to.left + to.width / 2), pr.top + pr.height / 2 - (to.top + to.height / 2 + CY.normal), k0, true);
      place(0, 0, k1, false);
      el.stage.animate([{ clipPath: insetOf(from, to, 24) }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 560, easing: EASE });
    }
    el.closeFull.focus({ preventScroll: true });
  }
  function closeFull(instant = false) {
    if (!isFull) return;
    const box = el.stage.getBoundingClientRect();
    const target = el.stageCol.getBoundingClientRect();
    const k1 = kFor(target, true);
    const finish = () => {
      isFull = false;
      el.stageCol.classList.remove("is-full");
      el.stage.classList.remove("is-full", "is-closing");
      document.documentElement.classList.remove("is-locked");
      place(0, 0, k1, true);
      sizeDevice();
    };
    if (instant || reduced) { finish(); return; }
    el.stage.classList.add("is-closing");
    place(target.left + target.width / 2 - (box.left + box.width / 2), target.top + target.height / 2 + CY.compact - (box.top + box.height / 2 + CY.normal), k1, false);
    const a = el.stage.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: insetOf(target, box, 24) }], { duration: 500, easing: EASE, fill: "forwards" });
    a.onfinish = () => { finish(); a.cancel(); };
    el.openFull.focus({ preventScroll: true });
  }
  el.closeFull.addEventListener("click", (e) => { e.stopPropagation(); closeFull(); });
  // В компактном виде тап по превью (или по кнопке) раскрывает его.
  el.stage.addEventListener("click", (e) => {
    if (compactNow() && !e.target.closest(".seg")) openFull();
  });
  compactMQ.addEventListener("change", () => { if (!compactMQ.matches) closeFull(true); sizeDevice(); });
  function setDevice(mode, announce = true) {
    const prev = S.device;
    S.device = mode;
    for (const [m, d] of Object.entries(D)) {
      d.pos.classList.toggle("is-active", m === mode);
      d.pos.classList.toggle("is-leaving", m === prev && m !== mode);
      d.pos.setAttribute("aria-hidden", m !== mode);
    }
    el.stage.dataset.device = mode;
    seg.classList.toggle("is-phone", mode === "phone");
    $$(".seg__btn", seg).forEach((b) => { const on = b.dataset.device === mode; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", on); });
    // синхронизируем прокрутку, чтобы на новом устройстве было то же место сайта
    const from = D[prev], to = D[mode];
    if (from && from !== to) {
      const ratio = from.webview.scrollTop / Math.max(1, from.webview.scrollHeight - from.webview.clientHeight);
      to.webview.scrollTop = ratio * (to.webview.scrollHeight - to.webview.clientHeight);
    }
    if (announce) setTimeout(() => island(niche().emoji, shownName(), "●", 2000), 450);
  }
  seg.addEventListener("click", (e) => { const b = e.target.closest(".seg__btn"); if (b && b.dataset.device !== S.device) setDevice(b.dataset.device); });
  new ResizeObserver(() => sizeDevice()).observe(el.stage);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isFull) { closeFull(); return; }
    if (e.target.closest("input, textarea")) return;
    if (e.key === "m" || e.key === "ь") setDevice("mac");
    if (e.key === "i" || e.key === "ш") setDevice("phone");
  });

  /* ---------------- поворот: перетаскивание + лёгкий наклон за курсором ----------------
     Пружина как в iOS: при отпускании скорость пальца переходит в движение. */
  const rot = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, drag: null, raf: 0 };
  const rubber = (v, max) => { const a = Math.abs(v); const r = (a * max * 0.55) / (max + 0.55 * a); return Math.sign(v) * Math.min(a, r * 1.8); };
  const applyRot = () => {
    const t = `rotateX(${rot.x.toFixed(2)}deg) rotateY(${rot.y.toFixed(2)}deg)`;
    for (const d of Object.values(D)) d.rig.style.transform = t;
  };
  function runSpring() {
    if (rot.raf) return;
    const T = 0.55, z = 0.62, k = (2 * Math.PI / T) ** 2, c = (4 * Math.PI * z) / T;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now;
      if (!rot.drag) {
        rot.vx += (-k * (rot.x - rot.tx) - c * rot.vx) * dt; rot.x += rot.vx * dt;
        rot.vy += (-k * (rot.y - rot.ty) - c * rot.vy) * dt; rot.y += rot.vy * dt;
      }
      applyRot();
      const moving = rot.drag || Math.abs(rot.x - rot.tx) + Math.abs(rot.y - rot.ty) + Math.abs(rot.vx) + Math.abs(rot.vy) > 0.02;
      rot.raf = moving ? requestAnimationFrame(step) : 0;
    };
    rot.raf = requestAnimationFrame(step);
  }

  el.stage.addEventListener("pointerdown", (e) => {
    if (reduced || compactNow() || e.button !== 0 || e.target.closest(".webview, .seg, button, a, input")) return;
    el.stage.setPointerCapture(e.pointerId);
    el.stage.classList.add("is-dragging");
    rot.drag = { x0: e.clientX, y0: e.clientY, bx: rot.x, by: rot.y, hist: [[e.clientX, e.clientY, performance.now()]] };
    runSpring();
  });
  el.stage.addEventListener("pointermove", (e) => {
    if (reduced) return;
    if (rot.drag) {
      const d = rot.drag;
      rot.y = rubber(d.by + (e.clientX - d.x0) * 0.22, 32);
      rot.x = rubber(d.bx - (e.clientY - d.y0) * 0.14, 16);
      d.hist.push([e.clientX, e.clientY, performance.now()]);
      if (d.hist.length > 5) d.hist.shift();
      return;
    }
    if (!canHover || e.target.closest(".webview")) { rot.tx = rot.ty = 0; runSpring(); return; }
    const r = el.stage.getBoundingClientRect();
    rot.ty = ((e.clientX - r.left) / r.width - 0.5) * 7;   // наклон за курсором — до 3,5°
    rot.tx = -((e.clientY - r.top) / r.height - 0.5) * 4;
    runSpring();
  });
  el.stage.addEventListener("pointerleave", () => { if (!rot.drag) { rot.tx = rot.ty = 0; runSpring(); } });
  const endDrag = () => {
    if (!rot.drag) return;
    const h = rot.drag.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b[2] - a[2]) / 1000;
    rot.vy = ((b[0] - a[0]) * 0.22) / dt;
    rot.vx = (-(b[1] - a[1]) * 0.14) / dt;
    rot.drag = null;
    rot.tx = rot.ty = 0;
    el.stage.classList.remove("is-dragging");
    el.hint.classList.add("is-gone");
    runSpring();
  };
  el.stage.addEventListener("pointerup", endDrag);
  el.stage.addEventListener("pointercancel", endDrag);

  /* ---------------- появление шагов при прокрутке страницы ---------------- */
  const pageObs = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); pageObs.unobserve(e.target); }
  }, { threshold: 0.15 });
  $$(".step").forEach((s) => pageObs.observe(s));

  // Терминал в итоге печатается, когда до него долистали.
  const termText = "> сборка завершена";
  const termObs = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    termObs.disconnect();
    if (reduced) return;
    let i = 0;
    el.term.innerHTML = '<span class="caret">_</span>';
    const typeNext = () => {
      i++;
      el.term.innerHTML = `${esc(termText.slice(0, i))}<span class="caret">_</span>`;
      if (i < termText.length) setTimeout(typeNext, 38 + Math.random() * 40);
      else setTimeout(() => confetti(el.send), 250); // сборка завершена — салют
    };
    setTimeout(typeNext, 300);
  }, { threshold: 0.6 });
  termObs.observe(el.term);

  // Плеер анимаций подгружаем в фоне, а саму анимацию — как только палец коснулся кнопки или мышь навелась.
  setTimeout(() => loadLottie().catch(() => {}), 3500);
  for (const box of [el.niches, el.options]) {
    const warm = (e) => {
      const b = e.target.closest(".tile, .opt");
      if (!b || reduced) return;
      loadLottie().catch(() => {});
      getAnim(b.classList.contains("tile") ? NICHES[b.dataset.k].emoji : OPTIONS[b.dataset.k].icon);
    };
    box.addEventListener("pointerdown", warm, { passive: true });
    box.addEventListener("pointerover", warm, { passive: true });
  }

  // Полоска над нижней панелью показывает, сколько шагов уже пролистано.
  let progRaf = 0;
  function progress() {
    progRaf = 0;
    const r = el.steps.getBoundingClientRect();
    const p = (innerHeight * 0.7 - r.top) / Math.max(1, r.height - innerHeight * 0.3);
    el.dock.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(3));
  }
  addEventListener("scroll", () => { progRaf ||= requestAnimationFrame(progress); }, { passive: true });

  /* ---------------- старт ---------------- */
  buildControls();
  addGlider(el.niches, () => $(".tile.is-on", el.niches));
  addGlider(el.models, () => $(".card.is-on", el.models));
  addGlider(el.themes, () => $(".sw.is-on i", el.themes));
  if (!["n", "t", "m", "s", "b", "o"].some((k) => q.has(k))) applyPreset(S.niche); // не примерка по ссылке — собираем под нишу
  el.name.value = S.name;
  sizeDevice();
  setDevice(S.device, false);
  update();
  glide(false);
  centerInScroller(el.niches, $(".tile.is-on", el.niches), false);
  progress();
  const boxObs = new ResizeObserver(() => glide(false));
  [el.niches, el.models, el.themes].forEach((b) => boxObs.observe(b));
  document.fonts?.ready.then(() => glide(false));
  requestAnimationFrame(() => document.body.classList.add("is-ready"));

  if (S.fitting) {
    $("#introNew").textContent = "Примерка";
    $("#introTitle").textContent = `Сайт для «${shownName()}».`;
    $("#introSub").textContent = "Иван собрал превью вашего будущего сайта. Поменяйте стиль, блоки и опции — и отправьте, если нравится.";
    if (D.mac.infobar) { D.mac.infobar.hidden = false; D.mac.rig.classList.add("has-info"); }
    setTimeout(() => island("🪄", `Сайт для «${shownName()}» готов`, "✓", 3200), 1100);
  } else {
    setTimeout(() => island("👋", "Соберите свой сайт", "●", 2600), 1300);
  }
})();
