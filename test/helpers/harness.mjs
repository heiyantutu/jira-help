// jsdom 行为对比测试 harness
// 思路：为 legacy/jira.user.js 与 dist/jira.user.js 各建一个「互不共享」的 jsdom 页面，
// 注入脚本依赖的全局对象（jQuery / moment / Toastify / fetch / Date / 剪贴板），
// 在页内 eval 脚本代码后执行同一场景，把可观察行为导出成可 deepEqual 的快照。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import jqueryFactory from 'jquery';
import moment from 'moment';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const LEGACY_PATH = ROOT + 'legacy/jira.user.js';
export const DIST_PATH = ROOT + 'dist/jira.user.js';

export const LEGACY_CODE = readFileSync(LEGACY_PATH, 'utf8');
export const DIST_CODE = readFileSync(DIST_PATH, 'utf8');

// ---------------------------------------------------------------------------
// 固定时间：2024-03-15（周五）18:30（本地时区）
// - 非任何节日 → getSpecialContent() 为空（除非标题含「非计划内」）
// - 18 点 → getSpecialText() 命中确定性分支「，今天辛苦了！」（不依赖 Math.random）
// 所有脚本内 new Date() / Date.now() 均返回该固定时刻；moment() 也被固定。
// ---------------------------------------------------------------------------
const RealDate = Date;
export const FIXED_LOCAL = { year: 2024, month: 2, day: 15, hour: 18, minute: 30 };
export const FIXED_MS = new RealDate(
    FIXED_LOCAL.year,
    FIXED_LOCAL.month,
    FIXED_LOCAL.day,
    FIXED_LOCAL.hour,
    FIXED_LOCAL.minute,
    0
).getTime();

class FixedDate extends RealDate {
    constructor(...args) {
        if (args.length === 0) {
            super(FIXED_MS);
        } else {
            super(...args);
        }
    }
    static now() {
        return FIXED_MS;
    }
}

const realMoment = moment;
realMoment.suppressDeprecationWarnings = true;

// moment() 无参时固定到今天；带参解析保持真实 moment 行为
function fixedMoment(...args) {
    if (args.length === 0) {
        return realMoment(new RealDate(FIXED_MS));
    }
    return realMoment(...args);
}
for (const key of Object.keys(realMoment)) {
    fixedMoment[key] = realMoment[key];
}
fixedMoment.now = () => FIXED_MS;

// ---------------------------------------------------------------------------
// 通用小工具
// ---------------------------------------------------------------------------
export function delay(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
}

function normalizeBody(body) {
    if (body === undefined || body === null) return null;
    if (typeof body !== 'string') return String(body);
    try {
        return JSON.parse(body);
    } catch {
        return body;
    }
}

function makeResponse(spec = {}) {
    const ok = spec.ok === undefined ? true : Boolean(spec.ok);
    const status = spec.status === undefined ? (ok ? 200 : 500) : spec.status;
    const text = typeof spec.body === 'string' ? spec.body : spec.body === undefined ? '' : JSON.stringify(spec.body);
    const jsonValue = spec.json;
    return {
        ok,
        status,
        text: () => Promise.resolve(text),
        json: () => Promise.resolve(jsonValue === undefined ? (text ? JSON.parse(text) : null) : jsonValue),
        clone() {
            return makeResponse({ ok, status, body: text, json: jsonValue });
        },
    };
}

// ---------------------------------------------------------------------------
// 页面上下文
// ---------------------------------------------------------------------------
/**
 * 创建一个 jsdom 页面并注入脚本运行时依赖。
 * scenario: { url, html, fetch(req) -> response spec | undefined }
 */
