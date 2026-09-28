/* SecondLook — a small, dependency-free QR code encoder (byte mode, ISO/IEC 18004).
 * Follows the structure of Project Nayuki's reference implementation (MIT).
 * Used to share the contact link without any CDN or network call. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLQR = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ECL = { L: 0, M: 1, Q: 2, H: 3 };
  var FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H
  var ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];
  var NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

  function rawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }
  function dataCodewords(ver, ecl) {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
  }

  // ---- Reed–Solomon over GF(2^8) with polynomial 0x11D ----
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (var i2 = 0; i2 < degree; i2++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  function utf8Bytes(text) {
    var s = unescape(encodeURIComponent(text)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  /** Encode text → { size, modules: boolean[size][size], version, mask } */
  function encode(text, eclName) {
    var ecl = ECL[eclName || 'M'];
    var bytes = utf8Bytes(text);
    var ver, capacityBits, countBits;
    for (ver = 1; ver <= 40; ver++) {
      countBits = ver <= 9 ? 8 : 16;
      capacityBits = dataCodewords(ver, ecl) * 8;
      if (4 + countBits + bytes.length * 8 <= capacityBits) break;
    }
    if (ver > 40) throw new Error('Text too long for a QR code');

    // bit stream
    var bits = [];
    function append(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    append(4, 4);                       // byte mode
    append(bytes.length, countBits);
    bytes.forEach(function (b) { append(b, 8); });
    append(0, Math.min(4, capacityBits - bits.length));
    append(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capacityBits; pad ^= 0xEC ^ 0x11) append(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }

    // error correction + interleave
    var numBlocks = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver];
    var rawCodewords = Math.floor(rawDataModules(ver) / 8);
    var numShort = numBlocks - rawCodewords % numBlocks;
    var shortLen = Math.floor(rawCodewords / numBlocks);
    var divisor = rsDivisor(eccLen), blocks = [], k = 0;
    for (var b = 0; b < numBlocks; b++) {
      var dat = data.slice(k, k + shortLen - eccLen + (b < numShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, divisor);
      if (b < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var codewords = [];
    for (var c = 0; c < blocks[0].length; c++) {
      for (var bl = 0; bl < blocks.length; bl++) {
        if (c !== shortLen - eccLen || bl >= numShort) codewords.push(blocks[bl][c]);
      }
    }

    // matrix
    var size = ver * 4 + 17;
    var modules = [], isFn = [];
    for (var y = 0; y < size; y++) { modules.push(new Array(size).fill(false)); isFn.push(new Array(size).fill(false)); }
    function setFn(x, y, dark) { modules[y][x] = dark; isFn[y][x] = true; }

    for (var t = 0; t < size; t++) { setFn(6, t, t % 2 === 0); setFn(t, 6, t % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (p) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = p[0] + dx, yy = p[1] + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
      }
    });
    var align = [];
    if (ver > 1) {
      var numAlign = Math.floor(ver / 7) + 2;
      var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
      align = [6];
      for (var pos = size - 7; align.length < numAlign; pos -= step) align.splice(1, 0, pos);
    }
    for (var ai = 0; ai < align.length; ai++) for (var aj = 0; aj < align.length; aj++) {
      var last = align.length - 1;
      if ((ai === 0 && aj === 0) || (ai === 0 && aj === last) || (ai === last && aj === 0)) continue;
      for (var ady = -2; ady <= 2; ady++) for (var adx = -2; adx <= 2; adx++) {
        setFn(align[ai] + adx, align[aj] + ady, Math.max(Math.abs(adx), Math.abs(ady)) !== 1);
      }
    }
    function drawFormat(mask) {
      var d = FORMAT_BITS[ecl] << 3 | mask, rem = d;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var fb = (d << 10 | rem) ^ 0x5412;
      for (var i1 = 0; i1 <= 5; i1++) setFn(8, i1, getBit(fb, i1));
      setFn(8, 7, getBit(fb, 6)); setFn(8, 8, getBit(fb, 7)); setFn(7, 8, getBit(fb, 8));
      for (var i2 = 9; i2 < 15; i2++) setFn(14 - i2, 8, getBit(fb, i2));
      for (var i3 = 0; i3 < 8; i3++) setFn(size - 1 - i3, 8, getBit(fb, i3));
      for (var i4 = 8; i4 < 15; i4++) setFn(8, size - 15 + i4, getBit(fb, i4));
      setFn(8, size - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var vrem = ver;
      for (var vi = 0; vi < 12; vi++) vrem = (vrem << 1) ^ ((vrem >>> 11) * 0x1F25);
      var vbits = ver << 12 | vrem;
      for (var vj = 0; vj < 18; vj++) {
        var bit = getBit(vbits, vj), a = size - 11 + vj % 3, bb = Math.floor(vj / 3);
        setFn(a, bb, bit); setFn(bb, a, bit);
      }
    }

    // data
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var jj = 0; jj < 2; jj++) {
          var x = right - jj, upward = ((right + 1) & 2) === 0;
          var yy2 = upward ? size - 1 - vert : vert;
          if (!isFn[yy2][x] && idx < codewords.length * 8) {
            modules[yy2][x] = getBit(codewords[idx >>> 3], 7 - (idx & 7));
            idx++;
          }
        }
      }
    }

    function applyMask(mask) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var inv;
        switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (!isFn[y][x] && inv) modules[y][x] = !modules[y][x];
      }
    }
    function penalty() {
      var score = 0, dark = 0, lines = [];
      for (var y = 0; y < size; y++) {
        var row = '', col = '';
        for (var x = 0; x < size; x++) {
          row += modules[y][x] ? '1' : '0';
          col += modules[x][y] ? '1' : '0';
          if (modules[y][x]) dark++;
        }
        lines.push(row, col);
      }
      lines.forEach(function (line) {
        var runs = line.match(/0+|1+/g) || [];
        runs.forEach(function (r) { if (r.length >= 5) score += 3 + r.length - 5; });
        var padded = '0000' + line + '0000', re = /(?=(10111010000|00001011101))/g;
        while (re.exec(padded)) { score += 40; re.lastIndex++; }
      });
      for (var y2 = 0; y2 < size - 1; y2++) for (var x2 = 0; x2 < size - 1; x2++) {
        var cc = modules[y2][x2];
        if (cc === modules[y2][x2 + 1] && cc === modules[y2 + 1][x2] && cc === modules[y2 + 1][x2 + 1]) score += 3;
      }
      var total = size * size;
      score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return score;
    }

    var best = 0, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      var sc = penalty();
      if (sc < bestScore) { best = m; bestScore = sc; }
      applyMask(m); // undo (XOR)
    }
    applyMask(best); drawFormat(best);
    return { size: size, modules: modules, version: ver, mask: best };
  }

  /** SVG markup with a 4-module quiet zone. Colours default to dark-on-white for scanners. */
  function toSvg(text, opts) {
    opts = opts || {};
    var qr = encode(text, opts.ecl || 'M');
    var n = qr.size + 8, d = '';
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) d += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"' +
      (opts.label ? ' role="img" aria-label="' + String(opts.label).replace(/[&<>"]/g, '') + '"' : ' aria-hidden="true"') + '>' +
      '<rect width="' + n + '" height="' + n + '" fill="' + (opts.light || '#ffffff') + '"/>' +
      '<path d="' + d + '" fill="' + (opts.dark || '#000000') + '"/></svg>';
  }

  return { encode: encode, toSvg: toSvg };
});
