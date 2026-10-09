// Объёмные сцены для первого экрана сайта-превью (опция «Анимации и 3D»).
// Это не WebGL: рисунки на SVG с бликами и тенями, разложенные на слои по глубине.
// При наклоне слои смещаются по-разному — получается ощущение объёма, а нагрузка как у картинки.
// Двигаются только transform и opacity, поэтому всё плавно и на слабых телефонах.
window.P3D = (() => {
  "use strict";

  /* ---------------- цвета и градиенты ---------------- */
  const A = "var(--acc)";
  const P = "var(--paint)";
  const mix = (a, p, b) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
  const lite = (c, p) => mix(c, 100 - p, "#fff"); // p% к белому
  const dark = (c, p) => mix(c, 100 - p, "#000"); // p% к чёрному
  const stp = (o, c, a) => `<stop offset="${o}" style="stop-color:${c}${a != null ? `;stop-opacity:${a}` : ""}"/>`;
  const lg = (id, stops, x2 = 0, y2 = 1, x1 = 0, y1 = 0) =>
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.join("")}</linearGradient>`;
  const rg = (id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops.join("")}</radialGradient>`;
  // цилиндр: тень по краям, блик слева
  const cyl = (id, c, hi = 30) => lg(id, [stp(0, dark(c, 38)), stp(0.18, c), stp(0.32, lite(c, hi)), stp(0.5, c), stp(0.82, dark(c, 16)), stp(1, dark(c, 42))], 1, 0);
  const shadowDef = (u) => rg(`${u}-sh`, [stp(0, "#000", 0.4), stp(0.55, "#000", 0.15), stp(1, "#000", 0)]);
  const shadow = (u, cx, cy, rx, ry, cls = "") => `<ellipse${cls ? ` class="${cls}"` : ""} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${u}-sh)"/>`;
  // слой сцены: z — глубина (чем больше, тем ближе к зрителю и сильнее смещается при наклоне)
  const L = (z, body, cls = "") => `<svg class="l${cls ? ` ${cls}` : ""}" style="--z:${z}" viewBox="0 0 400 400" aria-hidden="true">${body}</svg>`;
  const star = (x, y, s, cls = "tw", d = 0) =>
    `<path class="${cls}" style="--d:${d}" d="M${x} ${y - s} C${x + s * 0.12} ${y - s * 0.12} ${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y} C${x + s * 0.12} ${y + s * 0.12} ${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s} C${x - s * 0.12} ${y + s * 0.12} ${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y} C${x - s * 0.12} ${y - s * 0.12} ${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s}Z" fill="#fff"/>`;
  const f1 = (n) => +n.toFixed(1);

  /* ---------------- детейлинг: машины ----------------
     Вид сбоку, нос справа. Колёса стоят на земле y=184, слой сдвигаем вниз на 106. */
  const CARS = [
    {
      k: "sedan", t: "Седан", wy: 156, r: 26, wheels: [96, 300],
      top: "M44 165C36 165 33 160 33 152C32 140 34 126 46 121L94 112C106 110 114 106 122 100L152 79C158 74 164 72 172 72L236 72C248 72 256 75 264 82L296 106C301 109 306 110 314 111L352 116C366 118 373 126 372 138L372 156C371 162 366 165 358 165",
      glass: "M130 104L156 83C160 79 165 78 171 78L234 78C244 78 251 81 258 87L286 107Z",
      pillar: "M204 78L212 78L210 107L200 107Z",
      lines: "M206 108L204 162M134 108C134 126 130 146 128 162M282 110C284 126 282 146 278 162",
      belt: "M58 118L130 109L286 109L350 117",
      head: "M352 119C362 120 368 124 370 130L350 130C346 126 346 121 352 119Z",
      tail: "M37 126C39 121 45 119 53 118L55 128L37 131Z",
      mirror: "M270 98C276 96 282 98 284 104L272 106Z",
    },
    {
      k: "coupe", t: "Купе", wy: 156, r: 26, wheels: [102, 302],
      top: "M48 165C40 165 37 160 37 152C36 138 40 126 54 119C80 110 112 98 142 82C172 66 212 62 238 66C260 70 278 84 294 100C302 107 314 111 332 114L356 118C368 120 374 128 373 140L372 156C371 162 366 165 358 165",
      glass: "M146 95C170 79 204 73 232 74C248 75 262 84 276 100Z",
      pillar: "",
      lines: "M226 100C228 120 226 144 222 162M140 100C140 118 136 144 134 162",
      belt: "M64 116C100 104 130 100 276 101L350 118",
      head: "M354 121C364 122 369 126 370 132L350 132C347 127 348 122 354 121Z",
      tail: "M41 128C43 122 49 119 59 118L59 128L41 131Z",
      mirror: "M272 96C278 94 284 96 286 102L274 104Z",
    },
    {
      k: "suv", t: "Кроссовер", wy: 154, r: 29, wheels: [100, 304],
      top: "M42 165C34 165 30 160 30 152L30 112C30 104 34 100 42 98L70 95L94 66C98 60 104 58 112 58L262 58C270 58 276 61 281 67L308 94L352 100C364 102 372 110 372 122L372 154C372 161 367 165 360 165",
      glass: "M102 92L118 70C121 66 125 64 130 64L258 64C264 64 268 66 272 70L296 92Z",
      pillar: "M188 64L196 64L196 92L188 92ZM112 70L118 70L114 92L104 92Z",
      lines: "M192 94L192 162M114 96C112 120 110 146 110 162M290 96C292 120 290 146 288 162",
      belt: "M40 99L104 94L298 94L350 101",
      head: "M350 104C362 105 368 110 370 118L346 118C342 112 344 106 350 104Z",
      tail: "M32 104C34 100 40 99 48 99L48 116L32 118Z",
      mirror: "M286 84C293 82 299 85 300 92L288 94Z",
    },
    {
      k: "sport", t: "Спорткар", wy: 157, r: 25, wheels: [104, 306],
      top: "M46 165C38 165 35 160 35 152C34 138 40 126 56 122L124 111C154 92 188 80 222 80C250 80 272 88 292 102L334 118C354 124 368 130 373 138L374 152C374 160 370 165 362 165",
      glass: "M146 108C170 92 196 85 222 85C244 85 262 92 276 104Z",
      pillar: "",
      lines: "M232 106C234 124 232 144 228 162M150 110L140 162",
      belt: "M60 122L146 110L278 106L340 121",
      head: "M340 122C354 126 364 130 368 136L344 134C338 130 336 125 340 122Z",
      tail: "M39 130C41 126 47 124 55 123L57 132L39 134Z",
      mirror: "M262 100C268 98 274 100 276 106L264 108Z",
    },
  ];
  // Низ кузова с арками: порог ниже центра колеса — машина «сидит», а не висит.
  for (const c of CARS) {
    const yb = 165, R = c.r + 5, dx = Math.sqrt(R * R - (yb - c.wy) ** 2);
    const [rw, fw] = c.wheels;
    c.body = `${c.top}L${f1(fw + dx)} ${yb}A${R} ${R} 0 1 0 ${f1(fw - dx)} ${yb}L${f1(rw + dx)} ${yb}A${R} ${R} 0 1 0 ${f1(rw - dx)} ${yb}Z`;
  }
  const PAINTS = [
    { k: "black", t: "Чёрный", c: "#16171b" },
    { k: "white", t: "Белый", c: "#eceef1" },
    { k: "burgundy", t: "Бургунди", c: "#6e1530" },
  ];

  function wheel(u, x, y, r) {
    const spokes = Array.from({ length: 5 }, (_, i) =>
      `<rect x="${x - r * 0.07}" y="${y - r * 0.66}" width="${r * 0.14}" height="${r * 0.62}" rx="${r * 0.06}" fill="url(#${u}-spoke)" transform="rotate(${i * 72} ${x} ${y})"/>`).join("");
    return `<g class="wh" style="transform-origin:${x}px ${y}px">
      <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${u}-tire)"/>
      <circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="url(#${u}-rim)"/>
      <path d="M${x - r * 0.5} ${y - r * 0.32}A${r * 0.6} ${r * 0.6} 0 0 1 ${x + r * 0.2} ${y - r * 0.56}" stroke="#e8312f" stroke-width="${r * 0.13}" fill="none" stroke-linecap="round" opacity=".9"/>
      ${spokes}
      <circle cx="${x}" cy="${y}" r="${r * 0.17}" fill="url(#${u}-hub)"/>
    </g>`;
  }
  function carSVG(u, c, cls) {
    return `<g class="car ${cls}">
      <defs><clipPath id="${u}-cl-${c.k}"><path d="${c.body}"/></clipPath></defs>
      ${c.wheels.map((x) => `<circle cx="${x}" cy="${c.wy}" r="${c.r + 4}" fill="#060607"/>`).join("")}
      <g class="car__body">
        <path d="${c.body}" fill="url(#${u}-paint)"/>
        <path d="${c.body}" fill="url(#${u}-pside)"/>
        <path d="${c.glass}" fill="url(#${u}-glass)"/>
        <path d="${c.glass}" fill="url(#${u}-ghi)"/>
        ${c.pillar ? `<path d="${c.pillar}" fill="url(#${u}-paint)"/>` : ""}
        <path d="${c.lines}" fill="none" stroke="#000" stroke-opacity=".32" stroke-width="1.3"/>
        <path d="${c.belt}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.6" stroke-linecap="round"/>
        <path d="${c.mirror}" fill="url(#${u}-paint)" stroke="#000" stroke-opacity=".25"/>
        <path class="car__head" d="${c.head}" fill="url(#${u}-head)"/>
        <path d="${c.tail}" fill="url(#${u}-tail)"/>
        <g clip-path="url(#${u}-cl-${c.k})"><g class="car__shine"><g class="car__shine-now"><rect x="-120" y="40" width="70" height="140" fill="url(#${u}-shine)" transform="skewX(-24)"/></g></g></g>
      </g>
      ${c.wheels.map((x) => wheel(u, x, c.wy, c.r)).join("")}
    </g>`;
  }

  /* ---------------- сцены ниш ---------------- */
  const SC = {};

  // Кофейня: кружка «вращается» — ручка уходит за кружку, рисунок проплывает по боку
  SC.coffee = (u, st) => {
    const handle = `<svg viewBox="0 0 40 90" preserveAspectRatio="none"><path d="M3 12C30 8 37 30 36 45C35 62 27 80 3 78" fill="none" style="stroke:url(#${u}-mh)" stroke-width="10" stroke-linecap="round"/></svg>`;
    const defs = shadowDef(u)
      + lg(`${u}-sau`, [stp(0, "#fff"), stp(1, "#d6dbe2")])
      + lg(`${u}-mh`, [stp(0, "var(--m-d)"), stp(0.45, "var(--m-l)"), stp(1, "var(--m-d)")], 1, 0);
    return {
      hint: "Нажмите на кружку",
      layers: L(0, `<defs>${defs}</defs>
          ${shadow(u, 200, 316, 158, 24)}
          <ellipse cx="200" cy="306" rx="130" ry="30" fill="#bfc6cf"/>
          <ellipse cx="200" cy="300" rx="130" ry="30" fill="url(#${u}-sau)"/>
          <ellipse cx="200" cy="300" rx="80" ry="16" fill="#000" fill-opacity=".07"/>
          ${shadow(u, 200, 298, 84, 12)}`)
        + `<div class="l mug" style="--z:34">
            <div class="mug__rot mug__rot--back"><i class="mug__h">${handle}</i></div>
            <div class="mug__body"><div class="mug__pr"><span data-initial>${st.initial}</span></div></div>
            <div class="mug__rot mug__rot--front"><i class="mug__h">${handle}</i></div>
            <div class="mug__top"><div class="mug__cof"><svg viewBox="0 0 40 36"><path d="M20 33C9 25 2 19 2 11C2 5 6 2 11 2C15 2 18 4 20 8C22 4 25 2 29 2C34 2 38 5 38 11C38 19 31 25 20 33Z" fill="#f4e6d4" fill-opacity=".92"/></svg></div></div>
          </div>
          <div class="l steam" style="--z:62"><i></i><i></i><i></i></div>`,
    };
  };

  // Барбершоп: классический столб, полосы бегут по спирали
  SC.barber = (u) => {
    const bands = Array.from({ length: 24 }, (_, i) => {
      const col = ["#d7263d", "#ffffff", "#1d4ed8", "#ffffff"][i % 4];
      return `<rect x="140" y="${40 + i * 15}" width="120" height="15.5" fill="${col}"/>`;
    }).join("");
    const defs = shadowDef(u)
      + lg(`${u}-chrome`, [stp(0, "#6b7078"), stp(0.25, "#f4f6f8"), stp(0.45, "#a9afb7"), stp(0.7, "#e6e9ec"), stp(1, "#5d626a")], 1, 0)
      + lg(`${u}-gl`, [stp(0, "#000", 0.42), stp(0.2, "#000", 0.05), stp(0.32, "#fff", 0.45), stp(0.4, "#fff", 0), stp(0.8, "#000", 0.1), stp(1, "#000", 0.45)], 1, 0)
      + `<clipPath id="${u}-pole"><rect x="164" y="104" width="72" height="196" rx="4"/></clipPath>`;
    return {
      hint: "Нажмите — раскрутится",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 214, 352, 70, 12)}
          <rect x="242" y="150" width="14" height="110" rx="5" fill="url(#${u}-chrome)" opacity=".8"/>`)
        + L(30, `<g clip-path="url(#${u}-pole)"><g class="pole-spin"><g class="pole-run"><g transform="skewY(-24) translate(0 60)">${bands}</g></g></g></g>
          <rect x="164" y="104" width="72" height="196" rx="4" fill="url(#${u}-gl)"/>
          <rect x="156" y="82" width="88" height="24" rx="8" fill="url(#${u}-chrome)"/>
          <ellipse cx="200" cy="70" rx="30" ry="22" fill="url(#${u}-chrome)"/>
          <ellipse cx="190" cy="62" rx="9" ry="6" fill="#fff" opacity=".7"/>
          <rect x="156" y="298" width="88" height="24" rx="8" fill="url(#${u}-chrome)"/>
          <path d="M178 322L222 322L214 344L186 344Z" fill="url(#${u}-chrome)"/>`)
        + L(56, star(118, 120, 9, "tw", 0) + star(290, 210, 7, "tw", 1) + star(132, 260, 6, "tw", 2)),
    };
  };

  // Автосервис: две шестерёнки в зацеплении, с толщиной
  function gearPath(cx, cy, ro, ri, n, hole) {
    const st = (Math.PI * 2) / n;
    let d = "";
    for (let i = 0; i < n; i++) {
      const a = i * st;
      const pts = [[ri, a - st * 0.5], [ri, a - st * 0.26], [ro, a - st * 0.14], [ro, a + st * 0.14], [ri, a + st * 0.26]];
      for (const [r, ang] of pts) d += `${d ? "L" : "M"}${f1(cx + r * Math.cos(ang))} ${f1(cy + r * Math.sin(ang))}`;
    }
    d += "Z";
    const h = (r, x = cx, y = cy) => `M${f1(x + r)} ${y}A${r} ${r} 0 1 0 ${f1(x - r)} ${y}A${r} ${r} 0 1 0 ${f1(x + r)} ${y}Z`;
    d += h(hole);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      d += h(ri * 0.17, f1(cx + Math.cos(a) * ri * 0.56), f1(cy + Math.sin(a) * ri * 0.56));
    }
    return d;
  }
  SC.auto = (u) => {
    const big = gearPath(168, 222, 98, 82, 14, 20), small = gearPath(282, 128, 62, 49, 9, 14);
    const defs = shadowDef(u)
      + lg(`${u}-g1`, [stp(0, lite(A, 35)), stp(0.5, A), stp(1, dark(A, 30))], 1, 1)
      + lg(`${u}-g2`, [stp(0, "#eef1f4"), stp(0.5, "#a7afb8"), stp(1, "#5f6670")], 1, 1);
    return {
      hint: "Нажмите — закрутятся",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 340, 150, 18)}`)
        + L(18, `<g class="gear g-big-s" style="transform-origin:174px 230px"><path d="${big}" transform="translate(6 8)" fill-rule="evenodd" style="fill:${dark(A, 55)}"/></g>
          <g class="gear g-small-s" style="transform-origin:287px 135px"><path d="${small}" transform="translate(5 7)" fill-rule="evenodd" style="fill:#3d434b"/></g>`)
        + L(34, `<g class="gear g-big" style="transform-origin:168px 222px"><path d="${big}" fill="url(#${u}-g1)" fill-rule="evenodd"/><circle cx="168" cy="222" r="30" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/></g>
          <g class="gear g-small" style="transform-origin:282px 128px"><path d="${small}" fill="url(#${u}-g2)" fill-rule="evenodd"/></g>
          <path d="M168 210l10.4 6v12L168 234l-10.4-6v-12Z" fill="#d7dbe0" stroke="#7d848d" stroke-width="2"/>`),
    };
  };

  // Детейлинг: машина на поворотном круге, кузов и цвет меняются
  SC.detailing = (u, st) => {
    const defs = shadowDef(u)
      + lg(`${u}-paint`, [stp(0, lite(P, 42)), stp(0.36, lite(P, 10)), stp(0.47, P), stp(0.52, dark(P, 22)), stp(0.82, dark(P, 8)), stp(1, dark(P, 48))])
      + lg(`${u}-pside`, [stp(0, "#000", 0.3), stp(0.16, "#000", 0), stp(0.84, "#000", 0), stp(1, "#000", 0.32)], 1, 0)
      + lg(`${u}-glass`, [stp(0, "#3b4859"), stp(1, "#0b0f15")])
      + lg(`${u}-ghi`, [stp(0, "#fff", 0), stp(0.45, "#fff", 0), stp(0.5, "#fff", 0.32), stp(0.62, "#fff", 0.06), stp(1, "#fff", 0)], 1, 0.4)
      + rg(`${u}-tire`, [stp(0.6, "#2a2b2f"), stp(0.9, "#121316"), stp(1, "#050506")])
      + lg(`${u}-rim`, [stp(0, "#f2f4f6"), stp(0.5, "#9aa2ac"), stp(1, "#4a5058")], 1, 1)
      + lg(`${u}-spoke`, [stp(0, "#fdfdfd"), stp(1, "#9aa2ac")], 1, 0)
      + rg(`${u}-hub`, [stp(0, "#ffffff"), stp(1, "#6c737c")])
      + rg(`${u}-head`, [stp(0, "#ffffff"), stp(0.7, "#dff0ff"), stp(1, "#9fc6e8")])
      + lg(`${u}-tail`, [stp(0, "#ff5a4f"), stp(1, "#7e0b12")])
      + lg(`${u}-shine`, [stp(0, "#fff", 0), stp(0.5, "#fff", 0.55), stp(1, "#fff", 0)], 1, 0)
      + rg(`${u}-disc`, [stp(0, mix("var(--fg)", 10, "var(--bg2)")), stp(1, mix("var(--fg)", 4, "var(--bg2)"))]);
    const cur = CARS[st.car] || CARS[0];
    let cars = carSVG(u, cur, st.from != null ? `car--in car--in-${st.dir > 0 ? "l" : "r"}` : "");
    if (st.from != null && CARS[st.from]) cars = carSVG(u, CARS[st.from], `car--out car--out-${st.dir > 0 ? "r" : "l"}`) + cars;
    const paint = PAINTS.find((p) => p.k === st.paint) || PAINTS[0];
    return {
      layers: L(0, `<defs>${defs}</defs>
          <ellipse cx="200" cy="300" rx="186" ry="34" style="fill:${mix("var(--fg)", 12, "var(--bg2)")}"/>
          <ellipse cx="200" cy="294" rx="186" ry="34" fill="url(#${u}-disc)"/>
          <ellipse cx="200" cy="294" rx="186" ry="34" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.5"/>
          ${shadow(u, 200, 292, 168, 16)}`)
        + L(30, `<g transform="translate(0 106)">${cars}</g>`)
        + L(58, star(96, 150, 8, "tw", 0) + star(318, 176, 10, "tw", 1) + star(250, 140, 6, "tw", 2)),
      ui: `<div class="s3d-ui s3d-car">
          <div class="s3d-car__nav">
            <button type="button" class="s3d-btn" data-act="car" data-v="-1" aria-label="Предыдущий кузов">‹</button>
            <span class="s3d-car__name"><b>${cur.t}</b><small>${st.car + 1} / ${CARS.length}</small></span>
            <button type="button" class="s3d-btn" data-act="car" data-v="1" aria-label="Следующий кузов">›</button>
          </div>
          <div class="s3d-paints">
            ${PAINTS.map((p) => `<button type="button" class="s3d-dot${p.k === paint.k ? " on" : ""}" data-act="paint" data-v="${p.k}" style="--c:${p.c}" aria-label="${p.t}"></button>`).join("")}
            <span class="s3d-paint__name">${paint.t}</span>
          </div>
        </div>`,
    };
  };

  // Салон красоты: помада выкручивается из золотого футляра
  SC.beauty = (u) => {
    const lip = mix(A, 35, "#c3123f");
    const defs = shadowDef(u) + cyl(`${u}-gold`, "#d6b06a", 45) + cyl(`${u}-gold2`, "#b8914c", 30) + cyl(`${u}-lip`, lip, 28) + cyl(`${u}-cap`, "#1d1e22", 25);
    return {
      hint: "Нажмите — выкрутится",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 334, 120, 15)}${shadow(u, 300, 334, 58, 10)}`)
        + L(22, `<g transform="rotate(8 300 330)"><rect x="268" y="150" width="64" height="180" rx="10" fill="url(#${u}-cap)"/><rect x="268" y="296" width="64" height="12" fill="url(#${u}-gold)"/><ellipse cx="300" cy="150" rx="32" ry="8" fill="#2c2d33"/></g>`)
        + L(36, `<g class="lip-up"><path d="M176 236L176 168C176 150 192 132 222 120C224 120 224 122 224 124L224 236Z" fill="url(#${u}-lip)"/>
            <path d="M182 168C186 152 200 140 216 132" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/></g>
          <rect x="170" y="214" width="60" height="44" rx="4" fill="url(#${u}-gold2)"/>
          <rect x="160" y="250" width="80" height="84" rx="8" fill="url(#${u}-gold)"/>
          <rect x="160" y="250" width="80" height="8" fill="#fff" opacity=".25"/>
          <ellipse cx="200" cy="334" rx="40" ry="6" fill="#8d6c33"/>`)
        + L(60, star(140, 150, 9, "tw", 0) + star(254, 108, 7, "tw", 1)),
    };
  };

  // Стоматология: блестящий зуб
  SC.dental = (u) => {
    const tooth = "M140 150C140 112 172 104 186 118C194 126 206 126 214 118C228 104 260 112 260 150C260 182 250 200 246 230C242 262 238 300 224 304C212 306 210 284 206 262C204 250 196 250 194 262C190 284 188 306 176 304C162 300 158 262 154 230C150 200 140 182 140 150Z";
    const defs = shadowDef(u)
      + rg(`${u}-tooth`, [stp(0, "#ffffff"), stp(0.55, "#f1f5f9"), stp(0.85, "#d5dee8"), stp(1, "#b9c7d6")], 0.4, 0.32, 0.75)
      + lg(`${u}-tsh`, [stp(0, "#fff", 0), stp(0.5, "#fff", 0.85), stp(1, "#fff", 0)], 1, 0)
      + `<clipPath id="${u}-tc"><path d="${tooth}"/></clipPath>`;
    return {
      hint: "Нажмите — заблестит",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 336, 92, 13, "sh-bob")}`)
        + L(32, `<g class="bob"><path d="${tooth}" transform="translate(5 7)" fill="#9fb0c2" opacity=".55"/>
            <path d="${tooth}" fill="url(#${u}-tooth)"/>
            <path d="M156 146C156 126 168 118 180 124" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".9"/>
            <g clip-path="url(#${u}-tc)"><g class="sweep"><rect x="60" y="80" width="50" height="260" fill="url(#${u}-tsh)" transform="skewX(-20)"/></g></g></g>`)
        + L(62, star(120, 120, 14, "tw", 0) + star(286, 150, 10, "tw", 1) + star(272, 270, 8, "tw", 2) + star(118, 250, 7, "tw", 3)),
    };
  };

  // Фитнес: гиря покачивается
  SC.fitness = (u) => {
    const defs = shadowDef(u)
      + rg(`${u}-kb`, [stp(0, lite(A, 30)), stp(0.45, dark(A, 15)), stp(1, dark(A, 60))], 0.36, 0.3, 0.8)
      + lg(`${u}-kbh`, [stp(0, dark(A, 50)), stp(0.4, lite(A, 10)), stp(1, dark(A, 55))], 1, 0);
    return {
      hint: "Нажмите — качнётся",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 334, 110, 15)}`)
        + L(34, `<g class="kb-kick" style="transform-origin:200px 112px"><g class="kb" style="transform-origin:200px 112px">
            <path d="M146 196C140 150 154 112 200 108C246 112 260 150 254 196" fill="none" stroke="url(#${u}-kbh)" stroke-width="26" stroke-linecap="round"/>
            <path d="M200 160C248 160 284 196 284 244C284 282 266 310 240 324L160 324C134 310 116 282 116 244C116 196 152 160 200 160Z" fill="url(#${u}-kb)"/>
            <ellipse cx="166" cy="206" rx="24" ry="14" fill="#fff" opacity=".22" transform="rotate(-30 166 206)"/>
            <rect x="170" y="246" width="60" height="38" rx="10" fill="#000" opacity=".22"/>
            <text x="200" y="274" text-anchor="middle" style="font:700 26px var(--head);fill:#fff;opacity:.9">16</text></g></g>`),
    };
  };

  // Ремонт: стенка складывается из кирпичей, валик красит
  SC.repair = (u) => {
    const defs = shadowDef(u) + lg(`${u}-br`, [stp(0, "#e0875f"), stp(1, "#a8502f")]) + cyl(`${u}-roll`, A, 35);
    let bricks = "", i = 0;
    for (let row = 0; row < 4; row++) {
      const odd = row % 2, y = 296 - row * 36;
      for (let c = 0; c < (odd ? 3 : 4); c++) {
        const x = (odd ? 98 : 63) + c * 70;
        bricks += `<g class="br" style="--i:${i++}"><rect x="${x}" y="${y}" width="64" height="30" rx="5" fill="url(#${u}-br)"/><rect x="${x + 4}" y="${y + 3}" width="56" height="5" rx="2.5" fill="#fff" opacity=".22"/></g>`;
      }
    }
    return {
      hint: "Нажмите — построим заново",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 336, 150, 15)}`)
        + L(24, `${bricks}<rect class="paint-band" x="98" y="188" width="204" height="30" rx="5" style="fill:${A}" opacity=".92"/>`)
        + L(52, `<g class="roller"><path d="M226 186L226 154L262 154L262 138" fill="none" stroke="#3a3f47" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="254" y="94" width="16" height="48" rx="7" fill="#2c3036"/>
            <rect x="196" y="184" width="60" height="34" rx="16" fill="url(#${u}-roll)"/></g>`),
    };
  };

  // Недвижимость: изометрический домик, окна загораются
  const iso = (x, y, z) => [200 + (x - y) * 62, 236 + (x + y) * 36 - z * 70];
  const poly = (pts, style) => `<polygon points="${pts.map((p) => iso(...p).map(f1).join(",")).join(" ")}" style="${style}"/>`;
  SC.realty = (u) => {
    const wallL = "#f3ece2", wallR = "#d9cfc1", roofL = A, roofR = dark(A, 25);
    const win = (pts) => poly(pts, "fill:var(--win, #8fb4d6)") ;
    const defs = shadowDef(u) + rg(`${u}-tree`, [stp(0, "#7bd389"), stp(1, "#2f7d45")], 0.35, 0.3, 0.75);
    const tree = (x, y, s = 1) => {
      const [cx, cy] = iso(x, y, 0);
      return `<g class="tree" style="transform-origin:${f1(cx)}px ${f1(cy)}px"><rect x="${f1(cx - 4 * s)}" y="${f1(cy - 34 * s)}" width="${8 * s}" height="${34 * s}" rx="3" fill="#7a5233"/>
        <circle cx="${f1(cx)}" cy="${f1(cy - 50 * s)}" r="${22 * s}" fill="url(#${u}-tree)"/><circle cx="${f1(cx + 6 * s)}" cy="${f1(cy - 72 * s)}" r="${15 * s}" fill="url(#${u}-tree)"/></g>`;
    };
    return {
      hint: "Нажмите — зажжём свет",
      layers: L(0, `<defs>${defs}</defs>
          <g class="cloud"><ellipse cx="96" cy="86" rx="34" ry="13" fill="#fff" opacity=".7"/><ellipse cx="116" cy="78" rx="22" ry="13" fill="#fff" opacity=".7"/></g>
          ${shadow(u, 200, 336, 170, 22)}
          ${poly([[1.7, -1.7, 0], [1.7, 1.7, 0], [1.7, 1.7, -0.28], [1.7, -1.7, -0.28]], "fill:#5c9a52")}
          ${poly([[-1.7, 1.7, 0], [1.7, 1.7, 0], [1.7, 1.7, -0.28], [-1.7, 1.7, -0.28]], "fill:#74b266")}
          ${poly([[-1.7, -1.7, 0], [1.7, -1.7, 0], [1.7, 1.7, 0], [-1.7, 1.7, 0]], "fill:#9ad48a")}
          ${poly([[-0.12, 0.62, 0.01], [0.22, 0.62, 0.01], [0.3, 1.7, 0.01], [-0.06, 1.7, 0.01]], "fill:#e8dcc8")}`)
        + L(30, `${poly([[-1.05, -0.72, 1.02], [1.05, -0.72, 1.02], [1.05, 0, 1.78], [-1.05, 0, 1.78]], `fill:${dark(A, 40)}`)}
          ${poly([[0.4, -0.38, 1.3], [0.62, -0.38, 1.3], [0.62, -0.38, 2.05], [0.4, -0.38, 2.05]], "fill:#b8aa99")}
          ${poly([[0.62, -0.38, 1.3], [0.62, -0.16, 1.3], [0.62, -0.16, 2.05], [0.62, -0.38, 2.05]], "fill:#9e9080")}
          ${poly([[0.4, -0.38, 2.05], [0.62, -0.38, 2.05], [0.62, -0.16, 2.05], [0.4, -0.16, 2.05]], "fill:#cfc2b2")}
          ${poly([[-0.95, 0.62, 0], [0.95, 0.62, 0], [0.95, 0.62, 1.1], [-0.95, 0.62, 1.1]], `fill:${wallL}`)}
          ${poly([[0.95, -0.62, 0], [0.95, 0.62, 0], [0.95, 0.62, 1.1], [0.95, 0, 1.72], [0.95, -0.62, 1.1]], `fill:${wallR}`)}
          ${poly([[-0.12, 0.621, 0], [0.22, 0.621, 0], [0.22, 0.621, 0.66], [-0.12, 0.621, 0.66]], `fill:${dark(A, 35)}`)}
          <g class="wins">${win([[-0.78, 0.621, 0.45], [-0.42, 0.621, 0.45], [-0.42, 0.621, 0.82], [-0.78, 0.621, 0.82]])}
          ${win([[0.42, 0.621, 0.45], [0.78, 0.621, 0.45], [0.78, 0.621, 0.82], [0.42, 0.621, 0.82]])}
          ${win([[0.951, -0.36, 0.45], [0.951, 0.22, 0.45], [0.951, 0.22, 0.82], [0.951, -0.36, 0.82]])}</g>
          ${poly([[-1.05, 0.74, 1.0], [1.05, 0.74, 1.0], [1.05, 0, 1.78], [-1.05, 0, 1.78]], `fill:${roofL}`)}
          ${poly([[1.05, 0.74, 1.0], [1.05, 0.74, 0.94], [1.05, 0, 1.72], [1.05, 0, 1.78]], `fill:${roofR}`)}
          <g class="smoke">${[0, 1, 2].map((k) => { const [x, y] = iso(0.51, -0.27, 2.1); return `<circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="#fff" opacity=".8" style="--d:${k}"/>`; }).join("")}</g>`)
        + L(46, tree(-1.25, 1.15, 1.05) + tree(1.3, -1.25, 0.9)),
    };
  };

  // Доставка еды: бургер собирается слоями
  SC.food = (u) => {
    const defs = shadowDef(u)
      + lg(`${u}-bun`, [stp(0, "#f6c26b"), stp(0.6, "#e0953a"), stp(1, "#b8691f")])
      + lg(`${u}-bunb`, [stp(0, "#e9a54b"), stp(1, "#b8691f")])
      + lg(`${u}-pat`, [stp(0, "#7a4026"), stp(1, "#3e1c0e")]);
    const seeds = [[170, 150, -20], [204, 136, 10], [236, 152, 30], [188, 172, -5], [224, 176, 15], [150, 178, -35], [258, 178, 40]]
      .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.4" fill="#fff6e0" transform="rotate(${r} ${x} ${y})"/>`).join("");
    return {
      hint: "Нажмите — соберём заново",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 334, 140, 16)}`)
        + L(32, `<g class="lay" style="--i:0"><path d="M108 290C108 314 140 326 200 326C260 326 292 314 292 290L292 284L108 284Z" fill="url(#${u}-bunb)"/><ellipse cx="200" cy="284" rx="92" ry="12" fill="#f7d29a"/></g>
          <g class="lay" style="--i:1"><path d="M98 262C98 250 130 244 200 244C270 244 302 250 302 262C306 276 280 286 200 286C120 286 94 276 98 262Z" fill="url(#${u}-pat)"/><path d="M118 256C150 250 250 250 282 256" stroke="#9a5a3a" stroke-width="3" fill="none" opacity=".6"/></g>
          <g class="lay" style="--i:2"><path d="M100 246L300 246L292 256L280 272L270 256L210 258L196 280L182 258L126 256L114 268Z" fill="#ffc533"/></g>
          <g class="lay" style="--i:3"><ellipse cx="150" cy="238" rx="44" ry="10" fill="#e8402f"/><ellipse cx="250" cy="238" rx="44" ry="10" fill="#d93626"/></g>
          <g class="lay" style="--i:4"><path d="M96 232C110 220 120 236 136 224C152 214 162 232 180 222C198 212 208 232 226 222C244 214 254 232 270 222C286 214 296 228 306 230C300 240 104 242 96 232Z" fill="#59b84a"/></g>
          <g class="lay lay--top" style="--i:5"><path d="M104 222C104 160 146 124 200 124C254 124 296 160 296 222C296 230 290 234 280 234L120 234C110 234 104 230 104 222Z" fill="url(#${u}-bun)"/>
            <path d="M134 172C146 150 166 138 190 134" stroke="#fff" stroke-opacity=".45" stroke-width="7" fill="none" stroke-linecap="round"/>${seeds}</g>`),
    };
  };

  // Детские праздники: связка шариков, нажатие лопает один
  SC.kids = (u, st) => {
    const cols = [A, "#ff5d8f", "#ffc93c", "#4cc9f0"];
    const B = [[146, 140, 46], [236, 112, 52], [272, 196, 44], [186, 206, 48]];
    const defs = shadowDef(u) + cols.map((c, i) => rg(`${u}-b${i}`, [stp(0, lite(c, 55)), stp(0.35, c), stp(1, dark(c, 35))], 0.36, 0.3, 0.75)).join("");
    const pop = st.pop ?? -1;
    return {
      hint: "Нажмите — лопнет шарик",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 210, 340, 70, 10)}`)
        + L(30, B.map(([x, y, r], i) => `<g class="bl${i === pop ? " is-pop" : ""}" style="--i:${i}">
            <path d="M${x} ${y + r * 1.18}C${x - 10} ${y + r * 1.18 + 40} ${x + 30} ${290 - 30} 210 330" fill="none" stroke="#8a8f99" stroke-width="1.6"/>
            <g class="bl__b" style="transform-origin:${x}px ${y}px"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.18}" fill="url(#${u}-b${i})"/>
            <path d="M${x - 6} ${y + r * 1.18 - 1}L${x + 6} ${y + r * 1.18 - 1}L${x} ${y + r * 1.18 + 9}Z" style="fill:${dark(cols[i], 20)}"/>
            <ellipse cx="${x - r * 0.38}" cy="${y - r * 0.46}" rx="${r * 0.16}" ry="${r * 0.26}" fill="#fff" opacity=".55" transform="rotate(-25 ${x - r * 0.38} ${y - r * 0.46})"/></g>
            <g class="bl__conf">${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" rx="1.5" style="fill:${cols[(k + i) % 4]};--a:${k * 60}deg"/>`).join("")}</g></g>`).join(""))
        + L(56, star(110, 90, 8, "tw", 0) + star(318, 120, 7, "tw", 1)),
    };
  };

  // Фотограф: камера, нажатие — вспышка
  SC.photo = (u) => {
    const defs = shadowDef(u)
      + lg(`${u}-cb`, [stp(0, "#3a3e46"), stp(1, "#15171b")])
      + lg(`${u}-ct`, [stp(0, "#f1f3f6"), stp(0.5, "#b9c0c9"), stp(1, "#80878f")])
      + rg(`${u}-lens`, [stp(0, "#6a7bff"), stp(0.35, "#1d2a6b"), stp(0.75, "#0a0f24"), stp(1, "#000")], 0.42, 0.38, 0.6)
      + lg(`${u}-ring`, [stp(0, "#e7eaee"), stp(0.5, "#7e858e"), stp(1, "#d2d6db")], 1, 1);
    return {
      hint: "Нажмите — сделаем снимок",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 330, 150, 16)}`)
        + L(28, `<path d="M300 170L318 160L318 296L300 310Z" fill="#0c0d10"/>
          <rect x="92" y="168" width="210" height="142" rx="18" fill="url(#${u}-cb)"/>
          <path d="M92 196L302 196" stroke="#fff" stroke-opacity=".06" stroke-width="40"/>
          <path d="M150 168L170 132L232 132L252 168Z" fill="url(#${u}-ct)"/>
          <rect x="92" y="156" width="210" height="24" rx="8" fill="url(#${u}-ct)"/>
          <rect class="flashwin" x="112" y="190" width="38" height="20" rx="4" fill="#e9eef5"/>
          <rect x="246" y="142" width="34" height="16" rx="6" fill="#d23b3b"/>
          <circle cx="200" cy="244" r="66" fill="#0d0e11"/>
          <circle cx="200" cy="244" r="56" fill="url(#${u}-ring)"/>
          <circle cx="200" cy="244" r="46" fill="#090a0d"/>
          <circle cx="200" cy="244" r="38" fill="url(#${u}-lens)"/>
          <g class="lens-glint" style="transform-origin:200px 244px"><path d="M176 226A30 30 0 0 1 206 214" stroke="#fff" stroke-opacity=".7" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="218" cy="262" r="5" fill="#fff" opacity=".35"/></g>`)
        + `<div class="l flash" style="--z:70"></div>`,
    };
  };

  // Онлайн-школа: шапочка выпускника, кисточка качается
  SC.school = (u) => {
    const defs = shadowDef(u) + lg(`${u}-cap`, [stp(0, lite("#2b2f3a", 18)), stp(1, "#14161c")]) + lg(`${u}-tas`, [stp(0, "#ffd166"), stp(1, "#c8901c")]);
    return {
      hint: "Нажмите — подбросим",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 332, 130, 16, "sh-toss")}`)
        + L(34, `<g class="cap-toss"><g class="cap"><path d="M136 196L136 246C136 270 166 286 200 286C234 286 264 270 264 246L264 196Z" fill="#1b1e26"/>
            <path d="M136 246C136 270 166 286 200 286C234 286 264 270 264 246" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="4"/>
            <path d="M200 120L326 168L200 216L74 168Z" fill="url(#${u}-cap)"/>
            <path d="M74 168L200 216L326 168L326 176L200 224L74 176Z" fill="#0d0f14"/>
            <path d="M200 120L326 168L200 216" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>
            <ellipse cx="200" cy="168" rx="9" ry="5" fill="url(#${u}-tas)"/>
            <g class="tassel" style="transform-origin:200px 168px"><path d="M200 168C230 172 262 178 290 188L290 244" fill="none" stroke="url(#${u}-tas)" stroke-width="4"/>
            <path d="M282 240L298 240L304 284L276 284Z" fill="url(#${u}-tas)"/></g></g></g>`),
    };
  };

  // Цветы: букет тюльпанов в крафте
  SC.flowers = (u) => {
    const cols = [A, "#ff8fab", "#fff1f4", "#ff6b6b", "#ffb4c8"];
    const H = [[150, 128], [200, 104], [252, 126], [176, 156], [226, 152]];
    const defs = shadowDef(u)
      + lg(`${u}-kr`, [stp(0, "#e3c49b"), stp(1, "#b38a5c")], 1, 0)
      + cols.map((c, i) => lg(`${u}-t${i}`, [stp(0, lite(c, 30)), stp(1, dark(c, 22))])).join("");
    const tulip = ([x, y], i) => `<g class="tl" style="--i:${i};transform-origin:${x}px ${y + 30}px">
        <path d="M200 300C200 260 ${x} ${y + 60} ${x} ${y + 20}" fill="none" stroke="#3f8f4a" stroke-width="5"/>
        <path d="M${x - 22} ${y}C${x - 24} ${y + 26} ${x - 10} ${y + 36} ${x} ${y + 36}C${x + 10} ${y + 36} ${x + 24} ${y + 26} ${x + 22} ${y}L${x + 12} ${y + 10}L${x} ${y - 6}L${x - 12} ${y + 10}Z" fill="url(#${u}-t${i})"/>
        <path d="M${x - 8} ${y + 6}C${x - 9} ${y + 18} ${x - 6} ${y + 26} ${x - 2} ${y + 30}" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    return {
      hint: "Нажмите — полетят лепестки",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 340, 90, 13)}`)
        + L(26, `<g class="bq" style="transform-origin:200px 336px">${H.map(tulip).join("")}
            <path d="M150 240C170 250 186 270 196 300" stroke="#4aa357" stroke-width="10" fill="none" stroke-linecap="round"/></g>`)
        + L(40, `<path d="M118 214L282 214L224 336L176 336Z" fill="url(#${u}-kr)"/>
          <path d="M118 214L176 336L150 228Z" fill="#000" opacity=".1"/><path d="M282 214L224 336L250 228Z" fill="#fff" opacity=".12"/>
          <path d="M168 282C184 290 216 290 232 282L230 296C214 302 186 302 170 296Z" style="fill:${A}"/>`)
        + L(64, `<g class="petals">${[0, 1, 2, 3].map((k) => `<ellipse cx="${150 + k * 34}" cy="120" rx="7" ry="11" style="fill:${cols[k]};--i:${k}"/>`).join("")}</g>`),
    };
  };

  // Турагентство: островок с пальмой в море
  SC.travel = (u) => {
    const defs = shadowDef(u)
      + rg(`${u}-sun`, [stp(0, "#fff3b0"), stp(0.5, "#ffd166"), stp(1, "#ffd166", 0)])
      + lg(`${u}-sea`, [stp(0, mix(A, 55, "#2ec4d6")), stp(1, dark(mix(A, 55, "#2ec4d6"), 35))])
      + lg(`${u}-sand`, [stp(0, "#ffe4a8"), stp(1, "#e0b36a")])
      + lg(`${u}-leaf`, [stp(0, "#6ccf6a"), stp(1, "#22803a")]);
    const leaf = (r) => `<path d="M236 150C262 132 296 136 316 156C292 150 270 152 248 162Z" fill="url(#${u}-leaf)" transform="rotate(${r} 236 152)"/>`;
    return {
      hint: "Нажмите — поплывёт кораблик",
      layers: L(0, `<defs>${defs}</defs><circle class="sun" cx="300" cy="110" r="70" fill="url(#${u}-sun)"/>
          ${shadow(u, 200, 338, 176, 20)}
          <path d="M24 286L24 304C24 326 104 344 200 344C296 344 376 326 376 304L376 286Z" style="fill:${dark(mix(A, 55, "#2ec4d6"), 45)}"/>
          <ellipse cx="200" cy="286" rx="176" ry="42" fill="url(#${u}-sea)"/>
          <g class="waves">${[0, 1, 2].map((k) => `<path d="M${70 + k * 90} ${276 + (k % 2) * 18}q10 -6 20 0t20 0" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none" stroke-linecap="round" style="--i:${k}"/>`).join("")}</g>
          <g class="boat"><path d="M40 266L74 266L68 276L46 276Z" fill="#fff"/><path d="M57 264L57 232L74 262Z" style="fill:${A}"/></g>`)
        + L(28, `<ellipse cx="216" cy="282" rx="86" ry="20" fill="url(#${u}-sand)"/>
          <g class="palm" style="transform-origin:214px 280px"><path d="M214 280C214 240 222 196 236 152" stroke="#8a5a34" stroke-width="10" fill="none" stroke-linecap="round"/>
          <path d="M214 270L222 266M216 250L225 246M219 230L228 227M223 210L232 207M228 190L236 188M232 172L240 170" stroke="#6b4428" stroke-width="2.5"/>
          ${[0, 60, 130, 200, 280].map(leaf).join("")}<circle cx="232" cy="160" r="7" fill="#6b4428"/><circle cx="242" cy="164" r="6" fill="#7d522f"/></g>`),
    };
  };

  // Ветклиника: мягкая лапка, нажатие — сердечки
  SC.pets = (u) => {
    const fur = mix(A, 40, "#f4e6d8");
    const defs = shadowDef(u)
      + rg(`${u}-fur`, [stp(0, lite(fur, 40)), stp(0.6, fur), stp(1, dark(fur, 22))], 0.4, 0.35, 0.7)
      + rg(`${u}-bean`, [stp(0, "#ffd0dc"), stp(0.6, "#ff8fab"), stp(1, "#e0607e")], 0.38, 0.32, 0.7);
    const heart = (x, i) => `<path class="hrt" style="--i:${i}" d="M${x} 150c-8-7-14-11-14-18c0-5 3.5-8 8-8c3 0 5 1.5 6 4c1-2.5 3-4 6-4c4.5 0 8 3 8 8c0 7-6 11-14 18z" fill="#ff5d8f"/>`;
    return {
      hint: "Нажмите на лапку",
      layers: L(0, `<defs>${defs}</defs>${shadow(u, 200, 334, 140, 18)}`)
        + L(30, `<g class="paw" style="transform-origin:200px 320px"><g class="paw-sq" style="transform-origin:200px 320px"><ellipse cx="200" cy="262" rx="136" ry="64" style="fill:${dark(fur, 25)}"/>
            <ellipse cx="200" cy="248" rx="136" ry="64" fill="url(#${u}-fur)"/>
            <path d="M200 226C236 226 262 252 262 276C262 296 244 304 226 300C214 298 208 292 200 292C192 292 186 298 174 300C156 304 138 296 138 276C138 252 164 226 200 226Z" fill="url(#${u}-bean)"/>
            ${[[124, 216, -20], [164, 190, -8], [236, 190, 8], [276, 216, 20]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="20" ry="25" fill="url(#${u}-bean)" transform="rotate(${r} ${x} ${y})"/><ellipse cx="${x - 5}" cy="${y - 9}" rx="5" ry="8" fill="#fff" opacity=".5" transform="rotate(${r} ${x} ${y})"/>`).join("")}
            <ellipse cx="182" cy="246" rx="12" ry="7" fill="#fff" opacity=".45"/></g></g>`)
        + L(60, `<g class="hearts">${heart(160, 0)}${heart(206, 1)}${heart(250, 2)}</g>`),
    };
  };

  // IT-стартап: летающая тарелка с лучом
  SC.tech = (u) => {
    const defs = shadowDef(u)
      + lg(`${u}-ufo`, [stp(0, "#f2f5f8"), stp(0.45, "#a9b2bd"), stp(1, "#545c66")])
      + rg(`${u}-dome`, [stp(0, "#e9fbff"), stp(0.5, mix(A, 55, "#7fe7ff")), stp(1, dark(mix(A, 55, "#7fe7ff"), 40))], 0.38, 0.3, 0.8)
      + lg(`${u}-beam`, [stp(0, A, 0.55), stp(1, A, 0)]);
    const lights = Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI * (0.12 + (i / 6) * 0.76);
      return `<circle class="ufo-l" style="--i:${i}" cx="${f1(200 - Math.cos(a) * 112)}" cy="${f1(196 + Math.sin(a) * 18)}" r="6" fill="#fff"/>`;
    }).join("");
    return {
      hint: "Нажмите — включим луч",
      layers: L(0, `<defs>${defs}</defs>${[[60, 80], [330, 60], [96, 250], [340, 240], [150, 50], [280, 300]].map(([x, y], i) => `<circle class="tw" style="--d:${i % 4}" cx="${x}" cy="${y}" r="2.4" fill="var(--fg)" opacity=".6"/>`).join("")}
          <ellipse class="beam-glow" cx="200" cy="330" rx="96" ry="16" style="fill:${A}" opacity=".35"/>`)
        + L(18, `<path class="beam" d="M166 206L234 206L296 330L104 330Z" fill="url(#${u}-beam)"/>
          <g class="byte"><rect x="186" y="286" width="28" height="22" rx="5" style="fill:${A}"/><path d="M195 292l-4 5 4 5M205 292l4 5-4 5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g>`)
        + L(40, `<g class="ufo"><ellipse cx="200" cy="196" rx="130" ry="36" fill="url(#${u}-ufo)"/>
            <ellipse cx="200" cy="186" rx="130" ry="30" fill="#e6ebf0"/>
            <path d="M138 182C138 136 168 112 200 112C232 112 262 136 262 182Z" fill="url(#${u}-dome)"/>
            <path d="M160 160C164 138 180 126 198 124" stroke="#fff" stroke-opacity=".75" stroke-width="5" fill="none" stroke-linecap="round"/>
            <ellipse cx="200" cy="184" rx="66" ry="8" fill="#000" opacity=".12"/>${lights}</g>`),
    };
  };

  /* ---------------- товары кофейни: крышка открывается ---------------- */
  const PROD = {};
  PROD.tin = (u, o) => {
    const defs = shadowDef(u) + cyl(`${u}-tin`, "#e9e2d6", 38) + cyl(`${u}-lbl`, A, 25) + cyl(`${u}-lid`, "#c9ccd1", 45)
      + rg(`${u}-in`, [stp(0, "#5a3520"), stp(1, "#1f120a")]);
    const bean = (i, tx, ty, r) => `<g class="bean" style="--i:${i};--tx:${tx}px;--ty:${ty}px;--r:${r}deg"><ellipse cx="200" cy="176" rx="9" ry="12.5" fill="#5b3420"/><path d="M200 165C196 172 204 180 200 188" stroke="#2a160b" stroke-width="2" fill="none"/></g>`;
    return L(0, `<defs>${defs}</defs>${shadow(u, 200, 330, 140, 16)}`)
      + L(30, `<path d="M128 176L128 316A72 15 0 0 0 272 316L272 176Z" fill="url(#${u}-tin)"/>
        <rect x="128" y="214" width="144" height="74" fill="url(#${u}-lbl)"/>
        <text x="200" y="250" text-anchor="middle" style="font:700 20px var(--head);fill:var(--accFg);letter-spacing:.06em">${o.label}</text>
        <text x="200" y="274" text-anchor="middle" style="font:600 11px Inter,sans-serif;fill:var(--accFg);opacity:.85">${o.sub}</text>
        <ellipse cx="200" cy="176" rx="72" ry="15" fill="url(#${u}-in)"/>
        <g class="beans">${bean(0, -96, 150, 120)}${bean(1, -40, 158, -80)}${bean(2, 54, 156, 60)}${bean(3, 104, 148, -140)}${bean(4, -120, 140, 200)}${bean(5, 10, 162, 30)}</g>
        <g class="lid"><path d="M126 160L126 176A74 15 0 0 0 274 176L274 160Z" fill="url(#${u}-lid)"/>
          <ellipse cx="200" cy="160" rx="74" ry="15" fill="#e7e9ec"/><ellipse cx="200" cy="160" rx="58" ry="10" fill="#d4d7dc"/></g>`)
      + L(56, `<g class="aroma"><path d="M170 140C160 120 182 108 172 88" stroke="var(--muted)" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/><path d="M226 140C216 120 238 108 228 88" stroke="var(--muted)" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/></g>`);
  };
  PROD.box = (u, o) => {
    const defs = shadowDef(u) + lg(`${u}-kraft`, [stp(0, "#d8b98d"), stp(1, "#a98352")]) + lg(`${u}-side`, [stp(0, "#b8945f"), stp(1, "#8a6a3c")]);
    const bag = (i, x) => `<g class="bag" style="--i:${i}"><rect x="${x}" y="150" width="46" height="62" rx="4" fill="#fbf7f0" stroke="#e2d7c6"/><rect x="${x + 8}" y="166" width="30" height="20" rx="3" style="fill:${A}"/></g>`;
    return L(0, `<defs>${defs}</defs>${shadow(u, 200, 330, 140, 16)}`)
      + L(24, `${bag(0, 132)}${bag(1, 178)}${bag(2, 224)}`)
      + L(34, `<path d="M276 196L304 180L304 300L276 318Z" fill="url(#${u}-side)"/>
        <rect x="124" y="196" width="152" height="122" rx="3" fill="url(#${u}-kraft)"/>
        <rect x="124" y="240" width="152" height="40" style="fill:${A}"/>
        <text x="200" y="266" text-anchor="middle" style="font:700 16px var(--head);fill:var(--accFg)">${o.label}</text>
        <g class="flap flap--l" style="transform-origin:124px 196px"><path d="M124 196L200 196L200 160L124 160Z" fill="#c9a774"/></g>
        <g class="flap flap--r" style="transform-origin:276px 196px"><path d="M200 196L276 196L276 160L200 160Z" fill="#b8955f"/></g>`);
  };
  PROD.cup = (u, o) => {
    const defs = shadowDef(u) + cyl(`${u}-cup`, A, 30) + cyl(`${u}-cl`, "#2a2d33", 25);
    return L(0, `<defs>${defs}</defs>${shadow(u, 200, 332, 110, 15)}`)
      + L(30, `<path d="M148 168L252 168L238 322C236 330 164 330 162 322Z" fill="url(#${u}-cup)"/>
        <path d="M154 230L246 230L242 270L158 270Z" fill="#fff" opacity=".18"/>
        <text x="200" y="257" text-anchor="middle" style="font:700 16px var(--head);fill:var(--accFg)">${o.label}</text>
        <rect x="142" y="150" width="116" height="22" rx="8" fill="url(#${u}-cl)"/>
        <g class="cup-lid" style="transform-origin:236px 150px"><path d="M170 150L230 150L226 138L174 138Z" fill="#3a3e46"/><rect x="186" y="132" width="28" height="8" rx="4" fill="#4a4f58"/></g>`)
      + L(56, `<g class="aroma"><path d="M184 128C174 108 196 96 186 76" stroke="var(--muted)" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/><path d="M212 128C202 108 224 96 214 76" stroke="var(--muted)" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/></g>`);
  };
  const PRODUCTS = {
    coffee: [
      { kind: "tin", label: "ЗЕРНО", sub: "Эфиопия · 250 г" },
      { kind: "box", label: "ДРИП" },
      { kind: "cup", label: "TO GO" },
    ],
  };

  /* ---------------- что отдаём наружу ---------------- */
  function scene(k, st, u) {
    const s = (SC[k] || SC.coffee)(u, st);
    return `<div class="p3d"><div class="p3d__in"><div class="p3d__sw">${s.layers}</div></div></div>`
      + (s.ui || `<span class="s3d-hint">${s.hint || "Покрутите"}</span>`);
  }
  function product(niche, i, u, open) {
    const o = PRODUCTS[niche]?.[i];
    if (!o) return "";
    return `<div class="p3d"><div class="p3d__in"><div class="p3d__sw">${PROD[o.kind](u, o)}</div></div></div>`;
  }
  return { CARS, PAINTS, scene, product, hasProducts: (k) => !!PRODUCTS[k], kind: (k, i) => PRODUCTS[k]?.[i]?.kind };
})();