export function createContext(scenario) {
    const virtualConsole = new VirtualConsole(); // 默认丢弃 jsdom 内部报错，避免污染测试输出
    const dom = new JSDOM(scenario.html, {
        url: scenario.url,
        runScripts: 'outside-only',
        virtualConsole,
    });
    const { window } = dom;
    const { document } = window;

    const toasts = [];
    const clipboard = [];
    const execCommands = [];
    const requests = [];
    const xhrRequests = [];
    const logs = [];

    const $ = jqueryFactory(window);
    window.$ = $;
    window.jQuery = $;
    window.moment = fixedMoment;
    window.Date = FixedDate;

    // Toastify stub：记录每次 showToast 的参数
    window.Toastify = (options) => ({
        showToast() {
            toasts.push({
                text: options && options.text,
                position: options && options.position === undefined ? null : options.position,
                style: options && options.style ? JSON.parse(JSON.stringify(options.style)) : null,
            });
        },
    });

    // 旧版 JIRA 的复制方式：临时 input + select + execCommand('Copy')
    window.HTMLInputElement.prototype.select = function () {
        clipboard.push(this.value);
    };
    document.execCommand = (command) => {
        execCommands.push(command);
        return true;
    };

    // 捕获脚本的控制台输出（默认不参与断言，仅用于定位差异）
    for (const level of ['log', 'warn', 'error']) {
        window.console[level] = (...args) => {
            logs.push({ level, text: args.map((arg) => String(arg)).join(' ') });
        };
    }

    // fetch stub：记录请求，由场景决定返回内容（无网络）
    window.fetch = (input, init = {}) => {
        const url = typeof input === 'string' ? input : (input && input.url) || String(input);
        const method = String((init && init.method) || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
        const req = { url, method, body: normalizeBody(init && init.body) };
        requests.push(req);
        const spec = scenario.fetch ? scenario.fetch(req) : undefined;
        return Promise.resolve(makeResponse(spec || {}));
    };

    // 可选：用假的 XMLHttpRequest 替换 jsdom 实现，供 Tempo XHR 保存路径测试。
    // scenario.xhr.respond({url, method, body}) 返回 {status, body}。
    if (scenario.xhr) {
        class FakeXMLHttpRequest {
            constructor() {
                this.__listeners = {};
                this.__tempoPlanRequest = undefined;
                this.status = 0;
                this.responseText = '';
                this.responseType = '';
            }
            addEventListener(type, listener) {
                (this.__listeners[type] || (this.__listeners[type] = [])).push(listener);
            }
            removeEventListener() {}
            open(method, url) {
                this.__method = method;
                this.__url = url;
            }
            send(body) {
                const req = {
                    url: this.__url,
                    method: String(this.__method || 'GET').toUpperCase(),
                    body: normalizeBody(body),
                };
                xhrRequests.push(req);
                const spec = scenario.xhr.respond(req) || {};
                this.status = spec.status === undefined ? 200 : spec.status;
                this.responseText = spec.body === undefined ? '' : spec.body;
                for (const listener of this.__listeners.load || []) {
                    listener.call(this, { type: 'load' });
                }
            }
        }
        window.XMLHttpRequest = FakeXMLHttpRequest;
    }

    const ctx = {
        dom,
        window,
        document,
        $,
        toasts,
        clipboard,
        execCommands,
        requests,
        xhrRequests,
        logs,
        observed: {},
        delay,
        evalScript(code) {
            window.eval(code);
        },
        click(selector) {
            const el = document.querySelector(selector);
            if (!el) throw new Error('待点击元素不存在：' + selector);
            el.click();
            return delay(0);
        },
        query(selector) {
            return document.querySelector(selector);
        },
        queryAll(selector) {
            return [...document.querySelectorAll(selector)];
        },
        close() {
            try {
                window.close();
            } catch {
                /* ignore */
            }
        },
    };
    return ctx;
}

/**
 * 在一个全新页面中执行脚本并跑同一场景。
 * 返回场景 snapshot(ctx) 的结果。
 */
export async function runInFreshPage(scriptCode, scenario) {
    const ctx = createContext(scenario);
    try {
        ctx.evalScript(scriptCode);
        if (scenario.run) {
            await scenario.run(ctx);
        }
        await delay(scenario.settleMs === undefined ? 30 : scenario.settleMs);
        return await scenario.snapshot(ctx);
    } finally {
        ctx.close();
    }
}

/**
 * 关键入口：legacy 与 dist 各跑一遍，返回两份快照。
 * 调用方用 assert.deepStrictEqual(dist, legacy, '...') 对比。
 */
export async function compareScenario(scenario) {
    const legacy = await runInFreshPage(LEGACY_CODE, scenario);
    const dist = await runInFreshPage(DIST_CODE, scenario);
    return { legacy, dist };
}

// 常用的页面片段
export const BROWSE_URL = 'https://jira.ihotel.cn/browse/DEMO-1';
export const FILTER_URL = 'https://jira.ihotel.cn/issues/?filter=12345';
export const TEMPO_URL = 'https://jira.ihotel.cn/secure/Tempo.jspa#/resource-planning';
