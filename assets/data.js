(function (g) {
  "use strict";
  var root = ((document.body && document.body.getAttribute("data-root")) || "") + "assets/";
  var DATA_FILES = ["d0.txt", "d1.txt", "d2.txt", "d3.txt", "d4.txt", "d5.txt", "d6.txt", "d7.txt"];
  var WORK_FILES = ["w0.txt", "w1.txt"];
  var STATUS_FILES = ["s0.txt"];
  var APP_FILES = ["a0.txt", "a1.txt", "a2.txt"];
  function get(u) {
    return fetch(root + u, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(u);
      return r.text();
    });
  }
  function hexToU8(s) {
    s = String(s).replace(/\s+/g, "");
    var n = s.length >> 1, u8 = new Uint8Array(n), i;
    for (i = 0; i < n; i++) u8[i] = parseInt(s.substr(i << 1, 2), 16);
    return u8;
  }
  function inflateHex(hex) {
    return new Response(new Blob([hexToU8(hex)]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  function fail(e) {
    var el = document.getElementById("app");
    if (el) el.textContent = "Smeta load failed. Refresh.";
    throw e;
  }
  var all = DATA_FILES.concat(WORK_FILES, STATUS_FILES, APP_FILES);
  g.EDIFICE_DATA_WAIT = Promise.all(all.map(get)).then(function (parts) {
    var i = 0;
    var d = parts.slice(i, i += DATA_FILES.length).join("");
    var w = parts.slice(i, i += WORK_FILES.length).join("");
    var s = parts.slice(i, i += STATUS_FILES.length).join("");
    var a = parts.slice(i, i += APP_FILES.length).join("");
    return inflateHex(d).then(function (t) {
      g.EDIFICE_DATA = JSON.parse(t);
      return Promise.all([inflateHex(w), inflateHex(s), inflateHex(a)]);
    }).then(function (codes) {
      (0, eval)(codes[0]);
      (0, eval)(codes[1]);
      (0, eval)(codes[2]);
    });
  }).catch(fail);
})(window);
