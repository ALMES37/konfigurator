(() => {
  "use strict";
  const { NICHES, MODELS, THEMES, BLOCKS, OPTIONS } = window.CFG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const el = {
    stage: $("#stage"), hint: $("#hint"),
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
  const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  function totalDays() {
    const m = MODELS[S.model];
    let d = m.days;
    for (const b of S.blocks) if (!m.blocks.includes(b)) d += BLOCKS[b].days;
    for (const o of S.opts) d += OPTIONS[o].days;
    return d;
  }

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
    d.islandL.textContent = left;
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

  function siteHTML() {
    const n = niche(), th = theme(), name = shownName();
    const has = (b) => S.blocks.has(b);
    const opt = (o) => S.opts.has(o);
    const img = (i, eager) => `<img src="img/${S.niche}-${i}.webp" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async" onload="this.classList.add('is-loaded')">`;
    const blk = (key, on, inner, alt) =>
      `<div class="blk${on ? "" : " off"}" data-b="${key}"><div class="blk__in"><section class="s-sec${alt ? " s-sec--alt" : ""}"><div class="rv">${inner}</div></section></div></div>`;
    const btn = (text, cls = "", act = "cta") => `<button type="button" class="s-btn ${cls}" data-act="${act}">${esc(text)}</button>`;
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
      <header class="s-hero">
        <div class="s-hero__txt">
          <span class="s-kicker s-in" style="--d:0">${esc(n.kicker)}</span>
          <h1 class="s-in" style="--d:1" data-name>${esc(name)}</h1>
          <p class="s-lead s-in" style="--d:2">${esc(n.lead)}</p>
          <div class="s-cta s-in" style="--d:3">${btn(n.cta)}${pay}</div>
        </div>
        <figure>${img(0, true)}</figure>
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

    const shop = `<h2>${opt("pay") ? "Купить онлайн" : "Магазин"}<small>Корзина работает — попробуйте</small></h2>
      <div class="s-shop">${n.shop.map(([a, p, e]) => `
        <div class="s-item"><span class="s-item__pic">${e}</span><b>${esc(a)}</b><span>${esc(p)}</span>${btn("В корзину", "s-btn--sm", "add")}</div>`).join("")}</div>`;

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
        <div class="s-try${S.fitting ? " is-fitting" : ""}">🪄 Примерка от Ивана — так мог бы выглядеть ваш сайт</div>
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
    const html = siteHTML();
    for (const d of Object.values(D)) {
      const top = d.webview.scrollTop;
      d.webview.innerHTML = html;
      if (keepScroll) d.webview.scrollTop = top;
    }
    applyTheme();
    setupReveal();
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

  function buildControls() {
    el.niches.innerHTML = Object.entries(NICHES).map(([k, n], i) =>
      `<button type="button" class="tile" role="radio" data-k="${k}" style="--i:${i}"><i>${n.emoji}</i>${esc(n.title)}</button>`).join("");
    el.models.innerHTML = Object.entries(MODELS).map(([k, m], i) =>
      `<button type="button" class="card" role="radio" data-k="${k}" style="--i:${i}"><b>${esc(m.title)}</b><small>${esc(m.note)}</small><em>от ${daysWord(m.days).slice(1)}</em></button>`).join("");
    el.themes.innerHTML = Object.entries(THEMES).map(([k, t], i) =>
      `<button type="button" class="sw" role="radio" data-k="${k}" style="--i:${i}" aria-label="${esc(t.title)}"><i style="background:linear-gradient(135deg, ${t.sw[0]} 50%, ${t.sw[1]} 50%)"></i>${esc(t.title)}</button>`).join("");
    const tick = `<svg viewBox="0 0 12 12"><path d="m2.5 6.3 2.4 2.4 4.6-5" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>`;
    el.blocks.innerHTML = Object.entries(BLOCKS).map(([k, b], i) =>
      `<button type="button" class="chk" role="switch" data-k="${k}" style="--i:${i}"><span class="chk__box">${tick}</span><b>${esc(b.title)}</b><small>${esc(b.note)}</small></button>`).join("");
    el.options.innerHTML = Object.entries(OPTIONS).map(([k, o], i) =>
      `<button type="button" class="opt" role="switch" data-k="${k}" style="--i:${i}"><span class="opt__ico">${o.icon}</span><b>${esc(o.title)}</b><small>${esc(o.note)} +${daysWord(o.days).slice(1)}</small><span class="switch" aria-hidden="true"></span></button>`).join("");
  }

  function syncControls() {
    $$(".tile", el.niches).forEach((b) => radio(b, b.dataset.k === S.niche));
    $$(".card", el.models).forEach((b) => radio(b, b.dataset.k === S.model));
    $$(".sw", el.themes).forEach((b) => radio(b, b.dataset.k === S.theme));
    $$(".chk", el.blocks).forEach((b) => radio(b, S.blocks.has(b.dataset.k)));
    $$(".opt", el.options).forEach((b) => radio(b, S.opts.has(b.dataset.k)));
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

  el.niches.addEventListener("click", (e) => {
    const b = e.target.closest(".tile"); if (!b || b.dataset.k === S.niche) return;
    popTile(b);
    S.niche = b.dataset.k; S.cart = 0;
    screenTransition("niche", () => { update(); for (const d of Object.values(D)) d.webview.scrollTop = 0; });
    island(niche().emoji, `${shownName()} · ${niche().title}`, "●");
  });
  el.models.addEventListener("click", (e) => {
    const b = e.target.closest(".card"); if (!b || b.dataset.k === S.model) return;
    popTile(b);
    S.model = b.dataset.k;
    S.blocks = new Set(MODELS[S.model].blocks);
    update();
    island("🧩", `${MODELS[S.model].title}: ${daysWord(totalDays()).slice(1)}`, "●");
  });
  el.themes.addEventListener("click", (e) => {
    const b = e.target.closest(".sw"); if (!b || b.dataset.k === S.theme) return;
    popTile(b);
    S.theme = b.dataset.k;
    screenTransition("theme", () => update());
    island("🎨", theme().title, "●", 1800);
  });
  el.blocks.addEventListener("click", (e) => {
    const b = e.target.closest(".chk"); if (!b) return;
    const k = b.dataset.k, on = !S.blocks.has(k);
    on ? S.blocks.add(k) : S.blocks.delete(k);
    for (const d of Object.values(D)) $(`.blk[data-b="${k}"]`, d.webview)?.classList.toggle("off", !on);
    if (k === "shop") renderSite(); // в меню появляется/исчезает корзина
    syncControls(); updateSummary();
    if (on) scrollToBlock(k);
  });
  el.options.addEventListener("click", (e) => {
    const b = e.target.closest(".opt"); if (!b) return;
    const k = b.dataset.k, on = !S.opts.has(k);
    on ? S.opts.add(k) : S.opts.delete(k);
    update();
    if (!on) return;
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
    if (act === "chip") {
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
  for (const a of [el.send, el.dockSend]) a.addEventListener("click", () => island("✈️", "Отправляю Ивану…", "✓", 2600));
  D.mac.infobar?.addEventListener("click", (e) => {
    if (!e.target.closest("[data-close-info]")) return;
    D.mac.infobar.hidden = true; D.mac.rig.classList.remove("has-info");
  });

  /* ---------------- MacBook ⇄ iPhone ---------------- */
  const seg = $(".seg");
  // Устройства собраны в реальных размерах — подбираем только масштаб под сцену.
  const SIZE = { mac: [1580, 960], phone: [450, 900] };
  function sizeDevice() {
    const r = el.stage.getBoundingClientRect();
    const availW = r.width - 32;
    const availH = r.height - (r.height < 560 ? 64 : 104);
    for (const [mode, d] of Object.entries(D)) {
      const [w, h] = SIZE[mode];
      const k = Math.max(0.15, Math.min(availW / w, availH / h, mode === "phone" ? 1 : 0.75));
      d.pos.style.setProperty("--k", k.toFixed(4));
    }
  }
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
  new ResizeObserver(sizeDevice).observe(el.stage);
  addEventListener("keydown", (e) => {
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
    if (reduced || e.button !== 0 || e.target.closest(".webview, .seg, button, a, input")) return;
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
    };
    setTimeout(typeNext, 300);
  }, { threshold: 0.6 });
  termObs.observe(el.term);

  /* ---------------- старт ---------------- */
  buildControls();
  el.name.value = S.name;
  sizeDevice();
  setDevice(S.device, false);
  update();
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
