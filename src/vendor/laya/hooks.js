class PredictContext {
  /** `states` / `questions` may be rewritten by `onPredictStart`. */
  states;
  questions;
  /** Shared by every hook of one call. */
  runId;
  /** Set by `skip()` or after inference; `onPredictEnd` may rewrite it. */
  results = null;
  /** Router: the RouteDecision. */
  decision = null;
  /** Resolved checkpoint name. */
  model = null;
  agent = null;
  router = null;
  /** Per-call token-budget overrides; null = agent config. */
  maxLen = null;
  headMaxLen = null;
  /** Aggregated input/output tokens across results. */
  usage = null;
  startedAt;
  elapsedMs = null;
  error = null;
  constructor(init) {
    this.states = init.states;
    this.questions = init.questions;
    this.runId = newRunId();
    this.startedAt = now();
    for (const [k, v] of Object.entries(init)) {
      if (k !== "states" && k !== "questions" && v !== void 0) {
        this[k] = v;
      }
    }
  }
  /** Set cached results from a start hook; inference is skipped, end hooks still run. */
  skip(results) {
    this.results = results;
  }
  /** Set elapsedMs from startedAt. Called by the dispatching call, not by hooks. */
  markElapsed() {
    this.elapsedMs = now() - this.startedAt;
  }
}
function newRunId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().replaceAll("-", "");
  let hex = "";
  for (let i = 0; i < 32; i++) hex += Math.floor(Math.random() * 16).toString(16);
  return hex;
}
function now() {
  const p = globalThis.performance;
  return p && typeof p.now === "function" ? p.now() : Date.now();
}
const HOOK_EVENTS = [
  "onPredictStart",
  "onPredictEnd",
  "onRoute",
  "onLoad",
  "onEvict",
  "onError"
];
class BaseHook {
  onPredictStart(_ctx) {
  }
  onPredictEnd(_ctx) {
  }
  onRoute(_ctx) {
  }
  onLoad(_ctx) {
  }
  onEvict(_ctx) {
  }
  onError(_ctx) {
  }
}
function isHookLike(item) {
  return typeof item === "object" && item !== null && HOOK_EVENTS.some((e) => typeof item[e] === "function");
}
function typeName(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "Array";
  if (typeof v === "object") return v.constructor?.name ?? "object";
  return typeof v;
}
function normaliseHooks(hooks, onPredictStart, onPredictEnd) {
  const out = [];
  const append = (item) => {
    if (item === null || item === void 0) return;
    if (typeof item === "function") {
      if (HOOK_EVENTS.some((e) => typeof item[e] === "function")) {
        throw new TypeError(
          "a hook must be a plain callable or implement hook methods, not both"
        );
      }
      throw new TypeError(
        "a plain callable is ambiguous; pass it as onPredictStart or onPredictEnd"
      );
    }
    if (Array.isArray(item)) {
      for (const h of item) append(h);
      return;
    }
    if (typeof item !== "object") {
      throw new TypeError(`hooks must be Hook objects, got ${typeName(item)}`);
    }
    if (!isHookLike(item)) {
      throw new TypeError(
        `a hook must implement at least one hook method (${HOOK_EVENTS.join(", ")})`
      );
    }
    out.push(item);
  };
  append(hooks);
  if (onPredictStart !== null && onPredictStart !== void 0) {
    if (typeof onPredictStart !== "function") {
      throw new TypeError(`onPredictStart must be callable, got ${typeName(onPredictStart)}`);
    }
    out.push({ onPredictStart });
  }
  if (onPredictEnd !== null && onPredictEnd !== void 0) {
    if (typeof onPredictEnd !== "function") {
      throw new TypeError(`onPredictEnd must be callable, got ${typeName(onPredictEnd)}`);
    }
    out.push({ onPredictEnd });
  }
  if (onPredictStart !== null && onPredictStart !== void 0 && onPredictStart === onPredictEnd) {
    throw new TypeError(
      "onPredictStart and onPredictEnd must be different callables; one callable cannot serve both events"
    );
  }
  return out;
}
const defaultHooksList = [];
function defaultHooks() {
  return [...defaultHooksList];
}
function setDefaultHooks(hooks, onPredictStart, onPredictEnd) {
  const normalised = normaliseHooks(hooks, onPredictStart, onPredictEnd);
  defaultHooksList.length = 0;
  defaultHooksList.push(...normalised);
}
function addDefaultHook(hook) {
  defaultHooksList.push(...normaliseHooks(hook));
}
function clearDefaultHooks() {
  defaultHooksList.length = 0;
}
const defaultsRan = /* @__PURE__ */ new WeakSet();
function markDefaultsRan(opts) {
  defaultsRan.add(opts);
}
function defaultsAlreadyRan(opts) {
  return defaultsRan.has(opts);
}
function composeHooks(installed, hooks, onPredictStart, onPredictEnd) {
  if (defaultHooksList.length === 0 && installed.length === 0 && (hooks === null || hooks === void 0) && (onPredictStart === null || onPredictStart === void 0) && (onPredictEnd === null || onPredictEnd === void 0)) {
    return EMPTY_HOOKS;
  }
  return [...defaultHooksList, ...installed, ...normaliseHooks(hooks, onPredictStart, onPredictEnd)];
}
const EMPTY_HOOKS = [];
Object.freeze(EMPTY_HOOKS);
class HookRegistry {
  hooks = [];
  /** Install one hook or a list of them. Returns this for chaining. */
  addHook(hook) {
    const added = normaliseHooks(hook);
    if (added.length > 0) this.hooks = [...this.hooks, ...added];
    return this;
  }
  /** Remove a hook by identity. Returns true if it was installed. */
  removeHook(hook) {
    const before = this.hooks.length;
    this.hooks = this.hooks.filter((installed) => installed !== hook);
    return this.hooks.length !== before;
  }
  /**
   * Run `fn` with hooks installed, then remove them -- works for sync and async `fn`:
   *
   *     await router.withHooks([tracer], () => router.predict(state, questions));
   */
  withHooks(hookArgs, fn) {
    const added = normaliseHooks(hookArgs);
    this.hooks = [...this.hooks, ...added];
    const release = () => {
      this.hooks = this.hooks.filter((installed) => !added.includes(installed));
    };
    let out;
    try {
      out = fn();
    } catch (err) {
      release();
      throw err;
    }
    if (out instanceof Promise) {
      return out.finally(release);
    }
    release();
    return out;
  }
}
function aggregateUsage(results) {
  const total = (key) => results.reduce((acc, r) => {
    const usage = r?.["usage"];
    const v = usage?.[key];
    return acc + (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0);
  }, 0);
  return { input_tokens: total("input_tokens"), output_tokens: total("output_tokens") };
}
function reportHookFailure(hook, event, err) {
  const name = hook?.constructor?.name ?? "hook";
  console.warn(`laya: hook ${name}.${event} failed: ${String(err)}`);
}
async function runWithTimeout(promise, timeoutMs, operationName) {
  if (timeoutMs === null || timeoutMs === void 0) {
    await promise;
    return;
  }
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        abortController.signal.addEventListener("abort", () => {
          reject(new Error(`hook ${operationName} timed out after ${timeoutMs}ms`));
        });
      })
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}
function dispatch(hooks, event, ctx, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? null;
  const operationName = `${opts.hook?.constructor?.name ?? "hook"}.`;
  const raiseErrors = opts.raiseErrors ?? true;
  for (const hook of hooks) {
    const method = hook?.[event];
    if (typeof method !== "function") continue;
    try {
      const result = method.call(hook, ctx);
      if (typeof result?.then === "function") {
        Promise.resolve(result).catch((err) => reportHookFailure(hook, event, err));
      }
    } catch (err) {
      if (raiseErrors) throw err;
      reportHookFailure(hook, event, err);
    }
  }
}
async function dispatchAsync(hooks, event, ctx, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? null;
  const operationName = `${opts.hook?.constructor?.name ?? "hook"}.`;
  const raiseErrors = opts.raiseErrors ?? true;
  for (const hook of hooks) {
    const method = hook?.[event];
    if (typeof method !== "function") continue;
    try {
      await runWithTimeout(method.call(hook, ctx), timeoutMs, operationName);
    } catch (err) {
      if (raiseErrors) throw err;
      reportHookFailure(hook, event, err);
    }
  }
}
export {
  BaseHook,
  HOOK_EVENTS,
  HookRegistry,
  PredictContext,
  addDefaultHook,
  aggregateUsage,
  clearDefaultHooks,
  composeHooks,
  defaultHooks,
  defaultsAlreadyRan,
  dispatch,
  dispatchAsync,
  markDefaultsRan,
  normaliseHooks,
  setDefaultHooks
};
