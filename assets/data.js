(function (g) {
  "use strict";
  var root = ((document.body && document.body.getAttribute("data-root")) || "") + "assets/";
  function get(u) {
    return fetch(u, { cache: "force-cache" }).then(function (r) {
      if (!r.ok) throw new Error(u);
      return r.text();
    });
  }
  function b64ToU8(s) {
    var bin = atob(s), n = bin.length, u8 = new Uint8Array(n), i;
    for (i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  function inflate(b64) {
    return new Response(new Blob([b64ToU8(b64)]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  g.EDIFICE_DATA_WAIT = Promise.all([
    get(root + "data-0.txt"),
    get(root + "data-1.txt"),
    get(root + "data-2.txt"),
    get(root + "works.txt"),
    get(root + "status.txt"),
    get(root + "app.txt")
  ]).then(function (parts) {
    return inflate(parts[0] + parts[1] + parts[2]).then(function (t) {
      g.EDIFICE_DATA = JSON.parse(t);
      return Promise.all([inflate(parts[3]), inflate(parts[4]), inflate(parts[5])]);
    }).then(function (codes) {
      (0, eval)(codes[0]);
      (0, eval)(codes[1]);
      (0, eval)(codes[2]);
    });
  });
})(window);
