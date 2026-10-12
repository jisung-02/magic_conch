function pyNumber(v) {
  const [mant, exp] = v.toExponential().split("e");
  const e = Number(exp);
  return e >= -4 ? String(v) : `${mant}e-${String(-e).padStart(2, "0")}`;
}
function pyJson(v) {
  if (v === null) return "null";
  if (typeof v === "string" || typeof v === "boolean") return JSON.stringify(v);
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "NaN";
    if (v === Infinity) return "Infinity";
    if (v === -Infinity) return "-Infinity";
    return pyNumber(v);
  }
  if (Array.isArray(v)) return `[${v.map((x) => pyJson(x) ?? "null").join(", ")}]`;
  if (typeof v === "object") {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return void 0;
    const parts = [];
    for (const [k, x] of Object.entries(v)) {
      const s = pyJson(x);
      if (s !== void 0) parts.push(`${JSON.stringify(k)}: ${s}`);
    }
    return `{${parts.join(", ")}}`;
  }
  return void 0;
}
function serializeState(state) {
  if (typeof state === "string") return state;
  return pyJson(state) ?? String(state);
}
function renderCriterion(v) {
  return typeof v === "string" ? v : pyJson(v) ?? String(v);
}
function renderOptions(q) {
  if (q.t === "choice") {
    const crit2 = q.crit;
    return Object.entries(crit2).map(([k, v]) => v === null || v === void 0 || v === "" ? k : `${k}: ${renderCriterion(v)}`);
  }
  if (q.t === "score") {
    return q.crit.map((c, i) => `level ${i}: ${renderCriterion(c)}`);
  }
  const crit = q.crit ?? {};
  const labels = q.labels ?? { false: "false", true: "true" };
  const f = crit["false"], t = crit["true"];
  return [
    labels.false + ": " + (f !== null && f !== void 0 && f !== "" ? renderCriterion(f) : "no, the statement does not hold"),
    labels.true + ": " + (t !== null && t !== void 0 && t !== "" ? renderCriterion(t) : "yes, the statement holds")
  ];
}
const prefixCache = /* @__PURE__ */ new WeakMap();
function buildQuestionPrefix(tok, q, maxLen = 512, headMaxLen = 192, optionOrder) {
  let per = prefixCache.get(tok);
  if (!per) {
    per = /* @__PURE__ */ new Map();
    prefixCache.set(tok, per);
  }
  const key = JSON.stringify([q.t, q.ins, renderOptions(q), maxLen, headMaxLen, optionOrder ?? null]);
  const hit = per.get(key);
  if (hit) return hit;
  const built = buildQuestionPrefixUncached(tok, q, maxLen, headMaxLen, optionOrder);
  if (per.size > 1e3) per.clear();
  per.set(key, built);
  return built;
}
function buildQuestionPrefixUncached(tok, q, maxLen = 512, headMaxLen = 192, optionOrder) {
  const maskTok = tok.maskToken;
  const opts = renderOptions(q);
  const order = optionOrder ?? opts.map((_, i) => i);
  const ins = String(q.ins).split(maskTok).join(" ");
  let headIds = tok.encode(`${q.t} question: ${ins}`);
  let optIds = order.map((i) => [tok.maskId, ...tok.encode(" " + opts[i].split(maskTok).join(" ")).slice(0, 48)]);
  let budget = headMaxLen - optIds.reduce((a, o) => a + o.length, 0);
  let tokensPerOption = null;
  if (budget < 16) {
    const per = Math.max(4, Math.floor((headMaxLen - 16) / Math.max(1, optIds.length)));
    optIds = optIds.map((o) => o.slice(0, per));
    budget = headMaxLen - optIds.reduce((a, o) => a + o.length, 0);
    tokensPerOption = per;
  }
  headIds = headIds.slice(0, Math.max(8, budget));
  const ids = [tok.clsId, ...headIds, tok.sepId];
  const markers = [];
  for (const o of optIds) {
    markers.push(ids.length);
    ids.push(...o);
  }
  ids.push(tok.sepId);
  return {
    ids,
    markers,
    nOptions: opts.length,
    optionStats: {
      total: opts.length,
      distinct: new Set(optIds.map((o) => o.join(","))).size,
      tokens_per_option: tokensPerOption
    }
  };
}
function sequenceWithState(prefix, stateIds, sepId, maxLen = 512, truncateLeft = false) {
  const room = Math.max(0, maxLen - prefix.ids.length - 1);
  const kept = truncateLeft ? stateIds.slice(Math.max(0, stateIds.length - room)) : stateIds.slice(0, room);
  const ids = [...prefix.ids, ...kept, sepId].slice(0, maxLen);
  const used = Math.max(0, Math.min(kept.length, maxLen - prefix.ids.length));
  return {
    ids,
    markers: prefix.markers.filter((m) => m < maxLen),
    stats: {
      state_tokens: stateIds.length,
      state_tokens_used: used,
      state_tokens_dropped: stateIds.length - used,
      truncated: used < stateIds.length,
      options: prefix.optionStats
    }
  };
}
function collapsedOptions(qids, stats) {
  const out = {};
  qids.forEach((qid, i) => {
    const s = stats[i]?.options;
    if (s && s.distinct < s.total) out[qid] = {
      total: s.total,
      distinct: s.distinct,
      tokens_per_option: s.tokens_per_option
    };
  });
  return out;
}
function buildSequence(tok, state, q, maxLen = 512, headMaxLen = 192, optionOrder, truncateLeft = false) {
  const stAll = tok.encode(serializeState(state).split(tok.maskToken).join(" "));
  return sequenceWithState(buildQuestionPrefix(tok, q, maxLen, headMaxLen, optionOrder), stAll, tok.sepId, maxLen, truncateLeft);
}
function softmax(z) {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
function confidenceFromProbs(p) {
  const k = p.length;
  if (k < 2) return 1;
  const ent = -p.reduce((a, v) => a + v * Math.log(Math.max(v, 1e-12)), 0);
  return Math.min(1, Math.max(0, 1 - ent / Math.log(k)));
}
function answerConfidence(p) {
  if (p.length < 1) return 1;
  return Math.min(1, Math.max(0, Math.max(...p)));
}
function pyRepr(v) {
  if (typeof v === "boolean") return v ? "True" : "False";
  if (v === null || v === void 0) return "None";
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "nan";
    if (v === Infinity) return "inf";
    if (v === -Infinity) return "-inf";
    return String(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(pyRepr).join(", ")}]`;
  if (typeof v === "object") {
    const entries = Object.entries(v).map(
      ([k, val]) => `${pyRepr(k)}: ${pyRepr(val)}`
    );
    return `{${entries.join(", ")}}`;
  }
  return String(v);
}
const BUCKET_TYPES = ["choice", "score", "noul"];
const BUCKET_SIZES = ["2", "3-5", "6-10", "11+"];
function optionCountBucketSize(k) {
  return k <= 2 ? BUCKET_SIZES[0] : k <= 5 ? BUCKET_SIZES[1] : k <= 10 ? BUCKET_SIZES[2] : BUCKET_SIZES[3];
}
const BUCKET_KEY = new RegExp(
  `^(${BUCKET_TYPES.join("|")}):(${BUCKET_SIZES.map((size) => size.replace("+", "\\+")).join("|")})$`
);
function checkMinConfidenceMap(m) {
  if (!m || typeof m !== "object" || Array.isArray(m) || Object.keys(m).length === 0) {
    throw new Error(`a min_confidence map must be a non-empty dict of bucket -> float, got ${pyRepr(m)}`);
  }
  const out = {};
  for (const [key, val] of Object.entries(m)) {
    if (key !== "default" && !BUCKET_KEY.test(key)) {
      throw new Error(`min_confidence map keys must be strings like 'choice:3-5', got ${pyRepr(key)}`);
    }
    if (typeof val === "boolean" || typeof val !== "number" || !Number.isFinite(val) || val < 0 || val > 1) {
      throw new Error(`min_confidence must be a float in [0.0, 1.0], got ${pyRepr(val)}`);
    }
    out[key] = val;
  }
  return out;
}
function checkMinConfidence(v) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return checkMinConfidenceMap(v);
  }
  if (typeof v === "boolean" || typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
    throw new Error(`min_confidence must be a float in [0.0, 1.0], got ${pyRepr(v)}`);
  }
  return v;
}
function optionBucket(answer) {
  const qt = answer.type;
  if (qt !== "choice" && qt !== "score" && qt !== "noul") return null;
  const probs = answer.probabilities;
  let k;
  if (probs && typeof probs === "object" && !Array.isArray(probs)) {
    k = Object.keys(probs).length;
  } else if (qt === "noul") {
    k = 2;
  } else {
    return null;
  }
  const size = optionCountBucketSize(k);
  return `${qt}:${size}`;
}
function resolveMinConfidence(answer, thresholds, defaultVal = 0) {
  const key = optionBucket(answer);
  if (key !== null) {
    const threshold = thresholds[key];
    if (threshold !== void 0) return threshold;
  }
  return thresholds.default ?? defaultVal;
}
function flagLowConfidence(results, minConfidence) {
  const isMap = typeof minConfidence === "object" && minConfidence !== null;
  if (!isMap && minConfidence === 0) return;
  const list = Array.isArray(results) ? results : [results];
  for (const res of list) {
    const answers = res && typeof res === "object" ? res.answers : null;
    if (!answers || typeof answers !== "object") continue;
    for (const a of Object.values(answers)) {
      if (!a || typeof a !== "object") continue;
      const ansObj = a;
      let conf = ansObj.answer_confidence;
      if (conf === void 0 || conf === null) {
        conf = ansObj.confidence;
      }
      if (typeof conf === "number" && !Number.isNaN(conf)) {
        const thr = isMap ? resolveMinConfidence(ansObj, minConfidence) : minConfidence;
        if (conf < thr) {
          ansObj.low_confidence = true;
        }
      }
    }
  }
}
const TEMP_MIN = 0.5, TEMP_MAX = 5;
function clampTemperature(t) {
  if (t === null || t === void 0 || t === "" || typeof t === "boolean") return 1;
  const f = typeof t === "number" ? t : Number(t);
  if (!Number.isFinite(f)) return 1;
  return Math.min(TEMP_MAX, Math.max(TEMP_MIN, f));
}
function tempBucket(qtype, k) {
  return `${BUCKET_TYPES[qtype]}:${optionCountBucketSize(k)}`;
}
function checkBinningMap(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) {
    throw new Error(`binning_map must be an object of bucket -> {bins, values}, got ${pyRepr(m)}`);
  }
  const out = {};
  for (const [name, entry] of Object.entries(m)) {
    if (!BUCKET_KEY.test(name)) {
      throw new Error(`binning_map key ${pyRepr(name)} is not a bucket like "choice:2" or "score:3-5"`);
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`binning_map[${pyRepr(name)}] must be an object with "bins" and "values", got ${pyRepr(entry)}`);
    }
    const rec = entry;
    const nBins = rec.bins;
    const values = rec.values;
    if (typeof nBins === "boolean" || typeof nBins !== "number" || !Number.isInteger(nBins) || nBins < 1) {
      throw new Error(`binning_map[${pyRepr(name)}] must have an integer "bins" >= 1, got ${pyRepr(nBins)}`);
    }
    if (!Array.isArray(values) || values.length !== nBins) {
      throw new Error(`binning_map[${pyRepr(name)}] must have "values" of length "bins" (${nBins})`);
    }
    const parsedValues = [];
    for (const v of values) {
      if (typeof v === "boolean" || typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
        throw new Error(`binning_map[${pyRepr(name)}] values must be numbers in [0, 1], got ${pyRepr(v)}`);
      }
      parsedValues.push(v);
    }
    out[name] = { bins: nBins, values: parsedValues };
  }
  return out;
}
function applyBinningMap(confidence, bucket, binningMap) {
  if (!Number.isFinite(confidence)) return confidence;
  const entry = binningMap?.[bucket];
  if (!entry) {
    return confidence;
  }
  const bins = entry.bins;
  const b = Math.min(bins - 1, Math.max(0, Math.floor(confidence * bins)));
  return entry.values[b];
}
function maxOf(values, fallback = 0) {
  let m = fallback;
  for (let i = 0; i < values.length; i++) if (values[i] > m) m = values[i];
  return m;
}
function collateItems(batch, padId) {
  const items = (batch ?? []).flat();
  if (items.length === 0) return null;
  let L = 0;
  let K = 0;
  for (const it of items) {
    if (it.ids.length > L) L = it.ids.length;
    if (it.markers.length > K) K = it.markers.length;
  }
  const hasTarget = items.some((it) => "target" in it);
  const inputIds = items.map((it) => [...it.ids, ...Array(L - it.ids.length).fill(padId)]);
  const attentionMask = items.map((it) => [...Array(it.ids.length).fill(1), ...Array(L - it.ids.length).fill(0)]);
  const markerPos = items.map((it) => [...it.markers, ...Array(K - it.markers.length).fill(0)]);
  const markerMask = items.map((it) => [...it.markers.map(() => true), ...Array(K - it.markers.length).fill(false)]);
  const qtype = items.map((it) => it.qtype);
  const label = items.map((it) => typeof it.label === "number" ? it.label : -1);
  const meta = items.map((it) => {
    const { ids: _ids, markers: _markers, target: _target, ...m } = it;
    return m;
  });
  const out = { inputIds, attentionMask, markerPos, markerMask, qtype, label, meta };
  if (hasTarget) {
    out.target = items.map((it, i) => {
      const t = Array.isArray(it.target) ? it.target : [];
      const k = it.markers.length;
      if (t.length > k) {
        throw new Error(
          `collateItems: item ${i} has ${t.length} target entries but only ${k} marker positions; a target needs one entry per option`
        );
      }
      return [...t, ...Array(K - t.length).fill(0)];
    });
  }
  return out;
}
export {
  TEMP_MAX,
  TEMP_MIN,
  answerConfidence,
  applyBinningMap,
  buildQuestionPrefix,
  buildSequence,
  checkBinningMap,
  checkMinConfidence,
  checkMinConfidenceMap,
  clampTemperature,
  collapsedOptions,
  collateItems,
  confidenceFromProbs,
  flagLowConfidence,
  maxOf,
  optionBucket,
  renderCriterion,
  renderOptions,
  resolveMinConfidence,
  sequenceWithState,
  serializeState,
  softmax,
  tempBucket
};
