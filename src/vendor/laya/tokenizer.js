const CHECKPOINT_IDS = { cls: 50281, sep: 50282, mask: 50284, pad: 50283, unk: 50280 };
const SPECIAL_ALIASES = {
  cls: ["[CLS]", "<bos>", "<s>"],
  sep: ["[SEP]", "<eos>", "</s>"],
  pad: ["[PAD]", "<pad>"],
  mask: ["[MASK]", "<mask>"],
  unk: ["[UNK]", "<unk>"]
};
const METASPACE_REPLACEMENT = "\u2581";
function byteUnicodeMaps() {
  const b2u = /* @__PURE__ */ new Map();
  const u2b = /* @__PURE__ */ new Map();
  const extra = (n) => n < 256 ? n + 256 : n;
  const ranges = [[33, 126], [161, 172], [174, 255]];
  let k = 0;
  const inRange = (b) => ranges.some(([lo, hi]) => b >= lo && b <= hi);
  for (let b = 0; b < 256; b++) {
    const cp = inRange(b) ? b : extra(k++);
    b2u.set(b, String.fromCodePoint(cp));
    u2b.set(String.fromCodePoint(cp), b);
  }
  return { b2u, u2b };
}
let cached = null;
function maps() {
  if (!cached) cached = byteUnicodeMaps();
  return cached;
}
const GPT2_SPLIT = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
const HEAP_MIN_LEN = 32;
function bpeWord(chars, rank) {
  if (chars.length >= HEAP_MIN_LEN) return bpeWordHeap(chars, rank);
  let word = chars.slice();
  if (word.length <= 1) return word;
  for (; ; ) {
    let best = Infinity, idx = -1;
    for (let i = 0; i < word.length - 1; i++) {
      const r = rank.get(word[i] + " " + word[i + 1]);
      if (r !== void 0 && r < best) {
        best = r;
        idx = i;
      }
    }
    if (idx < 0) return word;
    word = [...word.slice(0, idx), word[idx] + word[idx + 1], ...word.slice(idx + 2)];
  }
}
function bpeWordHeap(chars, rank) {
  const n = chars.length;
  const tok = chars.slice();
  if (n <= 1) return tok;
  const next = new Int32Array(n), prev = new Int32Array(n);
  const version = new Int32Array(n);
  const dead = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    prev[i] = i - 1;
    next[i] = i + 1 < n ? i + 1 : -1;
  }
  let heapCap = 3 * n;
  let heapRank = new Int32Array(heapCap), heapSlot = new Int32Array(heapCap), heapVer = new Int32Array(heapCap);
  let heapLen = 0;
  const offer = (slot) => {
    const j = next[slot];
    if (j < 0) return;
    const r = rank.get(tok[slot] + " " + tok[j]);
    if (r === void 0) return;
    if (heapLen === heapCap) {
      heapCap *= 2;
      const r2 = new Int32Array(heapCap);
      r2.set(heapRank);
      heapRank = r2;
      const s2 = new Int32Array(heapCap);
      s2.set(heapSlot);
      heapSlot = s2;
      const v2 = new Int32Array(heapCap);
      v2.set(heapVer);
      heapVer = v2;
    }
    const ver = version[slot];
    let c = heapLen++;
    while (c > 0) {
      const p = c - 1 >> 1;
      if (heapRank[p] < r || heapRank[p] === r && heapSlot[p] < slot) break;
      heapRank[c] = heapRank[p];
      heapSlot[c] = heapSlot[p];
      heapVer[c] = heapVer[p];
      c = p;
    }
    heapRank[c] = r;
    heapSlot[c] = slot;
    heapVer[c] = ver;
  };
  for (let i = 0; i < n - 1; i++) offer(i);
  while (heapLen > 0) {
    const slot = heapSlot[0], ver = heapVer[0];
    const lastRank = heapRank[--heapLen], lastSlot = heapSlot[heapLen], lastVer = heapVer[heapLen];
    if (heapLen > 0) {
      let c = 0;
      for (; ; ) {
        const l = 2 * c + 1;
        if (l >= heapLen) break;
        const r = l + 1;
        let m = l;
        if (r < heapLen && (heapRank[r] < heapRank[l] || heapRank[r] === heapRank[l] && heapSlot[r] < heapSlot[l])) m = r;
        if (heapRank[m] > lastRank || heapRank[m] === lastRank && heapSlot[m] > lastSlot) break;
        heapRank[c] = heapRank[m];
        heapSlot[c] = heapSlot[m];
        heapVer[c] = heapVer[m];
        c = m;
      }
      heapRank[c] = lastRank;
      heapSlot[c] = lastSlot;
      heapVer[c] = lastVer;
    }
    if (dead[slot] || version[slot] !== ver) continue;
    const j = next[slot];
    if (j < 0 || dead[j]) continue;
    tok[slot] = tok[slot] + tok[j];
    dead[j] = 1;
    const k = next[j];
    next[slot] = k;
    if (k >= 0) prev[k] = slot;
    version[slot]++;
    offer(slot);
    const p = prev[slot];
    if (p >= 0) {
      version[p]++;
      offer(p);
    }
  }
  const out = [];
  for (let i = 0; i >= 0; i = next[i]) out.push(tok[i]);
  return out;
}
let sharedEncoder = null;
function bpeEncode(vocab, merges, text) {
  const { b2u } = maps();
  const unkId = vocab.get("[UNK]") ?? CHECKPOINT_IDS.unk;
  const out = [];
  const enc = sharedEncoder ??= new TextEncoder();
  const parts = text.normalize("NFC").match(GPT2_SPLIT);
  if (!parts) return out;
  for (const piece of parts) {
    const chars = [];
    for (const b of enc.encode(piece)) chars.push(b2u.get(b) ?? "");
    for (const tok of bpeWord(chars, merges)) out.push(vocab.get(tok) ?? unkId);
  }
  return out;
}
function metaspaceEncode(vocab, merges, text, unkId, replaces = [[" ", METASPACE_REPLACEMENT]], byteFallback = false) {
  const unk = unkId ?? vocab.get("<unk>") ?? vocab.get("[UNK]") ?? CHECKPOINT_IDS.unk;
  if (!text) return [];
  let t = text;
  for (const [from, to] of replaces) t = t.split(from).join(to);
  const out = [];
  const push = (piece) => {
    for (const tok of bpeWord(Array.from(piece), merges)) {
      const id = vocab.get(tok);
      if (id !== void 0) {
        out.push(id);
        continue;
      }
      const bytes = byteFallback ? Array.from((sharedEncoder ??= new TextEncoder()).encode(tok), (b) => vocab.get(`<0x${b.toString(16).toUpperCase().padStart(2, "0")}>`)) : [];
      if (bytes.length > 0 && bytes.every((b) => b !== void 0)) out.push(...bytes);
      else out.push(unk);
    }
  };
  for (const seg of t.split(/(\n+)/)) {
    if (!seg) continue;
    if (seg[0] === "\n") {
      push(seg);
    } else {
      const w = seg.startsWith(METASPACE_REPLACEMENT) ? seg : METASPACE_REPLACEMENT + seg;
      for (const chunk of w.split(METASPACE_REPLACEMENT).slice(1)) {
        push(chunk ? METASPACE_REPLACEMENT + chunk : METASPACE_REPLACEMENT);
      }
    }
  }
  return out;
}
function encodeSegment(data, text) {
  return data.kind === "metaspace" ? metaspaceEncode(data.vocab, data.merges, text, data.ids.unk, data.replaces, data.byteFallback) : bpeEncode(data.vocab, data.merges, text);
}
function trieSource(words) {
  const root = { kids: /* @__PURE__ */ new Map(), end: false };
  for (const w of words) {
    let n = root;
    for (const ch of w) {
      let k = n.kids.get(ch);
      if (!k) n.kids.set(ch, k = { kids: /* @__PURE__ */ new Map(), end: false });
      n = k;
    }
    n.end = true;
  }
  const walk = (n) => {
    const alts = [...n.kids].map(([c, k]) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + walk(k));
    if (!alts.length) return "";
    const body = alts.length === 1 ? alts[0] : "(?:" + alts.join("|") + ")";
    return n.end ? "(?:" + body + ")?" : body;
  };
  return walk(root);
}
const addedPhases = /* @__PURE__ */ new WeakMap();
function phasesOf(data) {
  let phases = addedPhases.get(data);
  if (!phases) {
    phases = [false, true].flatMap((normalized) => {
      const toks = (data.added ?? []).filter((t) => t.normalized === normalized && t.content);
      if (!toks.length) return [];
      const re = new RegExp(trieSource(toks.map((t) => t.content)), "gu");
      return [{ re, byContent: new Map(toks.map((t) => [t.content, t])), normalized }];
    });
    addedPhases.set(data, phases);
  }
  return phases;
}
function splitOnAdded(text, { re, byContent }) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const tok = byContent.get(m[0]);
    let before = text.slice(last, m.index);
    if (tok.lstrip) before = before.trimEnd();
    if (before) out.push(before);
    out.push(tok);
    last = m.index + m[0].length;
    if (tok.rstrip) while (last < text.length && /\s/u.test(text[last])) last++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function encodeWithData(data, text) {
  let pieces = [text];
  for (const phase of phasesOf(data)) {
    pieces = pieces.flatMap((p) => {
      if (typeof p !== "string") return [p];
      return splitOnAdded(phase.normalized && data.kind === "bytelevel" ? p.normalize("NFC") : p, phase);
    });
  }
  const out = [];
  for (const p of pieces) {
    if (typeof p === "string") out.push(...encodeSegment(data, p));
    else out.push(p.id);
  }
  return out;
}
function childNodes(node) {
  if (!node || typeof node !== "object") return [];
  const o = node;
  const out = [];
  for (const k of ["normalizers", "pre_tokenizers", "decoders"]) {
    const v = o[k];
    if (Array.isArray(v)) out.push(...v);
  }
  return out;
}
function hasNodeType(node, want) {
  if (!node || typeof node !== "object") return false;
  if (node["type"] === want) return true;
  return childNodes(node).some((c) => hasNodeType(c, want));
}
function collectReplaces(node, out) {
  if (!node || typeof node !== "object") return;
  const o = node;
  if (o["type"] === "Replace") {
    const pat = o["pattern"];
    const from = pat?.["String"];
    const to = o["content"];
    if (typeof from === "string" && typeof to === "string") out.push([from, to]);
  }
  for (const c of childNodes(node)) collectReplaces(c, out);
}
function parseTokenizerJson(raw) {
  try {
    const r = raw;
    const vocabObj = r?.model?.vocab;
    if (!vocabObj || typeof vocabObj !== "object") return null;
    const vocab = new Map(Object.entries(vocabObj));
    const merges = /* @__PURE__ */ new Map();
    for (const [i, m] of (r.model?.merges ?? []).entries()) {
      const pair = typeof m === "string" ? m.split(" ") : m;
      if (pair.length >= 2) merges.set(pair[0] + " " + pair[1], i);
    }
    const added = /* @__PURE__ */ new Map();
    const addedTokens = [];
    for (const t of r.added_tokens ?? []) {
      if (typeof t?.content === "string" && typeof t?.id === "number") {
        added.set(t.content, t.id);
        addedTokens.push({
          content: t.content,
          id: t.id,
          normalized: t.normalized === true,
          lstrip: t.lstrip === true,
          rstrip: t.rstrip === true
        });
      }
    }
    const pick = (aliases, fb) => {
      for (const a of aliases) {
        const v = added.get(a) ?? vocab.get(a);
        if (v !== void 0) return { id: v, token: a };
      }
      return { id: fb, token: aliases[0] };
    };
    const cls = pick(SPECIAL_ALIASES.cls, CHECKPOINT_IDS.cls);
    const sep = pick(SPECIAL_ALIASES.sep, CHECKPOINT_IDS.sep);
    const mask = pick(SPECIAL_ALIASES.mask, CHECKPOINT_IDS.mask);
    const pad = pick(SPECIAL_ALIASES.pad, CHECKPOINT_IDS.pad);
    const unk = pick(SPECIAL_ALIASES.unk, CHECKPOINT_IDS.unk);
    const kind = hasNodeType(r?.pre_tokenizer, "Metaspace") ? "metaspace" : "bytelevel";
    const replaces = [];
    collectReplaces(r?.normalizer, replaces);
    if (kind === "metaspace" && replaces.length === 0) replaces.push([" ", METASPACE_REPLACEMENT]);
    return {
      vocab,
      merges,
      ids: { cls: cls.id, sep: sep.id, mask: mask.id, pad: pad.id, unk: unk.id },
      kind,
      maskToken: mask.token,
      replaces,
      byteFallback: r.model?.byte_fallback === true,
      added: addedTokens
    };
  } catch {
    return null;
  }
}
async function loadTokenizerJson(pathOrUrl) {
  let raw;
  if (/^https?:\/\//.test(pathOrUrl)) {
    const res = await fetch(pathOrUrl);
    if (!res.ok) return null;
    raw = await res.json();
  } else {
    const fs = await import("node:fs/promises");
    raw = JSON.parse(await fs.readFile(pathOrUrl, "utf8"));
  }
  return parseTokenizerJson(raw);
}
export {
  CHECKPOINT_IDS,
  METASPACE_REPLACEMENT,
  SPECIAL_ALIASES,
  bpeEncode,
  encodeWithData,
  loadTokenizerJson,
  metaspaceEncode,
  parseTokenizerJson
};
