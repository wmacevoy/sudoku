// Simple deterministic PRNG helpers shared by the app.
// cyrb128 hashes a string seed into four 32-bit integers;
// sfc32 uses those integers to produce a repeatable RNG.
export function cyrb128(str) {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = (h2 ^ Math.imul(h1 ^ k, 597399067)) >>> 0;
    h2 = (h3 ^ Math.imul(h2 ^ k, 2869860233)) >>> 0;
    h3 = (h4 ^ Math.imul(h3 ^ k, 951274213)) >>> 0;
    h4 = (h1 ^ Math.imul(h4 ^ k, 2716044179)) >>> 0;
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067) >>> 0;
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233) >>> 0;
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213) >>> 0;
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179) >>> 0;
  return [h1, h2, h3, h4];
}

export function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) | 0;
    b >>>= 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    d = (d + 1) | 0;
    d >>>= 0;
    t = (t + d) | 0;
    t >>>= 0;
    c = (c + t) | 0;
    c >>>= 0;
    return (t >>> 0) / 4294967296;
  };
}

export function rngFromSeed(seed) {
  const [a, b, c, d] = cyrb128(String(seed));
  return sfc32(a, b, c, d);
}
