(function () {
  "use strict";

  function boot() {
  var DATA = window.EDIFICE_DATA;
  var FILE_STATUS = window.EDIFICE_STATUS || { items: [], orphaned: [] };
  var WORKS = window.EDIFICE_WORKS || null;
  var EXPENSES = window.EDIFICE_EXPENSES || null;
  var AUTH = window.EdificeAuth;
  if (!DATA) {
    document.body.innerHTML = "<p style='padding:24px'>Нет data.js</p>";
    return;
  }
  var USER = AUTH ? AUTH.require() : null;
  if (!USER) return;

  var LS_KEY = "edifice-status-v2";

  var STAGE = [
    ["counting", "Считается"],
    ["declared", "Заявлено"],
    ["progress", "В процессе"],
    ["waiting", "Ожидание"],
    ["done", "Готово"]
  ];
  var PAY = [
    ["none", "не заявлено"],
    ["approve", "ждёт утверждения"],
    ["sign", "на подписи"],
    ["customer", "заявлено заказчиком"],
    ["debt", "добавлена в долг"],
    ["bought", "закуплено"],
    ["advance", "аванс оплачен"],
    ["paid", "оплачено"]
  ];
  var FLOOR_ORDER = ["fitness", "cafe", "salon", "office", "terrace", "facade"];
  var FLOOR_TITLE = {
    fitness: "Фитнес",
    cafe: "Socials",
    salon: "Салон",
    office: "Офис",
    terrace: "Терраса",
    facade: "Фасад",
    lift: "Лифт",
    building: "Здание"
  };

  var root = document.body.getAttribute("data-root") || "";
  var page = document.body.getAttribute("data-page") || "index";
  var pageFloor = document.body.getAttribute("data-floor") || "";

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  function asset(p) {
    if (!p) return "";
    if (p.indexOf("http") === 0 || p.indexOf("data:") === 0) return p;
    return root + p.replace(/^\//, "");
  }

  function som(n) {
    n = Math.round(Number(n) || 0);
    var sign = n < 0 ? "−" : "";
    var s = String(Math.abs(n));
    var out = "";
    while (s.length > 3) {
      out = "\u00a0" + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return sign + s + out;
  }
  function somMln(n) {
    n = Number(n) || 0;
    var abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2).replace(".", ",") + " млрд";
    if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " млн";
    return som(n);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      if (ch === "&") return "&" + "amp;";
      if (ch === "<") return "&" + "lt;";
      if (ch === ">") return "&" + "gt;";
      if (ch === '"') return "&" + "quot;";
      return "&#39;";
    });
  }
  function today() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function allItems() {
    var out = [];
    FLOOR_ORDER.forEach(function (slug) {
      var f = DATA.floors[slug];
      if (f && f.items) {
        f.items.forEach(function (it) {
          it.floor = slug;
          out.push(it);
        });
      }
    });
    if (DATA.lift && DATA.lift.items) {
      DATA.lift.items.forEach(function (it) {
        it.floor = "lift";
        out.push(it);
      });
    }
    return out;
  }

  function readHash() {
    var h = (location.hash || "").replace(/^#/, "");
    var o = {};
    if (!h) return o;
    h.split("&").forEach(function (p) {
      if (!p) return;
      var i = p.indexOf("=");
      if (i < 0) o[decodeURIComponent(p)] = "1";
      else o[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1));
    });
    return o;
  }
  function writeHash(o) {
    var parts = [];
    Object.keys(o).forEach(function (k) {
      if (o[k] !== "" && o[k] != null && o[k] !== "all") {
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(o[k]));
      }
    });
    var n = parts.join("&");
    try { history.replaceState(null, "", n ? "#" + n : location.pathname + location.search); }
    catch (e) { location.hash = n; }
  }

  function fileMap() {
    var m = {};
    (FILE_STATUS.items || []).forEach(function (r) { if (r && r.id) m[r.id] = r; });
    return m;
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (e) { return {}; }
  }
  function saveLocal(map) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function hosted() {
    var h = location.hostname || "";
    if (/\.github\.io$/i.test(h)) return false;
    return location.protocol === "http:" || location.protocol === "https:";
  }
  function overlayUrl() {
    return root + "api/overlay";
  }
  function loadRemoteOverlay() {
    if (!hosted()) return Promise.resolve(false);
    return fetch(overlayUrl(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) return false;
      return r.json();
    }).then(function (obj) {
      if (!obj || !obj.items) return false;
      obj.items.forEach(function (row) {
        if (row && row.id) localOverlay[row.id] = row;
      });
      statusCache = {};
      saveLocal(localOverlay);
      return true;
    }).catch(function () { return false; });
  }
  function publishOverlay() {
    if (!AUTH.can("editStatus")) return;
    if (!hosted()) {
      downloadStatus();
      return;
    }
    var key = "";
    try { key = sessionStorage.getItem("edifice-publish-key") || ""; } catch (e) {}
    if (!key) {
      key = window.prompt("Ключ публикации (пароль генерального директора):", "") || "";
      if (!key) return;
      try { sessionStorage.setItem("edifice-publish-key", key); } catch (e) {}
    }
    var items = allItems().map(function (it) { return statusOf(it.id); });
    var payload = { key: key, updated: today(), exportedBy: USER.login, items: items };
    fetch(overlayUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          try { sessionStorage.removeItem("edifice-publish-key"); } catch (e) {}
          alert(res.j && res.j.error ? res.j.error : "Сервер не принял публикацию");
          return;
        }
        alert("Опубликовано. Все, кто откроет смету, увидят эти статусы.");
        renderBanner();
      })
      .catch(function () {
        alert("Нет сервера публикации. Запустите server.py на Victus — см. КАК_ВЫЛОЖИТЬ.txt");
      });
  }

  function money(n, compact) {
    if (!AUTH.can("seeMoney")) return "—";
    if (n == null || n === "") return "—";
    return compact ? somMln(n) : som(n);
  }
  function canEdit() { return AUTH.can("editStatus"); }

  function moneyCell(it) {
    if (!AUTH.can("seeMoney")) return "—";
    if (it.noPrice || it.sum == null) return '<span class="num est">считается</span>';
    var st = statusOf(it.id);
    var pay = it.funding === "customer" ? "customer" : (st.pay || "none");
    return '<span class="num ' + sumCls(pay, it.priceKind === "exact") + '" title="' + sumTitle(pay, it.priceKind) + '">' + som(it.sum) + "</span>";
  }

  function sumCls(pay, exact) {
    if (pay === "customer") return "cust";
    if (pay === "paid" || pay === "bought") return "paid";
    if (pay === "debt") return "debt";
    return exact ? "exact" : "est";
  }
  function sumTitle(pay, priceKind) {
    if (pay === "customer") return "заявлено заказчиком";
    if (pay === "paid") return "оплачено";
    if (pay === "advance") return "аванс оплачен";
    if (pay === "bought") return "закуплено";
    if (pay === "debt") return "в долгу";
    return priceKind === "exact" ? "точная цифра" : "примерная оценка";
  }
  function expSumCls(status) {
    if (status === "paid") return "paid";
    if (status === "debt") return "debt";
    return "est";
  }

  function emptyStatus(id) {
    return { id: id, stage: "counting", pay: "none", paidAmount: 0, doc: "", comment: "", updated: "" };
  }

  var localOverlay = loadLocal();
  var statusCache = {};

  function statusOf(id) {
    if (statusCache[id]) return statusCache[id];
    var base = emptyStatus(id);
    var f = fileMap()[id];
    if (f) {
      Object.keys(base).forEach(function (k) {
        if (f[k] != null) base[k] = f[k];
      });
    }
    var loc = localOverlay[id];
    if (loc) {
      Object.keys(base).forEach(function (k) {
        if (loc[k] != null) base[k] = loc[k];
      });
    }
    statusCache[id] = base;
    return base;
  }

  function stageOfItem(it) {
    if (!it) return "counting";
    var loc = localOverlay[it.id];
    if (loc && loc.stage) return loc.stage;
    var f = fileMap()[it.id];
    if (f && f.stage) return f.stage;
    return it.stageHint || it.stage || "counting";
  }
  window.EDIFICE_STAGE = { stageOf: stageOfItem };

  function isDirty(id) { return !!localOverlay[id]; }
  function dirtyCount() { return Object.keys(localOverlay).length; }

  function patchStatus(id, fields) {
    if (!canEdit()) return statusOf(id);
    var cur = statusOf(id);
    var next = {};
    Object.keys(cur).forEach(function (k) { next[k] = cur[k]; });
    Object.keys(fields).forEach(function (k) { next[k] = fields[k]; });
    next.id = id;
    next.updated = today();
    var file = fileMap()[id] || emptyStatus(id);
    var same = true;
    ["stage", "pay", "paidAmount", "doc", "comment"].forEach(function (k) {
      if (String(next[k] == null ? "" : next[k]) !== String(file[k] == null ? "" : file[k])) same = false;
    });
    if (same) delete localOverlay[id];
    else localOverlay[id] = next;
    statusCache[id] = next;
    saveLocal(localOverlay);
    renderBanner();
    return next;
  }

  function labelOf(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1];
    return v || "—";
  }
  function pill(list, v, prefix) {
    var cls = (prefix || "st") + "-" + (v || "none");
    return '<span class="pill ' + cls + '"><i></i>' + esc(labelOf(list, v || "none")) + "</span>";
  }
  function sel(list, axis, id, v) {
    if (!canEdit()) return pill(list, v, axis === "pay" ? "pay" : "st");
    var html = '<select class="st" data-axis="' + axis + '" data-id="' + esc(id) + '">';
    list.forEach(function (p) {
      html += '<option value="' + p[0] + '"' + (p[0] === v ? " selected" : "") + ">" + esc(p[1]) + "</option>";
    });
    return html + "</select>";
  }

  function navHtml() {
    var links = [
      ["index.html", "Смета", "index"],
      ["floors/fitness.html", "Фитнес", "fitness"],
      ["floors/cafe.html", "Socials", "cafe"],
      ["floors/salon.html", "Салон", "salon"],
      ["floors/office.html", "Офис", "office"],
      ["floors/terrace.html", "Терраса", "terrace"],
      ["floors/facade.html", "Фасад", "facade"],
      ["model.html", "3D-стройка", "model"],
      ["lift.html", "Лифт", "lift"],
      ["works.html", "Здание", "works"],
      ["expenses.html", "Расходы", "expenses"],
      ["docs.html", "Документы", "docs"],
      ["status.html", "Статусы", "status"]
    ];
    var html = "";
    links.forEach(function (l) {
      var href = root + l[0];
      var on = (page === "floor" && pageFloor === l[2]) || page === l[2] || (page === "index" && l[2] === "index");
      html += '<a href="' + href + '"' + (on ? ' class="on"' : "") + ">" + l[1] + "</a>";
    });
    if (AUTH.can("seeMoney")) {
      html += '<a href="' + root + 'assets/smeta-zdanie.xlsx" download>Excel СМР</a>';
    }
    return html;
  }

  function wireWho() {
    var el = $("#who");
    if (!el || !USER) return;
    var html = "<strong>" + esc(USER.name) + "</strong>";
    if (USER.open) html += '<a href="' + root + 'login.html">Войти</a>';
    else html += '<a href="#" id="logout">Выйти</a>';
    if (AUTH.can("editStatus") && hosted()) {
      html += '<a href="#" id="publish">Опубликовать</a>';
    }
    el.innerHTML = html;
    var a = $("#logout", el);
    if (a) a.addEventListener("click", function (e) { e.preventDefault(); AUTH.logout(); });
    var p = $("#publish", el);
    if (p) p.addEventListener("click", function (e) { e.preventDefault(); publishOverlay(); });
  }

  function wireNav() {
    var nav = $("#nav");
    if (nav) nav.innerHTML = navHtml();
    wireWho();
    var burger = $("#burger");
    if (burger && nav) {
      burger.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  function renderBanner() {
    var n = dirtyCount();
    $all("[data-dirty-banner]").forEach(function (el) {
      if (n === 0) { el.classList.add("hidden"); return; }
      el.classList.remove("hidden");
      var msg = el.querySelector("[data-dirty-msg]");
      if (msg) msg.textContent = hosted()
        ? ("Изменено: " + n + " позиций. Нажмите «Опубликовать» в шапке — увидят все.")
        : ("Изменено локально: " + n + " позиций. Скачайте status.js и положите в assets/.");
    });
  }

  function downloadStatus() {
    if (!AUTH.can("export")) return;
    var items = allItems().map(function (it) { return statusOf(it.id); });
    var payload = { updated: today(), exportedBy: USER.login, items: items, orphaned: [] };
    var body = "window.EDIFICE_STATUS = " + JSON.stringify(payload, null, 2) + ";\n";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/javascript;charset=utf-8" }));
    a.download = "status.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function applyUploadedStatus(obj) {
    if (!AUTH.can("import")) { alert("Импорт только у администратора"); return; }
    if (!obj || !obj.items) throw new Error("Нет items");
    if (!confirm("Заменить локальные статусы файлом (" + obj.items.length + " строк)?")) return;
    localOverlay = {};
    obj.items.forEach(function (row) {
      if (row && row.id) localOverlay[row.id] = row;
    });
    statusCache = {};
    saveLocal(localOverlay);
    location.reload();
  }

  function wireStatusTools(scope) {
    scope = scope || document;
    $all("[data-dl-status]", scope).forEach(function (b) {
      b.addEventListener("click", downloadStatus);
    });
    $all("[data-publish]", scope).forEach(function (b) {
      b.addEventListener("click", function () { publishOverlay(); });
    });
    $all("[data-reset-status]", scope).forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Сбросить локальные отметки?")) return;
        localOverlay = {};
        statusCache = {};
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        location.reload();
      });
    });
    $all("[data-ul-status]", scope).forEach(function (input) {
      input.addEventListener("change", function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var text = String(reader.result || "");
            var i = text.indexOf("{");
            var j = text.lastIndexOf("}");
            applyUploadedStatus(JSON.parse(text.slice(i, j + 1)));
          } catch (e) { alert("Не удалось прочитать status.js: " + e.message); }
        };
        reader.readAsText(f);
      });
    });
  }

  function wireRowEdits(scope) {
    $all("select.st", scope).forEach(function (s) {
      s.addEventListener("change", function () {
        var fields = {};
        fields[s.getAttribute("data-axis")] = s.value;
        patchStatus(s.getAttribute("data-id"), fields);
        var tr = s.closest("tr");
        if (tr) tr.classList.add("dirty");
      });
    });
  }

  function lightboxBind(scope) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = '<img alt=""/><div class="cap"></div>';
    document.body.appendChild(box);
    box.addEventListener("click", function () { box.classList.remove("on"); });
    $all("a[data-full]", scope).forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        box.querySelector("img").src = a.getAttribute("href");
        box.querySelector(".cap").textContent = a.getAttribute("data-cap") || "";
        box.classList.add("on");
      });
    });
  }

  function galleryHtml(arr) {
    if (!arr || !arr.length) return "";
    var html = '<div class="gallery">';
    arr.forEach(function (g) {
      html += '<a href="' + asset(g.src) + '" data-full data-cap="' + esc(g.caption) + '"><figure>';
      html += '<img src="' + asset(g.src) + '" alt="' + esc(g.caption) + '"/>';
      html += "<figcaption>" + esc(g.caption) + "</figcaption></figure></a>";
    });
    return html + "</div>";
  }

  function itemsTable(rows, onlySec) {
    var sections = [];
    var map = {};
    rows.forEach(function (it) {
      if (onlySec && it.sec !== onlySec && it.section !== onlySec) return;
      var s = it.section || "Прочее";
      if (!map[s]) { map[s] = []; sections.push(s); }
      map[s].push(it);
    });
    var html = "";
    if (!sections.length) {
      return '<p class="muted">Позиций нет — киньте файл, внесём в смету.</p>';
    }
    sections.forEach(function (sec) {
      var list = map[sec];
      var sub = 0, est = 0;
      list.forEach(function (it) {
        if (it.funding === "customer") return;
        if (it.sum) {
          sub += it.sum;
          if (it.priceKind !== "exact") est += it.sum;
        }
      });
      html += '<details class="sec" open><summary><span>' + esc(sec) + " · " + list.length + "</span>";
      if (AUTH.can("seeMoney") && sub) {
        html += '<span class="stat" style="font-size:20px">' + money(sub, true);
        if (est) html += ' <span class="num est" style="font-size:14px">оценка ' + money(est, true) + "</span>";
        html += "</span>";
      }
      html += "</summary>";
      html += '<div class="table-wrap"><table><thead><tr>';
      html += "<th>ID</th><th>Позиция</th><th>Кол-во</th>";
      if (AUTH.can("seeMoney")) html += "<th>Сумма</th>";
      html += "<th>Стадия</th><th>Заявка</th></tr></thead><tbody>";
      list.forEach(function (it) {
        var st = statusOf(it.id);
        html += '<tr class="' + (isDirty(it.id) ? "dirty " : "") + (it.noPrice ? "noprice " : "") + (it.assumed ? "assumed " : "") + (it.funding === "customer" ? "customer" : "") + '" data-id="' + esc(it.id) + '">';
        html += '<td class="id" data-th="ID">' + esc(it.code || it.id) + "</td>";
        html += '<td class="name" data-th="Позиция"><strong>' + esc(it.name) + "</strong>";
        if (it.mark) html += '<div class="subtle">' + esc(it.mark) + (it.src ? " · " + esc(it.src) : "") + "</div>";
        if (it.spec) html += '<div class="muted" style="font-size:12px">' + esc(it.spec) + "</div>";
        if (it.note) html += '<div class="muted" style="font-size:12px">' + esc(it.note) + "</div>";
        html += "</td>";
        html += '<td class="num' + (it.noQty ? " qty-miss" : "") + '" data-th="Кол-во">';
        html += it.noQty ? "нет кол-ва" : esc(it.qty == null ? "—" : it.qty);
        if (!it.noQty && it.unit) html += " " + esc(it.unit);
        html += "</td>";
        if (AUTH.can("seeMoney")) html += '<td data-th="Сумма">' + moneyCell(it) + "</td>";
        html += "<td data-th='Стадия'>" + sel(STAGE, "stage", it.id, st.stage) + "</td>";
        html += "<td data-th='Заявка'>" + sel(PAY, "pay", it.id, st.pay) + "</td>";
        html += "</tr>";
      });
      html += "</tbody></table></div></details>";
    });
    return html;
  }

  function directorHref() {
    var file = (AUTH.directorToken ? ("director.html?t=" + AUTH.directorToken) : (DATA.meta.directorLink || "director.html"));
    var path = (location.pathname || "/").replace(/[^/]+$/, "") + file;
    if (location.protocol === "file:") return file;
    return (location.origin || "") + path;
  }

  function expenseTotals() {
    var out = { paid: 0, debt: 0, sign: 0, nPaid: 0, nDebt: 0, nSign: 0, items: [] };
    var list = (EXPENSES && EXPENSES.items) || [];
    list.forEach(function (p) {
      var s = Number(p.sum) || 0;
      if (p.status === "paid") { out.paid += s; out.nPaid += 1; }
      else if (p.status === "debt") { out.debt += s; out.nDebt += 1; }
      else if (p.status === "sign") { out.sign += s; out.nSign += 1; }
    });
    out.items = list.slice().sort(byPriority);
    return out;
  }

  function payNowHtml() {
    var ex = expenseTotals();
    var wait = [];
    (DATA.contracts || []).forEach(function (c) {
      if (c.pay === "paid" || c.pay === "advance") return;
      wait.push(c);
    });
    var now = ex.debt + ex.sign;
    var adv = 0;
    var advNames = [];
    wait.forEach(function (c) { if (c.advanceSum) { adv += c.advanceSum; advNames.push(c.name.toLowerCase() + " " + (c.advancePct || "") + "%"); } });
    var html = '<div class="pay-now">';
    html += '<div class="lbl">Что нужно оплатить</div>';
    html += '<div class="kpi kpi-4">';
    html += '<div class="panel"><div class="lbl">В реестре — оплатить</div><div class="num debt">' + money(ex.debt, true) + '</div><div class="sub">' + ex.nDebt + " заявки · " + money(ex.debt) + "</div></div>";
    html += '<div class="panel"><div class="lbl">На подписи — провести</div><div class="num est">' + money(ex.sign, true) + '</div><div class="sub">' + ex.nSign + " заявки · " + money(ex.sign) + "</div></div>";
    html += '<div class="panel"><div class="lbl">Авансы (ждут денег)</div><div class="num est">' + money(adv, true) + '</div><div class="sub">' + esc(advNames.join(", ") || "нет ожидающих") + '</div></div>';
    html += '<div class="panel"><div class="lbl">Уже оплачено</div><div class="num paid">' + money(ex.paid, true) + '</div><div class="sub">' + ex.nPaid + " заявки 1С · " + money(ex.paid) + '</div></div>';
    html += "</div>";
    html += '<div class="need-list">';
    var first = ex.items.filter(function (p) { return p.priority && p.status !== "paid"; });
    if (first.length) {
      html += '<div class="pay-first">В приоритет — оплатить первыми</div>';
      first.forEach(function (p) {
        html += '<div class="need prio-row"><strong>' + esc(p.name) + "</strong> " + expStatus(p) + prioTag(p);
        html += '<div class="num ' + expSumCls(p.status) + '">' + som(p.sum) + (p.usd ? " · $" + p.usd.toLocaleString("ru-RU") : "") + "</div>";
        html += '<div class="subtle">' + esc(p.num) + (p.doc ? " · " + esc(p.doc) : "") + " · провести раньше остальных</div></div>";
      });
    }
    ex.items.filter(function (p) { return p.status === "sign" && !p.priority; }).forEach(function (p) {
      html += '<div class="need"><strong>' + esc(p.name) + "</strong> " + expStatus(p) + prioTag(p);
      html += '<div class="num est">' + som(p.sum) + (p.usd ? " · $" + p.usd.toLocaleString("ru-RU") : "") + "</div>";
      html += '<div class="subtle">' + esc(p.num) + " · ещё не в долге</div></div>";
    });
    ex.items.filter(function (p) { return p.status === "debt"; }).forEach(function (p) {
      html += '<div class="need"><strong>' + esc(p.name) + "</strong> " + expStatus(p);
      html += '<div class="num debt">' + som(p.sum) + "</div>";
      html += '<div class="subtle">' + esc(p.num) + " · " + esc(p.registry) + "</div></div>";
    });
    wait.forEach(function (c) {
      if (c.priority) return;
      html += '<div class="need"><a href="' + root + c.href + '">открыть</a><strong>' + esc(c.name) + "</strong> ";
      html += pill(PAY, c.pay, "pay") + prioTag(c);
      html += '<div class="muted" style="margin-top:6px">';
      if (c.advanceSum) html += '<span class="num est">аванс ' + som(c.advanceSum) + "</span> · ";
      else if (c.sum) html += '<span class="num ' + (c.exact ? "exact" : "est") + '">' + som(c.sum) + "</span> · ";
      html += esc(c.note) + "</div></div>";
    });
    html += "</div></div>";
    return html;
  }

  function prioTag(p) {
    return p && p.priority ? ' <span class="pill prio"><i></i>приоритет</span>' : "";
  }
  function byPriority(a, b) {
    return (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
  }

  function expStatus(p) {
    if (p.status === "paid") return pill(PAY, "paid", "pay");
    if (p.status === "debt") return pill(PAY, "debt", "pay");
    return pill(PAY, "sign", "pay");
  }

  function moneyStrip(f) {
    if (!AUTH.can("seeMoney")) return "";
    var html = '<div class="kpi kpi-4">';
    html += '<div class="panel"><div class="lbl">Всего БЦ по этажу</div><div class="num">' + money(f.total, true) + '</div><div class="sub">' + money(f.total) + " сум</div></div>";
    html += '<div class="panel"><div class="lbl">Точные (смета/КП)</div><div class="num exact">' + money(f.exactSum, true) + '</div><div class="sub">' + money(f.exactSum) + "</div></div>";
    html += '<div class="panel"><div class="lbl">Примерные БЦ</div><div class="num est">' + money(f.estSum, true) + '</div><div class="sub">' + money(f.estSum) + "</div></div>";
    if (f.customerSum) {
      html += '<div class="panel"><div class="lbl">Заявлено заказчиком</div><div class="num cust">' + money(f.customerSum, true) + '</div><div class="sub">не в сумме БЦ · список Наргизы</div></div>';
    } else {
      html += '<div class="panel"><div class="lbl">Без количества</div><div class="num">' + (f.noQty || 0) + '</div><div class="sub">сумма по ним 0 — итог занижен</div></div>';
    }
    return html + "</div>";
  }

  function sectionList(items) {
    var order = [];
    var map = {};
    (items || []).forEach(function (it) {
      var k = it.sec || it.section || "X";
      if (!map[k]) {
        map[k] = { key: k, name: it.section || k, n: 0, sum: 0, est: 0, cust: 0 };
        order.push(k);
      }
      map[k].n += 1;
      if (it.funding === "customer") {
        map[k].cust += it.sum || 0;
        return;
      }
      if (it.sum) {
        map[k].sum += it.sum;
        if (it.priceKind !== "exact") map[k].est += it.sum;
      }
    });
    return order.map(function (k) { return map[k]; });
  }

  function issuesHtml(list) {
    if (!list || !list.length) return "";
    var open = list.filter(function (x) { return x.open !== false; });
    var html = "<h2>Открытые вопросы · " + open.length + "</h2><div class='need-list'>";
    list.forEach(function (q) {
      html += '<div class="need' + (q.open === false ? " closed" : "") + '">';
      html += "<strong>" + esc(q.n) + ". " + esc(q.title) + "</strong> ";
      if (q.prio) html += '<span class="subtle">' + esc(q.prio) + "</span>";
      if (q.why) html += '<div class="muted" style="margin-top:6px">' + esc(q.why) + "</div>";
      if (q.who) html += '<div class="subtle">' + esc(q.who) + "</div>";
      html += "</div>";
    });
    return html + "</div>";
  }

  function renderIndex(el) {
    var meta = DATA.meta;
    var html = "";
    html += '<div class="hero-cover">';
    html += '<img src="' + asset("assets/building.jpg") + '" alt="Фасад"/>';
    html += '<div class="veil"><p class="subtle">Бизнес-центр · ' + esc(meta.city) + "</p>";
    html += "<h1>Temiroff <em style='color:var(--accent);font-style:italic'>Edifice</em></h1>";
    html += '<p class="muted">' + esc(meta.subtitle) + ". Ревизия " + esc(meta.revision) + ".</p>";
    html += "</div></div>";

    if (AUTH.can("seeMoney")) html += payNowHtml();

    var ex = expenseTotals();
    html += '<div class="kpi kpi-4">';
    html += '<div class="panel"><div class="lbl">Этажи · смета БЦ</div><div class="num">' + money(meta.floorsSum, true) + '</div><div class="sub">' + money(meta.floorsSum) + " сум</div></div>";
    html += '<div class="panel"><div class="lbl">Точные (смета / КП)</div><div class="num exact">' + money(meta.exactSum, true) + '</div><div class="sub">' + money(meta.exactSum) + "</div></div>";
    html += '<div class="panel"><div class="lbl">Примерные</div><div class="num est">' + money(meta.estSum, true) + '</div><div class="sub">без закупок заказчика</div></div>';
    html += '<div class="panel"><div class="lbl">СМР здания</div><div class="num exact">' + money(meta.cmr, true) + '</div><div class="sub">' + money(meta.cmr) + " сум</div></div>";
    html += "</div>";
    html += '<div class="kpi kpi-4">';
    html += '<div class="panel"><div class="lbl">Оплачено по заявкам</div><div class="num paid">' + money(ex.paid, true) + '</div><div class="sub">' + ex.nPaid + " заявки · " + money(ex.paid) + "</div></div>";
    html += '<div class="panel"><div class="lbl">В долгу</div><div class="num debt">' + money(ex.debt, true) + '</div><div class="sub">' + ex.nDebt + " в реестре · " + money(ex.debt) + "</div></div>";
    html += '<div class="panel"><div class="lbl">На подписи</div><div class="num est">' + money(ex.sign, true) + '</div><div class="sub">' + ex.nSign + " заявки · ещё не в долге</div></div>";
    html += '<div class="panel"><div class="lbl">Лифт ASERA · КП</div><div class="num paid">' + money(meta.liftSum, true) + '</div><div class="sub">оплачен · остановки 1–4</div></div>';
    html += "</div>";
    html += '<p class="legend"><span class="num exact">■ точная</span><span class="num est">■ примерная</span><span class="num paid">■ оплачено</span><span class="num debt">■ долг</span><span class="num cust">■ заказчик, салон</span></p>';
    if (AUTH.can("seeMoney")) html += '<p class="exclude">' + esc(meta.note) + "</p>";
    if (USER && USER.director) {
      html += '<p class="exclude">Временный просмотр для руководства · до ' + esc(meta.directorUntil || AUTH.directorUntil) + "</p>";
    }

    html += "<h2>Сейчас на объекте</h2>";
    html += '<div class="need-list">';
    (DATA.contracts || []).forEach(function (c) {
      html += '<div class="need">';
      html += '<a href="' + root + c.href + '">открыть</a>';
      html += "<strong>" + esc(c.name) + "</strong> ";
      html += pill(STAGE, c.stage) + " " + pill(PAY, c.pay, "pay") + prioTag(c);
      if (AUTH.can("seeMoney") && c.sum != null) {
        html += '<div class="muted" style="margin-top:6px"><span class="num ' + sumCls(c.pay === "advance" ? "none" : c.pay, !!c.exact) + '">' + som(c.sum) + "</span>";
        if (c.advanceSum) html += " · аванс " + som(c.advanceSum);
        html += " · " + esc(c.note) + "</div>";
      } else {
        html += '<div class="muted" style="margin-top:6px">' + esc(c.note) + "</div>";
      }
      html += "</div>";
    });
    html += "</div>";

    var exList = expenseTotals().items;
    if (exList.length && AUTH.can("seeMoney")) {
      html += '<h2>Заявки · расходы сейчас <a href="' + root + 'expenses.html" style="font-size:14px;font-family:var(--font-body);font-weight:400">все</a></h2>';
      html += '<div class="need-list">';
      exList.forEach(function (p) {
        html += '<div class="need">';
        html += "<strong>" + esc(p.num) + "</strong> " + expStatus(p) + prioTag(p);
        html += '<div class="muted" style="margin-top:6px">' + esc(p.name) + "</div>";
        html += '<div class="num ' + expSumCls(p.status) + '">' + som(p.sum);
        if (p.usd) html += " · $" + p.usd.toLocaleString("ru-RU");
        html += "</div>";
        html += '<div class="subtle">' + esc(p.date) + " · " + esc(p.entity) + " · " + esc(p.registry) + "</div>";
        html += "</div>";
      });
      html += "</div>";
    }

    html += "<h2>Этажи и зоны</h2><div class='grid'>";
    FLOOR_ORDER.forEach(function (slug) {
      var f = DATA.floors[slug];
      if (!f) return;
      var cover = (f.gallery && f.gallery[0]) ? f.gallery[0].src : "";
      html += '<a class="card" href="' + root + "floors/" + slug + '.html">';
      if (cover) html += '<img src="' + asset(cover) + '" alt="' + esc(f.name) + '"/>';
      html += '<div class="pad"><div class="subtle">' + esc(f.floorLabel) + "</div>";
      html += "<h3>" + esc(f.name) + "</h3>";
      html += '<p class="muted" style="font-size:14px">' + esc(f.blurb) + "</p>";
      if (f.tenant) {
        html += "<div class='stat'>Socials_uz</div><div class='subtle'>арендатор</div>";
      } else if (f.items && f.items.length) {
        html += "<div class='stat'>" + money(f.total, true) + "</div>";
        html += "<div class='subtle'>" + f.items.length + " позиций";
        if (AUTH.can("seeMoney") && f.estSum) html += ' · <span class="num est">оценка ' + money(f.estSum, true) + "</span>";
        if (f.issues && f.issues.length) html += " · " + f.issues.filter(function (x) { return x.open !== false; }).length + " вопросов";
        html += "</div>";
      } else {
        html += "<div class='subtle'>сметы нет — ждём файл</div>";
      }
      html += "</div></a>";
    });
    html += '<a class="card" href="' + root + 'lift.html">';
    html += '<img src="' + asset("assets/floors/lift/01.jpg") + '" alt="Лифт"/>';
    html += '<div class="pad"><div class="subtle">шахта + холл</div><h3>Лифт ASERA</h3>';
    html += '<p class="muted" style="font-size:14px">Остановки 1–2–3–4 · на фитнесе нет · КП оплачен</p>';
    html += "<div class='stat'>" + pill(PAY, "paid", "pay") + "</div></div></a>";
    html += "</div>";

    el.innerHTML = html;
    lightboxBind(el);
  }

  function renderFloor(el, slug) {
    var f = DATA.floors[slug];
    if (!f) { el.innerHTML = "<p>Нет этажа</p>"; return; }
    var html = '<p class="subtle">' + esc(f.floorLabel) + (f.rp ? " · " + esc(f.rp) : "") + "</p>";
    html += "<h1>" + esc(f.name) + "</h1>";
    html += '<p class="muted">' + esc(f.blurb) + "</p>";
    html += galleryHtml(f.gallery);
    if (f.tenant) {
      html += '<p class="muted">Позиций сметы БЦ нет — отделка у арендатора Socials_uz.</p>';
      el.innerHTML = html;
      lightboxBind(el);
      return;
    }
    html += moneyStrip(f);
    html += '<div class="chips" id="sec-chips"></div>';
    html += '<div id="sec-body"></div>';
    html += issuesHtml(f.issues);
    html += '<p class="legend"><span class="num exact">■ точная цифра</span><span class="num est">■ примерная оценка</span><span class="num paid">■ оплачено</span><span class="num debt">■ в долгу</span><span class="num cust">■ заявлено заказчиком</span><span class="qty-miss">■ нет количества</span></p>';
    el.innerHTML = html;
    lightboxBind(el);

    var hash = readHash();
    function paint() {
      var cur = hash.sec || "all";
      var chips = '<button type="button" class="chip' + (cur === "all" ? " on" : "") + '" data-sec="all">Все · ' + (f.items || []).length + "</button>";
      sectionList(f.items).forEach(function (s) {
        chips += '<button type="button" class="chip' + (cur === s.key ? " on" : "") + '" data-sec="' + esc(s.key) + '">' + esc(s.name);
        chips += " · " + s.n;
        if (AUTH.can("seeMoney") && s.sum) chips += " · " + money(s.sum, true);
        if (AUTH.can("seeMoney") && s.cust) chips += " + зак. " + money(s.cust, true);
        chips += "</button>";
      });
      $("#sec-chips", el).innerHTML = chips;
      $all("[data-sec]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          hash.sec = b.getAttribute("data-sec");
          writeHash(hash);
          paint();
        });
      });
      $("#sec-body", el).innerHTML = itemsTable(f.items || [], cur === "all" ? "" : cur);
      wireRowEdits($("#sec-body", el));
    }
    paint();
  }

  function renderLift(el) {
    var f = DATA.lift;
    if (!f) { el.innerHTML = "<p>Нет лифта</p>"; return; }
    var html = '<p class="subtle">' + esc(f.floorLabel) + "</p>";
    html += "<h1>" + esc(f.name) + "</h1>";
    html += '<p class="muted">' + esc(f.blurb) + "</p>";
    html += galleryHtml(f.gallery);
    html += itemsTable(f.items || []);
    html += issuesHtml(f.issues);
    html += '<p class="legend"><span class="num exact">■ точная сумма</span><span class="num est">■ предварительно</span></p>';
    el.innerHTML = html;
    lightboxBind(el);
    wireRowEdits(el);
  }

  function renderStatus(el) {
    var items = allItems();
    var hash = readHash();
    var html = '<p class="subtle">Рабочая доска</p><h1>Статусы</h1>';
    html += '<p class="muted">Стадия работ и статус заявки. Зелёная сумма — точная, оранжевая — предварительно.</p>';
    html += '<div class="banner" data-dirty-banner><span data-dirty-msg></span><span>';
    if (AUTH.can("export")) html += '<button type="button" class="btn primary" data-publish>Опубликовать на сервер</button> ';
    if (AUTH.can("export")) html += '<button type="button" class="btn" data-dl-status>Скачать status.js</button> ';
    if (AUTH.can("import")) html += '<label class="btn">Загрузить status.js<input type="file" accept=".js,.json" data-ul-status hidden></label> ';
    if (AUTH.can("export")) html += '<button type="button" class="btn" data-reset-status>Сбросить локальные</button>';
    html += "</span></div>";
    html += '<div class="toolbar"><input type="search" id="q" placeholder="Поиск ID или названия" style="flex:1;min-width:180px"/>';
    html += '<div class="chips" id="chips"></div></div>';
    html += '<div class="table-wrap" style="margin-top:14px"><table><thead><tr>';
    html += "<th>ID</th><th>Зона</th><th>Позиция</th>";
    if (AUTH.can("seeMoney")) html += "<th>Сумма</th>";
    html += "<th>Стадия</th><th>Заявка</th></tr></thead><tbody id='tbody'></tbody></table></div>";
    el.innerHTML = html;
    wireStatusTools(el);

    function paint() {
      var q = ($("#q", el).value || "").toLowerCase();
      var ch = "";
      [{ v: "all", t: "все" }].concat(FLOOR_ORDER.concat(["lift"]).map(function (s) {
        return { v: s, t: FLOOR_TITLE[s] };
      })).forEach(function (a) {
        ch += '<button type="button" class="chip' + ((hash.floor || "all") === a.v ? " on" : "") + '" data-floor="' + a.v + '">' + esc(a.t) + "</button>";
      });
      $("#chips", el).innerHTML = ch;
      $all("[data-floor]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          hash.floor = b.getAttribute("data-floor");
          writeHash(hash);
          paint();
        });
      });
      var body = "";
      items.filter(function (it) {
        if (hash.floor && hash.floor !== "all" && it.floor !== hash.floor) return false;
        if (q) {
          var blob = (it.id + " " + it.name + " " + (it.spec || "")).toLowerCase();
          if (blob.indexOf(q) === -1) return false;
        }
        return true;
      }).forEach(function (it) {
        var st = statusOf(it.id);
        body += '<tr class="' + (isDirty(it.id) ? "dirty " : "") + (it.noPrice ? "noprice" : "") + '" data-id="' + esc(it.id) + '">';
        body += '<td class="id" data-th="ID">' + esc(it.id) + "</td>";
        body += "<td data-th='Зона'>" + esc(FLOOR_TITLE[it.floor] || it.floor) + "</td>";
        body += '<td class="name" data-th="Позиция">' + esc(it.name) + "</td>";
        if (AUTH.can("seeMoney")) body += '<td data-th="Сумма">' + moneyCell(it) + "</td>";
        body += "<td data-th='Стадия'>" + sel(STAGE, "stage", it.id, st.stage) + "</td>";
        body += "<td data-th='Заявка'>" + sel(PAY, "pay", it.id, st.pay) + "</td>";
        body += "</tr>";
      });
      $("#tbody", el).innerHTML = body || '<tr><td colspan="6" class="muted">Ничего не попало в фильтр</td></tr>';
      wireRowEdits(el);
    }
    $("#q", el).addEventListener("input", paint);
    paint();
    renderBanner();
  }

  function renderWorks(el) {
    if (!WORKS) { el.innerHTML = "<p>Нет works.js</p>"; return; }
    var hash = readHash();
    var cur = hash.sec || "overview";
    var html = '<p class="subtle">СМР здания · 11.09.2026</p><h1>Здание</h1>';
    html += '<p class="muted">' + esc(WORKS.meta.note) + "</p>";
    if (AUTH.can("seeMoney")) {
      html += '<div class="kpi">';
      html += '<div class="panel"><div class="lbl">Начислено</div><div class="num exact">' + money(WORKS.meta.accrued, true) + '</div><div class="sub">' + money(WORKS.meta.accrued) + " сум</div></div>";
      html += '<div class="panel"><div class="lbl">Оплачено</div><div class="num paid">' + money(WORKS.meta.paid, true) + '</div><div class="sub">' + money(WORKS.meta.paid) + " сум</div></div>";
      html += '<div class="panel"><div class="lbl">В долгах</div><div class="num debt">' + money(WORKS.meta.queued, true) + '</div><div class="sub">' + money(WORKS.meta.queued) + " сум</div></div>";
      html += "</div>";
    }
    html += '<div class="chips" id="wchips"></div><div id="wbody"></div>';
    el.innerHTML = html;

    function paint() {
      var chips = [{ v: "overview", t: "Сводка" }, { v: "pay", t: "Реестр" }];
      (WORKS.sections || []).forEach(function (s) { chips.push({ v: s.slug, t: s.name }); });
      var ch = "";
      chips.forEach(function (c) {
        ch += '<button type="button" class="chip' + (cur === c.v ? " on" : "") + '" data-sec="' + c.v + '">' + esc(c.t) + "</button>";
      });
      $("#wchips", el).innerHTML = ch;
      $all("[data-sec]", el).forEach(function (b) {
        b.addEventListener("click", function () { cur = b.getAttribute("data-sec"); writeHash({ sec: cur }); paint(); });
      });
      var body = "";
      if (cur === "overview") {
        body += '<div class="table-wrap"><table><thead><tr><th>Раздел</th><th>Позиций</th>' + (AUTH.can("seeMoney") ? "<th>Сумма</th>" : "") + "</tr></thead><tbody>";
        (WORKS.sections || []).forEach(function (s) {
          var tot = s.total != null ? s.total : s.items.reduce(function (a, it) { return a + (Number(it.sum) || 0); }, 0);
          body += "<tr><td data-th='Раздел'><a href='#" + s.slug + "' data-jump='" + s.slug + "'>" + esc(s.name) + "</a></td>";
          body += "<td data-th='Позиций'>" + s.items.length + "</td>";
          if (AUTH.can("seeMoney")) body += '<td class="num exact" data-th="Сумма">' + money(tot) + "</td>";
          body += "</tr>";
        });
        body += "</tbody></table></div>";
      } else if (cur === "pay") {
        var src = (EXPENSES && EXPENSES.items) || WORKS.payments || [];
        body += '<div class="table-wrap"><table><thead><tr><th>Заявка</th><th>Назначение</th>' + (AUTH.can("seeMoney") ? "<th>Сумма</th>" : "") + "<th>Статус</th></tr></thead><tbody>";
        src.forEach(function (p) {
          body += "<tr><td class='id' data-th='Заявка'>" + esc(p.num) + "</td>";
          body += "<td data-th='Назначение'>" + esc(p.name) + "</td>";
          if (AUTH.can("seeMoney")) body += '<td class="num ' + expSumCls(p.status) + '" data-th="Сумма">' + (p.usd ? money(p.sum) + " · $" + p.usd.toLocaleString("ru-RU") : money(p.sum)) + "</td>";
          body += "<td data-th='Статус'>" + expStatus(p) + prioTag(p) + "</td></tr>";
        });
        body += "</tbody></table></div>";
      } else {
        var sec = null;
        (WORKS.sections || []).forEach(function (s) { if (s.slug === cur) sec = s; });
        if (!sec) body = "<p>Нет раздела</p>";
        else {
          var tot = sec.total != null ? sec.total : 0;
          body += "<h2>" + esc(sec.name) + (AUTH.can("seeMoney") ? " · " + money(tot, true) : "") + "</h2>";
          body += '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Позиция</th>' + (AUTH.can("seeMoney") ? "<th>Сумма</th>" : "") + "<th>Заявка</th></tr></thead><tbody>";
          sec.items.forEach(function (it) {
            body += "<tr><td class='id' data-th='ID'>" + esc(it.id) + "</td>";
            body += "<td data-th='Позиция'>" + esc(it.name) + "</td>";
            if (AUTH.can("seeMoney")) {
              var pay = it.procurement === "paid" ? "paid" : it.procurement === "advance" ? "advance" : (it.procurement === "declared" ? "debt" : "none");
              var cls = it.procurement === "paid" ? "paid" : (it.sum ? "exact" : "est");
              body += '<td class="num ' + cls + '" data-th="Сумма">' + (it.noPrice || !it.sum ? "—" : money(it.sum)) + "</td>";
              body += "<td data-th='Заявка'>" + pill(PAY, pay, "pay") + "</td></tr>";
            } else {
              var pay2 = it.procurement === "paid" ? "paid" : it.procurement === "advance" ? "advance" : (it.procurement === "declared" ? "debt" : "none");
              body += "<td data-th='Заявка'>" + pill(PAY, pay2, "pay") + "</td></tr>";
            }
          });
          body += "</tbody></table></div>";
        }
      }
      $("#wbody", el).innerHTML = body;
      $all("[data-jump]", el).forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          cur = a.getAttribute("data-jump");
          writeHash({ sec: cur });
          paint();
        });
      });
    }
    if (location.hash && location.hash.indexOf("sec=") === -1) {
      var slug = location.hash.replace(/^#/, "");
      (WORKS.sections || []).forEach(function (s) { if (s.slug === slug) cur = slug; });
    }
    paint();
  }

  function renderDocs(el) {
    var DOCS = window.EDIFICE_DOCS;
    if (!DOCS) { el.innerHTML = "<p>Нет docs.js</p>"; return; }
    var STAT = [
      ["yes", "Есть"],
      ["work", "В работе"],
      ["no", "Нет"]
    ];
    var items = DOCS.items || [];
    var yes = items.filter(function (d) { return d.status === "yes"; }).length;
    var no = items.filter(function (d) { return d.status === "no"; }).length;
    var work = items.filter(function (d) { return d.status === "work"; }).length;
    var html = '<p class="subtle">Реестр по объекту</p><h1>Документация</h1>';
    html += '<p class="muted">' + esc(DOCS.note) + "</p>";
    html += '<div class="kpi kpi-4">';
    html += '<div class="panel"><div class="lbl">Известные затраты</div><div class="num exact">' + money(DOCS.total, true) + '</div><div class="sub">' + money(DOCS.total) + " сум</div></div>";
    html += '<div class="panel"><div class="lbl">Есть</div><div class="num exact">' + yes + '</div><div class="sub">из ' + items.length + "</div></div>";
    html += '<div class="panel"><div class="lbl">В работе</div><div class="num est">' + work + '</div><div class="sub">архитектура, шахта</div></div>';
    html += '<div class="panel"><div class="lbl">Нет</div><div class="num debt">' + no + '</div><div class="sub">СМР, МЧС, СЭС, ТУ</div></div>';
    html += "</div>";
    html += '<div class="chips" id="dchips"></div><div id="dbody"></div>';
    el.innerHTML = html;

    var groups = [];
    items.forEach(function (d) {
      if (groups.indexOf(d.group) < 0) groups.push(d.group);
    });
    var cur = "all";
    function paint() {
      var ch = '<button type="button" class="chip' + (cur === "all" ? " on" : "") + '" data-g="all">Все · ' + items.length + "</button>";
      groups.forEach(function (g) {
        var n = items.filter(function (d) { return d.group === g; }).length;
        ch += '<button type="button" class="chip' + (cur === g ? " on" : "") + '" data-g="' + esc(g) + '">' + esc(g) + " · " + n + "</button>";
      });
      $("#dchips", el).innerHTML = ch;
      $all("[data-g]", el).forEach(function (b) {
        b.addEventListener("click", function () { cur = b.getAttribute("data-g"); paint(); });
      });
      var rows = items.filter(function (d) { return cur === "all" || d.group === cur; });
      var body = '<div class="need-list">';
      rows.forEach(function (d) {
        body += '<div class="need">';
        body += "<strong>" + esc(d.id) + " · " + esc(d.title) + "</strong> ";
        body += '<span class="pill doc-' + d.status + '"><i></i>' + esc((STAT.filter(function (s) { return s[0] === d.status; })[0] || [d.status, d.status])[1]) + "</span>";
        if (d.until) body += '<span class="subtle"> до ' + esc(d.until) + "</span>";
        body += '<div class="muted" style="margin-top:6px">' + esc(d.group);
        if (d.ref && d.ref !== "—") body += " · " + esc(d.ref);
        if (d.who && d.who !== "—") body += " · " + esc(d.who);
        body += "</div>";
        if (AUTH.can("seeMoney") && d.sum) {
          body += '<div class="num exact" style="margin-top:4px">' + som(d.sum) + "</div>";
        }
        if (d.basis) body += '<div class="subtle">' + esc(d.basis) + "</div>";
        if (d.risk) body += '<div class="muted" style="margin-top:6px">' + esc(d.risk) + "</div>";
        if (d.file) body += '<div class="subtle">файл: ' + esc(d.file) + "</div>";
        body += "</div>";
      });
      $("#dbody", el).innerHTML = body + "</div>";
    }
    paint();
  }

  function renderExpenses(el) {
    var ex = expenseTotals();
    var html = '<p class="subtle">Заявки 1С</p><h1>Расходы</h1>';
    html += '<p class="muted">' + esc((EXPENSES && EXPENSES.note) || "") + "</p>";
    html += '<div class="kpi kpi-4">';
    html += '<div class="panel"><div class="lbl">Оплачено</div><div class="num paid">' + money(ex.paid, true) + '</div><div class="sub">' + ex.nPaid + " · " + money(ex.paid) + "</div></div>";
    html += '<div class="panel"><div class="lbl">В долгу</div><div class="num debt">' + money(ex.debt, true) + '</div><div class="sub">' + ex.nDebt + " в реестре</div></div>";
    html += '<div class="panel"><div class="lbl">На подписи</div><div class="num est">' + money(ex.sign, true) + '</div><div class="sub">' + ex.nSign + " · не в долге</div></div>";
    html += '<div class="panel"><div class="lbl">Всего заявок</div><div class="num">' + ex.items.length + '</div><div class="sub">срез ' + esc((EXPENSES && EXPENSES.updated) || "") + "</div></div>";
    html += "</div>";
    html += '<div class="chips" id="echips"></div><div id="ebody"></div>';
    el.innerHTML = html;
    var cur = "all";
    function paint() {
      var chips = [
        ["all", "Все · " + ex.items.length],
        ["prio", "Приоритет · " + ex.items.filter(function (p) { return p.priority; }).length],
        ["sign", "На подписи · " + ex.nSign],
        ["debt", "В долгу · " + ex.nDebt],
        ["paid", "Оплачено · " + ex.nPaid]
      ];
      var ch = "";
      chips.forEach(function (c) {
        ch += '<button type="button" class="chip' + (cur === c[0] ? " on" : "") + '" data-st="' + c[0] + '">' + esc(c[1]) + "</button>";
      });
      $("#echips", el).innerHTML = ch;
      $all("[data-st]", el).forEach(function (b) {
        b.addEventListener("click", function () { cur = b.getAttribute("data-st"); paint(); });
      });
      var rows = ex.items.filter(function (p) { return cur === "all" || (cur === "prio" ? p.priority : p.status === cur); });
      var body = '<div class="need-list">';
      rows.forEach(function (p) {
        body += '<div class="need">';
        body += "<strong>" + esc(p.num) + " · " + esc(p.name) + "</strong> " + expStatus(p) + prioTag(p);
        body += '<div class="muted" style="margin-top:6px">' + esc(p.entity) + " · " + esc(p.date);
        if (p.who) body += " · " + esc(p.who);
        body += "</div>";
        if (AUTH.can("seeMoney")) {
          body += '<div class="num ' + expSumCls(p.status) + '" style="margin-top:4px">' + som(p.sum);
          if (p.usd) body += " · $" + p.usd.toLocaleString("ru-RU") + " (курс " + (EXPENSES.rateUsd || "").toLocaleString("ru-RU") + ")";
          body += "</div>";
        }
        body += '<div class="subtle">' + esc(p.registry);
        if (p.doc) body += " · " + esc(p.doc);
        body += "</div></div>";
      });
      $("#ebody", el).innerHTML = body + "</div>";
    }
    paint();
  }

  function route() {
    wireNav();
    var app = $("#app");
    if (!app) return;
    if (page === "index") renderIndex(app);
    else if (page === "floor") renderFloor(app, pageFloor);
    else if (page === "lift") renderLift(app);
    else if (page === "status") renderStatus(app);
    else if (page === "works") renderWorks(app);
    else if (page === "docs") renderDocs(app);
    else if (page === "expenses") renderExpenses(app);
    else if (page === "model") { /* сцену рисует assets/model.js */ }
    else {
      app.innerHTML = '<p class="muted">Страница снята. <a href="' + root + 'index.html">На смету</a></p>';
    }
    renderBanner();
    try { document.dispatchEvent(new CustomEvent("edifice:route")); } catch (e) {}
  }

  loadRemoteOverlay().then(route);
  }

  if (window.EDIFICE_DATA_WAIT) window.EDIFICE_DATA_WAIT.then(boot).catch(function () {
    document.body.innerHTML = "<p style='padding:24px'>Нет data.js</p>";
  });
  else boot();
})();
