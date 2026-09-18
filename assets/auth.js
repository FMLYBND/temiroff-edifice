/* Temiroff Edifice — роли. Это разграничение ответственности, не защита.
   Пароли в файле не хранятся: только SHA-256(пароль + соль). */
(function (global) {
  "use strict";

  var OPEN = true;
  var OPEN_USER = { login: "Open", role: "observer", name: "Просмотр", open: true };

  var DIR_TOKEN = "ra-navoi-2026";
  var DIR_UNTIL = Date.parse("2026-09-25T00:00:00+05:00");
  var DIR_USER = { login: "Observer", role: "observer", name: "Директор", director: true };

  var SALT = "temiroff-edifice-2026";
  var SESSION_KEY = "edifice-session";
  var DAY = 24 * 60 * 60 * 1000;

  var USERS = [
    { login: "Temirbek", role: "admin",    name: "Генеральный директор", hash: "88ce4396b288a2c447670c947f319a55fdf6bf88af35c78155d59e002bc8c6cd" },
    { login: "Roman",    role: "manager",  name: "Директор",             hash: "efab0ece7794aa87ba2e62ccabbe849f101ee76bc3c4818190a9f4b9710adc24" },
    { login: "Sherzod",  role: "manager",  name: "Инженер",              hash: "cb67d1b9ef8f23d5a6e6da20469c55e5f8158a4112a4954f0e9eeada8cd814b9" },
    { login: "Observer", role: "observer", name: "Наблюдатель",          hash: "4c901a248c6cd8e5f8a7b906672b1137dfe1960baf637c4b3e6e33abc0b579a8" },
    { login: "Guest",    role: "guest",    name: "Гость",                hash: "940c720f3cf8ef91517c6f120407ada699e219c29ad24f7b5aa76fe531399a6f" }
  ];

  global.EDIFICE_AUTH = { salt: SALT, open: OPEN, users: USERS.map(function (u) {
    return { login: u.login, role: u.role, name: u.name, hash: u.hash };
  }) };

  function toHex(buf) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var s = "";
    for (var i = 0; i < u8.length; i++) s += (u8[i] + 256).toString(16).slice(1);
    return s;
  }

  function sha256js(ascii) {
    function rrot(x, n) { return (x >>> n) | (x << (32 - n)); }
    var maxW = Math.pow(2, 32);
    var k = [], i, j;
    var primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311];
    for (i = 0; i < 64; i++) k[i] = Math.floor(Math.pow(primes[i], 1 / 3) * maxW);
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var bytes = [];
    for (i = 0; i < ascii.length; i++) bytes.push(ascii.charCodeAt(i) & 0xff);
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);
    for (j = 0; j < bytes.length; j += 64) {
      var w = [];
      for (i = 0; i < 16; i++) {
        w[i] = (bytes[j + i * 4] << 24) | (bytes[j + i * 4 + 1] << 16) | (bytes[j + i * 4 + 2] << 8) | bytes[j + i * 4 + 3];
      }
      for (i = 16; i < 64; i++) {
        var s0 = rrot(w[i - 15], 7) ^ rrot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rrot(w[i - 2], 17) ^ rrot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (i = 0; i < 64; i++) {
        var S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
        var S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map(function (x) {
      return ("00000000" + (x >>> 0).toString(16)).slice(-8);
    }).join("");
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
      else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return new Uint8Array(out);
  }

  function hashPassword(password) {
    var payload = String(password || "") + SALT;
    if (global.crypto && crypto.subtle && typeof TextEncoder !== "undefined") {
      return crypto.subtle.digest("SHA-256", utf8Bytes(payload)).then(function (buf) {
        return toHex(buf);
      }).catch(function () {
        return sha256js(payload);
      });
    }
    return Promise.resolve(sha256js(payload));
  }

  function findUser(login) {
    for (var i = 0; i < USERS.length; i++) if (USERS[i].login === login) return USERS[i];
    return null;
  }

  function readSession() {
    var raw = null;
    try { raw = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!raw) {
      try { raw = localStorage.getItem(SESSION_KEY); } catch (e) {}
    }
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || !s.login || !s.role) return null;
      if (s.expires && Date.now() > s.expires) {
        clearSession();
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function writeSession(s, remember) {
    var body = JSON.stringify(s);
    try { sessionStorage.setItem(SESSION_KEY, body); } catch (e) {}
    try {
      if (remember) localStorage.setItem(SESSION_KEY, body);
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function pageRoot() {
    var b = document.body;
    return (b && b.getAttribute("data-root")) || "";
  }

  function loginUrl() {
    return pageRoot() + "login.html";
  }

  function current() {
    var s = readSession();
    if (s && s.role && s.role !== "guest") return s;
    if (OPEN) return OPEN_USER;
    tryDirectorToken();
    return readSession();
  }

  function tokenFromUrl() {
    try {
      var q = new URLSearchParams(location.search || "");
      var t = q.get("t") || "";
      if (!t && location.hash) t = String(location.hash).replace(/^#/, "");
      return t;
    } catch (e) { return ""; }
  }

  function directorExpired() {
    return Date.now() > DIR_UNTIL;
  }

  function tryDirectorToken() {
    var t = tokenFromUrl();
    if (t !== DIR_TOKEN) return false;
    if (directorExpired()) return false;
    var s = readSession();
    if (s && s.director) return true;
    writeSession({
      login: DIR_USER.login,
      role: DIR_USER.role,
      name: DIR_USER.name,
      director: true,
      expires: DIR_UNTIL
    }, true);
    return true;
  }

  function enterDirector(token) {
    if (token && token !== DIR_TOKEN) return { ok: false, error: "Ссылка недействительна" };
    if (directorExpired()) return { ok: false, error: "Срок просмотра истёк" };
    writeSession({
      login: DIR_USER.login,
      role: DIR_USER.role,
      name: DIR_USER.name,
      director: true,
      expires: DIR_UNTIL
    }, true);
    return { ok: true, session: DIR_USER };
  }

  function requireSession() {
    var s = current();
    if (s) return s;
    var parts = (location.pathname || "").split("/");
    var file = parts.pop() || "index.html";
    if (file === "login.html" || file === "director.html") return null;
    var parent = parts.pop() || "";
    var rel = (parent === "floors" ? "floors/" : "") + file + (location.hash || "");
    location.replace(loginUrl() + "?next=" + encodeURIComponent(rel));
    return null;
  }

  function login(loginName, password, remember) {
    var user = findUser(loginName);
    return hashPassword(password).then(function (hex) {
      return new Promise(function (resolve) {
        var ok = user && hex === user.hash;
        var wait = ok ? 0 : 500;
        setTimeout(function () {
          if (!ok) {
            resolve({ ok: false, error: "Неверный пароль" });
            return;
          }
          var sess = {
            login: user.login,
            role: user.role,
            name: user.name,
            expires: remember ? Date.now() + 30 * DAY : Date.now() + 12 * 60 * 60 * 1000
          };
          writeSession(sess, !!remember);
          resolve({ ok: true, session: sess });
        }, wait);
      });
    });
  }

  function logout() {
    clearSession();
    if (OPEN) {
      location.replace(pageRoot() + "index.html");
      return;
    }
    location.replace(loginUrl());
  }

  function can(action) {
    var s = current();
    var role = s ? s.role : "";
    if (action === "seeMoney") return role === "admin" || role === "manager" || role === "observer";
    if (action === "seePending") return role === "admin" || role === "manager" || role === "observer";
    if (action === "seeLog") return role === "admin" || role === "manager";
    if (action === "editStatus") return role === "admin";
    if (action === "editPaid") return role === "admin";
    if (action === "setPriority") return role === "admin" || role === "manager";
    if (action === "setFinal") return role === "admin";
    if (action === "export") return role === "admin" || role === "manager";
    if (action === "import") return role === "admin";
    return false;
  }

  function trackKey() {
    var s = current();
    if (!s) return null;
    if (s.login === "Roman") return "roman";
    if (s.login === "Sherzod") return "sherzod";
    return null;
  }

  global.EdificeAuth = {
    open: OPEN,
    enterDirector: enterDirector,
    directorToken: DIR_TOKEN,
    directorUntil: "24.09.2026",
    directorExpired: directorExpired,
    users: USERS.map(function (u) { return { login: u.login, name: u.name, role: u.role }; }),
    hashPassword: hashPassword,
    current: current,
    require: requireSession,
    login: login,
    logout: logout,
    can: can,
    trackKey: trackKey,
    sha256js: sha256js
  };
})(window);
