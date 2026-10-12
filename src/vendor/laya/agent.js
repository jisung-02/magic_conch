import {
  TEMP_MAX,
  TEMP_MIN,
  applyBinningMap,
  buildQuestionPrefix,
  checkBinningMap,
  clampTemperature,
  collateItems,
  collapsedOptions,
  confidenceFromProbs,
  answerConfidence,
  checkMinConfidence,
  flagLowConfidence,
  renderCriterion,
  renderOptions,
  sequenceWithState,
  serializeState,
  softmax,
  tempBucket
} from "./common.js";
import { encodeWithData, parseTokenizerJson } from "./tokenizer.js";
import { decide } from "./structured.js";
import {
  HookRegistry,
  PredictContext,
  aggregateUsage,
  composeHooks,
  defaultsAlreadyRan,
  dispatchAsync,
  normaliseHooks
} from "./hooks.js";
const QTYPES = { choice: 0, score: 1, noul: 2 };
function qidStr(qid) {
  return JSON.stringify(qid);
}
function checkQuestion(qid, qdef) {
  if (typeof qid !== "string" || !qid.trim()) {
    throw new Error(`question id must be a non-empty string, got ${qidStr(qid)}`);
  }
  if (typeof qdef !== "object" || qdef === null || Array.isArray(qdef)) {
    const got = Array.isArray(qdef) ? "list" : qdef === null ? "NoneType" : typeof qdef;
    throw new Error(`question ${qidStr(qid)}: definition must be a dict, got ${got}`);
  }
  const q = qdef;
  const t = q["type"];
  if (t !== "choice" && t !== "score" && t !== "noul") {
    throw new Error(
      `question ${qidStr(qid)}: unknown type ${JSON.stringify(t)}; use one of ${JSON.stringify(Object.keys(QTYPES).sort())}`
    );
  }
  if (!("instructions" in q)) {
    throw new Error(`question ${qidStr(qid)}: no 'instructions'; add the text the model should answer`);
  }
  const ins = q["instructions"];
  if (ins === null || ins === void 0) {
    throw new Error(
      `question ${qidStr(qid)}: 'instructions' must not be None; add the text the model should answer`
    );
  }
  if (typeof ins === "string" && !ins.trim()) {
    throw new Error(
      `question ${qidStr(qid)}: 'instructions' must not be empty; add the text the model should answer`
    );
  }
  if (typeof ins === "object" && Object.keys(ins).length === 0) {
    throw new Error(
      `question ${qidStr(qid)}: 'instructions' must not be empty; add the text the model should answer`
    );
  }
  if (!["string", "object", "number", "bigint", "boolean"].includes(typeof ins)) {
    throw new Error(
      `question ${qidStr(qid)}: 'instructions' must be a string, dict, or list, got ${typeof ins}`
    );
  }
  const crit = q["criteria"];
  if (t === "choice") {
    if (typeof crit !== "object" || crit === null) {
      throw new Error(
        `question ${qidStr(qid)}: a choice question takes 'criteria' as a dict of label -> description, or a list of labels`
      );
    }
    if (Object.keys(crit).length === 0) {
      throw new Error(`question ${qidStr(qid)}: a choice question needs at least one criterion`);
    }
    if (Array.isArray(crit)) {
      for (let i = 0; i < crit.length; i++) {
        const label = crit[i];
        if (label === null || label === void 0) {
          throw new Error(
            `question ${qidStr(qid)}: choice label ${i} is null; a label is rendered as option text and used as the answer key, so it must be a string, number or bool`
          );
        }
        if (typeof label !== "object") continue;
        throw new Error(
          `question ${qidStr(qid)}: choice label ${i} is a ${Array.isArray(label) ? "list" : "dict"}; a label is rendered as option text and used as the answer key, so it must be a scalar (a string, number or bool), got ${JSON.stringify(label)}`
        );
      }
      const seen = /* @__PURE__ */ new Map();
      crit.forEach((label, i) => {
        const key = String(label);
        const first = seen.get(key);
        if (first === void 0) {
          seen.set(key, i);
          return;
        }
        throw new Error(
          `question ${qidStr(qid)}: choice label ${i} (${JSON.stringify(label)}) repeats label ${first}; the labels are the answer keys, so every option needs its own (1 and "1" are one key)`
        );
      });
    }
  } else if (t === "score") {
    if (!Array.isArray(crit)) {
      throw new Error(
        `question ${qidStr(qid)}: a score question takes 'criteria' as a list of level descriptions, index 0 first`
      );
    }
    if (crit.length === 0) {
      throw new Error(`question ${qidStr(qid)}: a score question needs at least one level`);
    }
    const nullAt = crit.findIndex((c) => c === null || c === void 0);
    if (nullAt >= 0) {
      throw new Error(
        `question ${qidStr(qid)}: score level ${nullAt} is null; give every level a description, index 0 first`
      );
    }
  } else if (crit !== void 0 && crit !== null && (typeof crit !== "object" || Array.isArray(crit))) {
    throw new Error(
      `question ${qidStr(qid)}: a noul question takes 'criteria' as a dict with optional 'true'/'false' descriptions, or omits it`
    );
  } else if (crit && typeof crit === "object" && !Array.isArray(crit)) {
    const invalid = Object.keys(crit).filter((key) => key.toLowerCase() !== "true" && key.toLowerCase() !== "false");
    if (invalid.length > 0) {
      throw new Error(
        `question ${qidStr(qid)}: noul criteria may contain only 'true' and 'false'; got ${JSON.stringify(invalid)}`
      );
    }
  }
  if ("labels" in q && t !== "noul") {
    throw new Error(`question ${qidStr(qid)}: 'labels' is only supported for noul questions`);
  }
  if (t === "noul" && q["labels"] !== null && q["labels"] !== void 0) {
    const labels = q["labels"];
    if (typeof labels !== "object" || labels === null || Array.isArray(labels)) {
      throw new Error(`question ${qidStr(qid)}: noul labels must be an object with 'false' and 'true'`);
    }
    const entries = Object.entries(labels);
    const keys = entries.map(([key]) => key).sort();
    if (keys.length !== 2 || keys[0] !== "false" || keys[1] !== "true" || entries.some(([, value]) => typeof value !== "string" || value.trim() === "")) {
      throw new Error(`question ${qidStr(qid)}: noul labels must map exactly 'false' and 'true' to distinct non-empty strings`);
    }
    const falseLabel = String(labels["false"]).trim();
    const trueLabel = String(labels["true"]).trim();
    if (falseLabel === trueLabel) {
      throw new Error(`question ${qidStr(qid)}: noul labels must be distinct`);
    }
  }
}
function isPlainDict(o) {
  if (typeof o !== "object" || o === null || Array.isArray(o)) return false;
  const proto = Object.getPrototypeOf(o);
  return proto === null || proto === Object.prototype;
}
function isEmptyOverride(v) {
  if (v === null || v === void 0 || v === false || v === "") return true;
  if (v === 0) return true;
  return Array.isArray(v) && v.length === 0;
}
function toInternal(qdef) {
  const t = qdef["type"];
  let crit = qdef["criteria"];
  if (t === "choice" && Array.isArray(crit)) {
    crit = Object.fromEntries(crit.map((c) => [c, null]));
  } else if (t === "noul" && crit !== null && crit !== void 0 && typeof crit === "object" && !Array.isArray(crit)) {
    crit = Object.fromEntries(Object.entries(crit).map(([k, v]) => [String(k).toLowerCase(), v]));
  }
  let ins = qdef["instructions"];
  if (typeof ins !== "string") ins = serializeState(ins);
  const out = {
    t,
    ins,
    crit
  };
  if (t === "noul" && qdef["labels"] && typeof qdef["labels"] === "object" && !Array.isArray(qdef["labels"])) {
    const labels = qdef["labels"];
    out.labels = { false: String(labels["false"]).trim(), true: String(labels["true"]).trim() };
  }
  return out;
}
function defaultTokenizer() {
  return {
    clsId: 101,
    sepId: 102,
    maskId: 103,
    padId: 0,
    maskToken: "[MASK]",
    encode(text) {
      return text.split(/\s+/).filter(Boolean).map((w, i) => 1e3 + (w.length * 31 + i * 7) % 2e4);
    }
  };
}
function tokenizerFromHF(tokenizerJson) {
  const data = parseTokenizerJson(tokenizerJson);
  if (!data) return null;
  return {
    clsId: data.ids.cls,
    sepId: data.ids.sep,
    maskId: data.ids.mask,
    padId: data.ids.pad,
    maskToken: data.maskToken,
    encode: (text) => encodeWithData(data, text)
  };
}
const r4 = (v) => Math.round(v * 1e4) / 1e4;
class Agent extends HookRegistry {
  hooksRaise;
  hooksTimeout;
  cfg;
  provider;
  revision;
  tok;
  maxLen;
  headMaxLen;
  temperatureRaw;
  temperatureByOptionsRaw;
  temperature;
  temperatureByOptions;
  binningMap;
  langTemperatures;
  constructor(opts) {
    super();
    if (!opts || !opts.provider) throw new Error("Agent needs a provider");
    this.provider = opts.provider;
    this.revision = opts.revision ?? null;
    this.hooks = normaliseHooks(opts.hooks, opts.onPredictStart, opts.onPredictEnd);
    this.hooksRaise = opts.hooksRaise ?? true;
    this.hooksTimeout = opts.hooksTimeout ?? null;
    const cfg = { ...opts.cfg ?? {} };
    if (opts.max_len !== void 0) cfg.max_len = opts.max_len;
    if (opts.head_max_len !== void 0) cfg.head_max_len = opts.head_max_len;
    if (opts.temperature !== void 0) cfg.temperature = opts.temperature;
    if (opts.temperature_by_options !== void 0) cfg.temperature_by_options = opts.temperature_by_options;
    if (opts.binning_map !== void 0) cfg.binning_map = opts.binning_map;
    if (opts.binningMap !== void 0) cfg.binning_map = opts.binningMap;
    this.cfg = cfg;
    this.maxLen = Number(cfg.max_len ?? 512);
    this.headMaxLen = Number(cfg.head_max_len ?? 192);
    this.tok = opts.tok ?? defaultTokenizer();
    const bmapRaw = cfg.binning_map;
    this.binningMap = bmapRaw !== void 0 && bmapRaw !== null ? checkBinningMap(bmapRaw) : null;
    const raw = cfg.temperature ?? [1, 1, 1];
    this.temperatureRaw = raw;
    if (!Array.isArray(raw) || raw.length !== 3) {
      throw new Error(`Incompatible model: temperature must be a list of 3 floats, got ${JSON.stringify(raw)}`);
    }
    const rawList = raw;
    this.temperature = rawList.map((t) => clampTemperature(t));
    this.temperatureByOptionsRaw = cfg.temperature_by_options ?? {};
    this.temperatureByOptions = Object.fromEntries(
      Object.entries(this.temperatureByOptionsRaw).map(([k, v]) => [k, clampTemperature(v)])
    );
    const entries = [
      ...Object.entries(this.temperatureByOptionsRaw).map(
        ([k, v]) => [k, v, this.temperatureByOptions[k]]
      ),
      ...[0, 1, 2].map(
        (i) => [`temperature[${i}]`, rawList[i], this.temperature[i]]
      )
    ];
    const rejected = [];
    for (const [name, rawV, applied] of entries) {
      if (Number(rawV) === applied) continue;
      rejected.push(`${name}=${JSON.stringify(rawV) ?? String(rawV)} -> ${applied}`);
    }
    if (rejected.length > 0) {
      console.warn(
        `laya: this checkpoint ships invalid temperatures or values outside [${TEMP_MIN}, ${TEMP_MAX}]; using ${rejected.join(", ")}. Treat confidence from the affected entries as uncalibrated.`
      );
    }
    this.langTemperatures = {};
    for (const [l, lc] of Object.entries(opts.lang_temperatures ?? {})) {
      const normL = l.split("-")[0].toLowerCase();
      const tRaw = lc?.temperature ?? rawList;
      if (!Array.isArray(tRaw) || tRaw.length !== 3) {
        throw new Error(
          `Language override ${JSON.stringify(l)} temperature must be a list of 3 floats`
        );
      }
      const tboRaw = lc?.temperature_by_options;
      if (!isEmptyOverride(tboRaw) && !isPlainDict(tboRaw)) {
        throw new Error(
          `Language override ${JSON.stringify(l)} temperature_by_options must be a mapping of bucket -> float, got ${Array.isArray(tboRaw) ? "list" : typeof tboRaw}`
        );
      }
      const tboDict = isPlainDict(tboRaw) ? tboRaw : {};
      this.langTemperatures[normL] = {
        temperature: [0, 1, 2].map((i) => clampTemperature(tRaw[i])),
        temperatureByOptions: Object.fromEntries(
          Object.entries(tboDict).map(([k, v]) => [k, clampTemperature(v)])
        )
      };
    }
  }
  /**
   * Evaluate typed questions across one state in a single forward pass.
   *
   * `hooks` / `onPredictStart` / `onPredictEnd` observe or shape the prediction, appended
   * after any hooks installed on the Agent; a start hook may rewrite the state/questions or
   * call `ctx.skip(...)` to short-circuit inference, an end hook may rewrite the results.
   * See hooks.ts. `hooksRaise` overrides the Agent's setting for this call.
   */
  async systemOne(state, questions, opts = {}) {
    return (await this._predictHooked([state], questions, opts))[0];
  }
  async _predictHooked(states, questions, opts) {
    const mcOpt = opts.minConfidence ?? opts.min_confidence;
    const mc = mcOpt !== void 0 && mcOpt !== null ? checkMinConfidence(mcOpt) : null;
    const active = defaultsAlreadyRan(opts) ? [...this.hooks, ...normaliseHooks(opts.hooks, opts.onPredictStart, opts.onPredictEnd)] : composeHooks(this.hooks, opts.hooks, opts.onPredictStart, opts.onPredictEnd);
    const raiseErrors = opts.hooksRaise ?? this.hooksRaise;
    const hooksTimeout = opts.hooksTimeout ?? this.hooksTimeout;
    const timeoutMs = typeof hooksTimeout === "number" ? hooksTimeout * 1e3 : null;
    const ctx = new PredictContext({
      states,
      questions,
      agent: this,
      maxLen: opts.maxLen ?? null,
      headMaxLen: opts.headMaxLen ?? null
    });
    try {
      await dispatchAsync(active, "onPredictStart", ctx, { raiseErrors, timeoutMs });
      if (ctx.results === null) {
        if (!Array.isArray(ctx.states)) {
          throw new TypeError(
            "predictBatch expects an array of states; pass a single state to predict()/systemOne()."
          );
        }
        if (!isPlainDict(ctx.questions)) {
          const typeName = ctx.questions === null ? "NoneType" : Array.isArray(ctx.questions) ? "list" : typeof ctx.questions === "object" ? ctx.questions.constructor?.name ?? "object" : typeof ctx.questions;
          throw new TypeError(
            `questions must be a dict of question id -> definition, got ${typeName}`
          );
        }
        for (const st of ctx.states) {
          if (st === null || st === void 0) {
            throw new TypeError("state must not be None; pass a string, dict, or list");
          }
        }
        const out = await this._systemOneMany(ctx.states, ctx.questions, {
          maxLen: ctx.maxLen,
          headMaxLen: ctx.headMaxLen,
          batchSize: opts.batchSize ?? null,
          lang: opts.lang ?? null
        });
        ctx.results = out;
        ctx.model ??= out[0]?.model ?? null;
      }
    } catch (err) {
      ctx.error = err;
      try {
        await dispatchAsync(active, "onError", ctx, { raiseErrors });
      } catch {
      }
      throw err;
    } finally {
      ctx.markElapsed();
      if (ctx.results !== null) {
        ctx.usage = aggregateUsage(ctx.results);
        if (mc !== null) {
          flagLowConfidence(ctx.results, mc);
        }
      }
      try {
        await dispatchAsync(active, "onPredictEnd", ctx, { raiseErrors, timeoutMs });
      } catch (hookErr) {
        if (ctx.error === null) throw hookErr;
      }
    }
    return ctx.results;
  }
  /** Encode one state into one sequence row per question; the state text is tokenized once. */
  _encodeItems(state, ids, internals, maxLen, headMaxLen) {
    const stAll = this.tok.encode(serializeState(state).split(this.tok.maskToken).join(" "));
    const items = [];
    const stats = [];
    for (let qi = 0; qi < ids.length; qi++) {
      const qid = ids[qi];
      const q = internals[qi];
      const prefix = buildQuestionPrefix(this.tok, q, maxLen, headMaxLen);
      const seq = sequenceWithState(
        prefix,
        stAll,
        this.tok.sepId,
        maxLen,
        Array.isArray(state)
      );
      if (seq.markers.length !== renderOptions(q).length) {
        throw new Error(`question ${qidStr(qid)} options exceed head_max_len=${headMaxLen}`);
      }
      items.push({ ids: seq.ids, markers: seq.markers, qtype: QTYPES[q.t] });
      stats.push(seq.stats);
    }
    return { items, nTokens: items.reduce((a, it) => a + it.ids.length, 0), stats };
  }
  /**
   * Evaluate one shared question schema over many states. Each chunk of up to `batchSize`
   * states is collated into a single encoder+head forward pass; results align with `states`
   * by index. (Python `Agent.predict_batch` parity; its `sort_by_length` is not ported.)
   */
  async _systemOneMany(states, questions, opts = {}) {
    if (states.length === 0) return [];
    const ids = Object.keys(questions ?? {});
    if (ids.length === 0) {
      return states.map(() => ({
        model: "laya-rl-agent",
        answers: {},
        usage: { input_tokens: 0, output_tokens: 0 }
      }));
    }
    const maxLen = opts.maxLen ?? this.maxLen;
    const headMaxLen = opts.headMaxLen ?? this.headMaxLen;
    const internals = ids.map((qid) => {
      checkQuestion(qid, questions[qid]);
      return toInternal(questions[qid]);
    });
    const chunkSize = opts.batchSize && opts.batchSize > 0 ? Math.floor(opts.batchSize) : states.length;
    const out = [];
    for (let start = 0; start < states.length; start += chunkSize) {
      const chunk = states.slice(start, start + chunkSize);
      const built = chunk.map((st) => this._encodeItems(st, ids, internals, maxLen, headMaxLen));
      const collated = collateItems(built.map((b) => b.items), this.tok.padId);
      if (!collated) throw new Error("no items to collate");
      const batch = collated;
      const { lastHidden } = await this.provider.runEncoder(batch);
      const { logits, act } = await this.provider.runHead(lastHidden, batch);
      const rows = chunk.length * ids.length;
      if (!Array.isArray(logits) || !Array.isArray(act) || logits.length < rows || act.length < rows) {
        throw new Error("model provider returned fewer output rows than input items");
      }
      for (let s = 0; s < chunk.length; s++) {
        for (let qi = 0; qi < ids.length; qi++) {
          const r = s * ids.length + qi;
          const k = built[s].items[qi].markers.length;
          const logitRow = logits[r];
          const actRow = act[r];
          if (!Array.isArray(logitRow) || logitRow.length < k || !Array.isArray(actRow) || actRow.length === 0 || logitRow.some((v) => !Number.isFinite(v)) || actRow.some((v) => !Number.isFinite(v))) {
            throw new Error(`model provider returned invalid output for question ${ids[qi]}`);
          }
        }
      }
      let row = 0;
      for (let s = 0; s < chunk.length; s++) {
        const answers = {};
        for (let qi = 0; qi < ids.length; qi++) {
          answers[ids[qi]] = this._decodeRow(
            logits[row],
            act[row] ?? [1, 0],
            internals[qi],
            built[s].items[qi].markers.length,
            opts.lang ?? null
          );
          row++;
        }
        const st = built[s].stats;
        const dropped = st.reduce((a, x) => Math.max(a, x.state_tokens_dropped), 0);
        const collapsed = collapsedOptions(ids, st);
        out.push({
          model: "laya-rl-agent",
          answers,
          usage: {
            input_tokens: built[s].nTokens,
            output_tokens: 0,
            state_tokens: st[0]?.state_tokens ?? 0,
            state_tokens_dropped: dropped,
            truncated: dropped > 0,
            truncated_questions: ids.filter((_, qi) => st[qi].truncated),
            ...Object.keys(collapsed).length ? { options: collapsed } : {}
          }
        });
      }
    }
    return out;
  }
  /** Decode one head row into the answer for its question. */
  _decodeRow(logitsRow, actRow, q, k, lang = null) {
    const qt = QTYPES[q.t];
    const bucket = tempBucket(qt, k);
    const langCfg = lang ? this.langTemperatures[lang.split("-")[0].toLowerCase()] : void 0;
    const scale = langCfg ? langCfg.temperatureByOptions[bucket] ?? langCfg.temperature[qt] ?? 1 : this.temperatureByOptions[bucket] ?? this.temperature[qt] ?? 1;
    const z = logitsRow.slice(0, k).map((v) => v / scale);
    const p = softmax(z);
    const actP = softmax(actRow.slice(0, Math.max(2, actRow.length)));
    const ext = { act_probability: r4(actP[0]) };
    const ansRaw = answerConfidence(p);
    const langOverride = Boolean(lang && lang.split("-")[0].toLowerCase() in this.langTemperatures);
    const ansConf = r4(
      this.binningMap && !langOverride ? applyBinningMap(ansRaw, bucket, this.binningMap) : ansRaw
    );
    if (q.t === "choice") {
      const keys = Object.keys(q.crit);
      let best = 0;
      for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
      return {
        type: "choice",
        choice: keys[best],
        probabilities: Object.fromEntries(keys.map((kk, i) => [kk, r4(p[i] ?? 0)])),
        confidence: r4(confidenceFromProbs(p)),
        answer_confidence: ansConf,
        action: ext
      };
    }
    if (q.t === "score") {
      const exp = p.reduce((a, v, i) => a + i * v, 0);
      return {
        type: "score",
        score: r4(exp),
        // `renderCriterion`, not the raw `c`: a legend maps an index to the TEXT of a level, and
        // the keys are already strings. A numeric scale written directly used to come back with
        // the caller's own JSON types (`{"0": 1}`), so a client that reads a level as a string
        // had to handle a number, a boolean and null as well -- and `{"0": null}` is not even
        // parseable by a Jev client (#302). Same change as the Python `agent.py` and
        // `onnx_agent.py` legends, so the two runtimes return the same value types.
        legend: Object.fromEntries(
          q.crit.map((c, i) => [String(i), renderCriterion(c)])
        ),
        probabilities: Object.fromEntries(p.map((v, i) => [String(i), r4(v)])),
        confidence: r4(confidenceFromProbs(p)),
        answer_confidence: ansConf,
        action: ext
      };
    }
    const pt = p[1] ?? 0;
    return {
      type: "noul",
      noul: r4(pt),
      confidence: r4(Math.max(pt, 1 - pt)),
      // over two options max(p_true, 1 - p_true) is max(p): identical to confidence here
      answer_confidence: ansConf,
      action: ext
    };
  }
  async predict(state, questions, opts = {}) {
    return this.systemOne(state, questions, opts);
  }
  /**
   * Evaluate the same questions over many states, packing each chunk of up to
   * `opts.batchSize` states into one shared forward pass (Python `Agent.predict_batch`
   * parity). This is the throughput path: `systemOne`/`predict` run one state per forward
   * pass, which leaves most of the batch dimension idle on GPU. Results align with
   * `states` by index and are identical in shape to `systemOne`'s output.
   *
   * `opts.maxLen` / `opts.headMaxLen` override the agent config for this call; a start
   * hook may also set `ctx.maxLen` / `ctx.headMaxLen` or call `ctx.skip(results)`.
   * Python's `sort_by_length` grouping is not ported.
   */
  async predictBatch(states, questions, opts = {}) {
    return this._predictHooked(states, questions, opts);
  }
  async decide(state, schema, opts = {}) {
    return decide(this, state, schema, opts);
  }
}
export {
  Agent,
  QTYPES,
  checkQuestion,
  defaultTokenizer,
  toInternal,
  tokenizerFromHF
};
