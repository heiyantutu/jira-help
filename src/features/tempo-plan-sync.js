// ==================== Tempo 资源规划：修改计划排期时同步 JIRA 任务排期 ====================
// 功能说明：
// 1. 在 Tempo 资源规划页面（jira.ihotel.cn/secure/Tempo.jspa#/resource-planning）修改
//    计划条的开始/结束日期（编辑期间计划、拖动计划条、新建计划等）时，Tempo 会调用
//    PUT/POST /rest/tempo-planning/1/plan 保存计划
// 2. 本功能监听该接口，取保存后的计划期间，回写对应 JIRA 任务的
//    「预计开始」(customfield_10300)、「预计结束」(customfield_10301)
// 3. 仅同步「自己的」且类型为 ISSUE 的计划，避免误改他人任务的排期
import { currentDomain } from '../core/env.js';
import { loadCSS } from '../core/dom.js';
import { notify, notifyError } from '../core/notify.js';

function initTempoPlanSync() {
    if (window.__tempoPlanSyncHooked) {
        return;
    }
    window.__tempoPlanSyncHooked = true;

    // JIRA 任务里的排期字段（与 initPlan 中一致：预计开始/预计结束）
    var JIRA_START_FIELD = 'customfield_10300';
    var JIRA_END_FIELD = 'customfield_10301';
    // Tempo 保存计划的接口
    var TEMPO_PLAN_API_REGEX = /\/rest\/tempo-planning\/1\/plan(?:[?#]|$)/;
    var currentUserKeyPromise = null;
    var pendingTimers = {};

    function planToast(text, isError) {
        try {
            if (isError) {
                notifyError(text);
            } else {
                notify(text);
            }
        } catch (e) {
            console.log('[Tempo排期同步] ' + text);
        }
    }

    // 当前登录人（JIRA user key，如 JIRAUSER10515）
    function getCurrentUserKey() {
        if (!currentUserKeyPromise) {
            currentUserKeyPromise = fetch('/rest/api/2/myself', {
                headers: { Accept: 'application/json' },
            })
                .then(function (res) {
                    return res.ok ? res.json() : null;
                })
                .then(function (user) {
                    return user && user.key ? user.key : null;
                })
                .catch(function () {
                    return null;
                });
        }
        return currentUserKeyPromise;
    }

    // 更新 JIRA 任务的预计开始/预计结束
    function updateIssueSchedule(issueKey, start, end) {
        var fieldsUrl =
            '/rest/api/2/issue/' + encodeURIComponent(issueKey) + '?fields=key,' + JIRA_START_FIELD + ',' + JIRA_END_FIELD;
        fetch(fieldsUrl, { headers: { Accept: 'application/json' } })
            .then(function (res) {
                return res.ok ? res.json() : null;
            })
            .then(function (issue) {
                if (!issue) {
                    planToast('同步 ' + issueKey + ' 排期失败：读取任务失败', true);
                    return;
                }
                var fields = issue.fields || {};
                if (fields[JIRA_START_FIELD] === start && fields[JIRA_END_FIELD] === end) {
                    // 与计划一致，无需更新
                    console.log('[Tempo排期同步] ' + issueKey + ' 排期已一致，跳过更新');
                    return;
                }
                var updateFields = {};
                updateFields[JIRA_START_FIELD] = start;
                updateFields[JIRA_END_FIELD] = end;
                return fetch('/rest/api/2/issue/' + encodeURIComponent(issueKey), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({ fields: updateFields }),
                }).then(function (putRes) {
                    if (putRes.ok) {
                        planToast(issueKey + ' 排期已同步至 JIRA：' + start + ' ~ ' + end);
                    } else {
                        planToast('同步 ' + issueKey + ' 排期失败（' + putRes.status + '）', true);
                    }
                });
            })
            .catch(function (error) {
                console.error('[Tempo排期同步] 更新失败', issueKey, error);
            });
    }

    // 排队同步：拖动计划条时可能连续保存，合并为最后一次
    function scheduleSync(issueKey, start, end) {
        if (!issueKey || !start || !end) {
            return;
        }
        if (pendingTimers[issueKey]) {
            clearTimeout(pendingTimers[issueKey]);
        }
        pendingTimers[issueKey] = setTimeout(function () {
            delete pendingTimers[issueKey];
            updateIssueSchedule(issueKey, start, end);
        }, 500);
    }

    // 解析 Tempo 保存计划的响应，取出 issue key 与新的排期范围
    function handlePlanSaved(responseText, requestBody) {
        var plan = null;
        try {
            plan = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
        } catch (e) {
            plan = null;
        }
        if (plan && plan.planItemType && plan.planItemType !== 'ISSUE') {
            return; // 只同步 JIRA 问题（需求/任务/子任务）
        }

        var issueKey = null;
        var start = plan && plan.start;
        var end = plan && plan.end;
        var assigneeKey = plan && plan.assigneeKey;
        var allocationId = plan && plan.allocationId;

        try {
            var data = typeof responseText === 'string' && responseText ? JSON.parse(responseText) : responseText;
            var list = Array.isArray(data) ? data : data && data.plans ? data.plans : [];
            list = list.filter(function (item) {
                return item && item.planItemInfo && item.planItemInfo.key;
            });
            // 同一次保存可能返回多段计划，只取本次修改的那段
            if (allocationId !== undefined && allocationId !== null) {
                var sameAllocation = list.filter(function (item) {
                    return item.allocationId == allocationId;
                });
                if (sameAllocation.length) {
                    list = sameAllocation;
                }
            }
            if (list.length) {
                issueKey = list[0].planItemInfo.key;
                assigneeKey = list[0].assignee || assigneeKey;
                var starts = list
                    .map(function (item) {
                        return item.planStart;
                    })
                    .filter(Boolean)
                    .sort();
                var ends = list
                    .map(function (item) {
                        return item.planEnd;
                    })
                    .filter(Boolean)
                    .sort();
                if (starts.length) {
                    start = starts[0];
                }
                if (ends.length) {
                    end = ends[ends.length - 1];
                }
            }
        } catch (e) {
            // 响应解析失败时使用请求体里的日期
        }

        if (!issueKey) {
            // 请求体里只有 issue id 时，先换成 issue key 再同步
            if (plan && plan.planItemId) {
                fetch('/rest/api/2/issue/' + encodeURIComponent(plan.planItemId) + '?fields=key', {
                    headers: { Accept: 'application/json' },
                })
                    .then(function (res) {
                        return res.ok ? res.json() : null;
                    })
                    .then(function (issue) {
                        if (!issue || !issue.key) {
                            console.warn('[Tempo排期同步] 未能识别 issue key，跳过本次同步');
                            return;
                        }
                        issueKey = issue.key;
                        doSync();
                    })
                    .catch(function () {
                        console.warn('[Tempo排期同步] 未能识别 issue key，跳过本次同步');
                    });
                return;
            }
            console.warn('[Tempo排期同步] 未能识别 issue key，跳过本次同步');
            return;
        }
        if (!start || !end) {
            console.warn('[Tempo排期同步] 未取到计划日期，跳过：' + issueKey);
            return;
        }
        doSync();

        // 只同步"自己"的计划：计划负责人需为当前登录人
        function doSync() {
            if (!start || !end) {
                return;
            }
            getCurrentUserKey().then(function (myKey) {
                if (myKey && assigneeKey && assigneeKey !== myKey) {
                    console.log('[Tempo排期同步] ' + issueKey + ' 非本人的计划，跳过同步');
                    return;
                }
                console.log('[Tempo排期同步] 计划已保存，准备同步 ' + issueKey + '：' + start + ' ~ ' + end);
                scheduleSync(issueKey, start, end);
            });
        }
    }

    function isPlanSaveRequest(method, url) {
        if (!url) {
            return false;
        }
        return TEMPO_PLAN_API_REGEX.test(String(url)) && /^(PUT|POST)$/i.test(method || '');
    }

    // 监听 XMLHttpRequest（Tempo 前端保存计划走的是 XHR）
    function hookXhr() {
        var xhrOpen = XMLHttpRequest.prototype.open;
        var xhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url) {
            this.__tempoPlanRequest = { method: method, url: url };
            return xhrOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
            var meta = this.__tempoPlanRequest;
            if (meta && isPlanSaveRequest(meta.method, meta.url)) {
                var xhr = this;
                xhr.addEventListener('load', function () {
                    if (xhr.status < 200 || xhr.status >= 300) {
                        return;
                    }
                    var text = '';
                    try {
                        if (!xhr.responseType || xhr.responseType === 'text') {
                            text = xhr.responseText;
                        } else if (xhr.responseType === 'json') {
                            text = JSON.stringify(xhr.response);
                        }
                    } catch (e) {
                        text = '';
                    }
                    handlePlanSaved(text, body);
                });
            }
            return xhrSend.apply(this, arguments);
        };
    }

    // 兼容 fetch 方式保存计划
    function hookFetch() {
        if (typeof window.fetch !== 'function') {
            return;
        }
        var originalFetch = window.fetch;
        window.fetch = function (input, init) {
            var url = '';
            var method = 'GET';
            var body = init && init.body;
            if (typeof input === 'string') {
                url = input;
                method = (init && init.method) || 'GET';
            } else if (input && typeof input === 'object') {
                url = input.url || '';
                method = (init && init.method) || input.method || 'GET';
            }
            var promise = originalFetch.apply(this, arguments);
            if (isPlanSaveRequest(method, url)) {
                promise.then(function (res) {
                    if (!res || !res.ok) {
                        return res;
                    }
                    try {
                        res.clone()
                            .text()
                            .then(function (text) {
                                handlePlanSaved(text, body);
                            })
                            .catch(function () {});
                    } catch (e) {
                        // 忽略
                    }
                    return res;
                });
            }
            return promise;
        };
    }

    hookXhr();
    hookFetch();
    getCurrentUserKey();
    console.log('[Tempo排期同步] 已启用：修改资源规划计划后会自动同步 JIRA 任务排期');
}

// Tempo 页面（SPA）首次加载或 hash 切换到资源规划时启用排期同步
var tempoPlanSyncInited = false;
export function ensureTempoPlanSync() {
    if (tempoPlanSyncInited) {
        return;
    }
    if (location.href.indexOf(currentDomain + '/secure/Tempo.jspa') !== 0) {
        return;
    }
    if (location.href.indexOf('resource-planning') == -1) {
        return;
    }
    tempoPlanSyncInited = true;
    loadCSS('https://cdnjs.cloudflare.com/ajax/libs/toastify-js/1.12.0/toastify.min.css');
    initTempoPlanSync();
}

// 监听 hash 路由变化（Tempo 是 SPA，切到资源规划页面时再启用）
export function bindTempoPlanSyncRoute() {
    ensureTempoPlanSync();
    window.addEventListener('hashchange', ensureTempoPlanSync);
}
