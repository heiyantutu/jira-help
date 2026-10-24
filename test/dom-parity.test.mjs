// legacy/jira.user.js（重构前单文件，功能基准）vs dist/jira.user.js（模块化构建产物）
// 的 jsdom 黑盒行为对比测试。
//
// 每个场景：两个脚本在互不共享的 jsdom 页面中执行，比较 DOM / Toast / 剪贴板 /
// fetch 请求序列与 payload。所有 fetch 均被 stub，无网络；时间被固定，无随机依赖。
//
// 说明：本文件只写入 test/，不修改产品代码。运行方式：
//   node --test test/            （npm test）
//   或 node test/dom-parity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import { BROWSE_URL, FILTER_URL, TEMPO_URL, compareScenario, delay, textOf } from './helpers/harness.mjs';

const COPY_BUTTON_IDS = ['#copySourceCodeKey', '#copyTitleAndLink', '#copyTitle'];
const TOASTIFY_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/toastify-js/1.12.0/toastify.min.css';

// 对同一场景分别跑 legacy / dist，断言快照完全一致；返回 legacy 快照供绝对值断言。
async function assertParity(scenario, message) {
    const { legacy, dist } = await compareScenario(scenario);
    assert.deepStrictEqual(dist, legacy, message);
    return legacy;
}

// 快照：复制按钮（插入 DOM 后的顺序/属性/文案）
function snapshotCopyButtons(document) {
    const menu = document.getElementById('create-menu');
    const siblings = menu ? [...menu.parentElement.children] : [];
    return {
        domOrder: siblings.map((el) => el.id || el.tagName.toLowerCase()),
        buttons: COPY_BUTTON_IDS.map((selector) => document.querySelector(selector)).map((el) =>
            el
                ? {
                      id: el.id,
                      tag: el.tagName.toLowerCase(),
                      text: textOf(el),
                      class: el.getAttribute('class'),
                      style: el.getAttribute('style'),
                      type: el.getAttribute('type'),
                  }
                : null
        ),
    };
}

function snapshotHeadLinks(document) {
    return [...document.querySelectorAll('head link')].map((link) => ({
        rel: link.getAttribute('rel'),
        type: link.getAttribute('type'),
        href: link.getAttribute('href'),
    }));
}

function snapshotRequests(requests) {
    return requests.map((req) => ({ url: req.url, method: req.method, body: req.body }));
}

function snapshotButtonOrder(document) {
    return [...document.body.children].map((el) => el.id || el.tagName.toLowerCase()).filter((id) => id === 'create-menu' || id.endsWith('Time'));
}

// ===========================================================================
// 场景 1：问题详情页复制按钮
// ===========================================================================
test('场景1：问题详情页复制按钮（插入顺序/文案 + 三个按钮的剪贴板与 Toast）', async () => {
    const legacy = await assertParity(
        {
            url: BROWSE_URL + '?filter=123', // 带查询串，验证复制链接时去掉 ? 后的参数
            html: `<!doctype html><html><head></head><body>
                <div id="create-menu"></div>
                <h1 id="summary-val">修复登录问题</h1>
                <a id="key-val">DEMO-1</a>
                <a id="header-details-user-fullname" data-displayname="张三"></a>
            </body></html>`,
            async run(ctx) {
                ctx.observed.buttons = snapshotCopyButtons(ctx.document);
                ctx.observed.copies = [];
                for (const [selector, name] of [
                    ['#copySourceCodeKey', 'sourceCodeKey'],
                    ['#copyTitleAndLink', 'titleAndLink'],
                    ['#copyTitle', 'title'],
                ]) {
                    await ctx.click(selector);
                    ctx.observed.copies.push({
                        name,
                        clipboard: ctx.clipboard[ctx.clipboard.length - 1],
                        toastText: ctx.toasts.length ? ctx.toasts[ctx.toasts.length - 1].text : null,
                    });
                }
            },
            snapshot(ctx) {
                return {
                    buttons: ctx.observed.buttons,
                    copies: ctx.observed.copies,
                    toasts: ctx.toasts,
                    execCommands: ctx.execCommands,
                    headLinks: snapshotHeadLinks(ctx.document),
                };
            },
        },
        'dist 与 legacy 的复制按钮行为不一致'
    );

    // 绝对值断言：锁定功能基准，避免「两边以同样错误的方式一致」。
    assert.deepStrictEqual(
        legacy.buttons.buttons.map((b) => b && b.id),
        ['copySourceCodeKey', 'copyTitleAndLink', 'copyTitle']
    );
    // 三个按钮都通过 $('#create-menu').after() 依次插入，DOM 顺序与调用顺序相反
    assert.deepStrictEqual(legacy.buttons.domOrder.slice(0, 4), ['create-menu', 'copyTitle', 'copyTitleAndLink', 'copySourceCodeKey']);
    assert.deepStrictEqual(legacy.buttons.buttons, [
        {
            id: 'copySourceCodeKey',
            tag: 'button',
            text: '复制源码关键字',
            class: 'aui-button aui-button-primary aui-style',
            style: 'background-color: green;',
            type: null,
        },
        {
            id: 'copyTitleAndLink',
            tag: 'button',
            text: '复制标题&链接',
            class: 'aui-button aui-button-primary aui-style',
            style: 'background-color: purple;',
            type: null,
        },
        {
            id: 'copyTitle',
            tag: 'button',
            text: '复制标题',
            class: 'aui-button aui-button-primary aui-style',
            style: 'background-color: red;',
            type: null,
        },
    ]);
    assert.deepStrictEqual(legacy.copies, [
        {
            name: 'sourceCodeKey',
            clipboard: '--key=DEMO-1 --user=张三 修复登录问题 https://jira.ihotel.cn/browse/DEMO-1',
            toastText: '复制成功，今天辛苦了！',
        },
        {
            name: 'titleAndLink',
            clipboard: '修复登录问题 https://jira.ihotel.cn/browse/DEMO-1 ',
            toastText: '复制成功，今天辛苦了！',
        },
        { name: 'title', clipboard: '修复登录问题', toastText: '复制成功，今天辛苦了！' },
    ]);
    assert.deepStrictEqual(legacy.execCommands, ['Copy', 'Copy', 'Copy']);
    assert.deepStrictEqual(legacy.headLinks, [{ rel: 'stylesheet', type: 'text/css', href: TOASTIFY_CSS }]);
});

test('场景1b：标题含「非计划内」时复制标题&链接的彩蛋标记', async () => {
    const legacy = await assertParity(
        {
            url: BROWSE_URL,
            html: `<!doctype html><html><head></head><body>
                <div id="create-menu"></div>
                <h1 id="summary-val">临时需求（非计划内）</h1>
                <a id="key-val">DEMO-2</a>
                <a id="header-details-user-fullname" data-displayname="李四"></a>
            </body></html>`,
            async run(ctx) {
                await ctx.click('#copyTitleAndLink');
                ctx.observed.clipboards = [...ctx.clipboard];
                ctx.observed.toastTexts = ctx.toasts.map((t) => t.text);
            },
            snapshot(ctx) {
                return { clipboards: ctx.observed.clipboards, toastTexts: ctx.observed.toastTexts };
            },
        },
        '「非计划内」彩蛋行为不一致'
    );

    assert.deepStrictEqual(legacy.clipboards, ['临时需求（非计划内） https://jira.ihotel.cn/browse/DEMO-1 [鞠躬] ']);
});

// ===========================================================================
// 场景 2：创建子任务自动填充
// ===========================================================================
const SUBTASK_FORM_HTML = `
    <input id="summary" value="">
    <input id="description" value="">
    <input id="customfield_10209" value="">
    <select id="customfield_10700">
        <option value="-1">无</option>
        <option value="1">研发一部</option>
        <option value="2">研发二部</option>
    </select>
    <select id="fixVersions"><option>版本A</option><option>版本B</option></select>
    <textarea id="fixVersions-textarea"></textarea>
    <select id="components"><option>模块甲</option><option>模块乙</option></select>
    <textarea id="components-textarea"></textarea>
`;

const SUBTASK_PARENT_HTML = `
    <div id="summary-val">父任务摘要</div>
    <div id="fixfor-val"><a>版本A</a><a> 版本B </a></div>
    <div id="components-val">
        <a class="blah" title="模块甲">模块甲</a>
        <a class="ellipsis" title="忽略我">x</a>
        <a title="模块乙">模块乙</a>
    </div>
    <div id="customfield_10700-val"><span>研发一部</span><span> 研发二部 </span></div>
    <div id="customfield_10209-val">备注值</div>
`;

function snapshotSubtaskForm(document, ctx) {
    const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : null;
    };
    const selected = (id) =>
        [...(document.getElementById(id)?.options || [])].filter((option) => option.selected).map((option) => textOf(option));
    return {
        summary: val('summary'),
        description: val('description'),
        customfield10209: val('customfield_10209'),
        costDeptSelected: selected('customfield_10700'),
        fixVersionsSelected: selected('fixVersions'),
        fixVersionsTextarea: val('fixVersions-textarea'),
        componentsSelected: selected('components'),
        componentsTextarea: val('components-textarea'),
        autoCopyLogs: ctx.logs.filter((entry) => entry.text.startsWith('autoCopySubTask')).map((entry) => entry.text),
    };
}

test('场景2：创建子任务自动填充（表单延迟渲染 + 200ms 重试）', async () => {
    const legacy = await assertParity(
        {
            url: BROWSE_URL,
            html: `<!doctype html><html><head></head><body>
                ${SUBTASK_PARENT_HTML}
                <a href="#" id="create-subtask">创建子任务</a>
            </body></html>`,
            async run(ctx) {
                // 点「创建子任务」时表单尚未渲染，脚本应进入 200ms 重试
                await ctx.click('#create-subtask');
                await delay(250);
                const form = ctx.document.createElement('form');
                form.id = 'subtask-form';
                form.innerHTML = SUBTASK_FORM_HTML;
                ctx.document.body.appendChild(form);
                await delay(900); // 覆盖多次重试（200/400/600...）
            },
            snapshot(ctx) {
                return snapshotSubtaskForm(ctx.document, ctx);
            },
        },
        'dist 与 legacy 的子任务自动填充行为不一致'
    );

    assert.deepStrictEqual(legacy, {
        summary: '父任务摘要',
        description: '详情见于需求，请[点击查看|https://jira.ihotel.cn/browse/DEMO-1]',
        customfield10209: '备注值',
        // 单选框上 .prop('selected', true) 只有最后一个保持选中（原脚本行为，浏览器同样如此）
        costDeptSelected: ['研发二部'],
        fixVersionsSelected: ['版本B'],
        fixVersionsTextarea: '版本A, 版本B',
        componentsSelected: ['模块乙'],
        componentsTextarea: '模块甲, 模块乙',
        autoCopyLogs: [
            'autoCopySubTask version:版本A,版本B',
            'autoCopySubTask component:模块甲,模块乙',
            'autoCopySubTask costDept:研发一部,研发二部',
        ],
    });
});

test('场景2b：创建并再创建一个时，表单重置后才填充下一个子任务', async () => {
    const legacy = await assertParity(
        {
            url: BROWSE_URL,
            html: `<!doctype html><html><head></head><body>
                ${SUBTASK_PARENT_HTML}
                <form id="subtask-form">${SUBTASK_FORM_HTML}</form>
                <input type="checkbox" id="qf-create-another" checked>
                <button id="create-issue-submit">创建</button>
            </body></html>`,
            async run(ctx) {
                // 表单已有值（未重置）→ 点击「创建」后不应立即覆盖
                ctx.document.getElementById('summary').value = '已填摘要';
                await ctx.click('#create-issue-submit');
                await delay(450);
                ctx.observed.beforeReset = ctx.document.getElementById('summary').value;
                // 模拟 JIRA 重置表单后再等待自动填充
                for (const id of ['summary', 'description', 'customfield_10209', 'fixVersions-textarea', 'components-textarea']) {
                    const el = ctx.document.getElementById(id);
                    if (el) el.value = '';
                }
                await delay(900);
            },
            snapshot(ctx) {
                return { beforeReset: ctx.observed.beforeReset, ...snapshotSubtaskForm(ctx.document, ctx) };
            },
        },
        '「创建并再创建一个」子任务填充行为不一致'
    );

    assert.strictEqual(legacy.beforeReset, '已填摘要');
    assert.strictEqual(legacy.summary, '父任务摘要');
    assert.strictEqual(legacy.description, '详情见于需求，请[点击查看|https://jira.ihotel.cn/browse/DEMO-1]');
});

// ===========================================================================
// 场景 3：需求/任务链接新标签页打开（MutationObserver）
// ===========================================================================
function snapshotLinkTargets(document) {
    return [...document.querySelectorAll('#desc a')].map((a) => ({
        id: a.id,
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        hasIssueKey: a.dataset.issueKey === undefined ? null : a.dataset.issueKey,
    }));
}

const NEW_TAB_HTML = `<!doctype html><html><head></head><body>
    <div class="aui-theme-default" id="desc">
        <a id="l1" href="https://jira.ihotel.cn/browse/FOO-2" data-issue-key="FOO-2">FOO-2</a>
        <a id="l2" href="https://jira.ihotel.cn/browse/FOO-3">无 data-issue-key</a>
        <a id="l3" href="https://jira.ihotel.cn/browse/FOO-4?x=1" data-issue-key="FOO-4">带查询串</a>
        <a id="l4" href="https://jira.ihotel.cn/browse/FOO-5" data-issue-key="FOO-5" target="_blank">已是新标签</a>
        <a id="l5" href="https://example.com/browse/X" data-issue-key="X">外部链接</a>
    </div>
</body></html>`;

function newTabRun(ctx) {
    return async () => {
        await delay(10);
        // 触发 MutationObserver（脚本启动后动态渲染的链接才会被处理）
        const extra = ctx.document.createElement('a');
        extra.id = 'l6';
        extra.setAttribute('href', 'https://jira.ihotel.cn/browse/FOO-6');
        extra.setAttribute('data-issue-key', 'FOO-6');
        extra.textContent = 'FOO-6';
        ctx.document.getElementById('desc').appendChild(extra);
        await delay(30);
    };
}

function newTabSnapshot(ctx) {
    return {
        links: snapshotLinkTargets(ctx.document),
        updateLogs: ctx.logs.filter((entry) => entry.text.includes('Updating target for link')),
    };
}

test('场景3：browse 页动态链接按 data-issue-key 新标签页打开', async () => {
    const legacy = await assertParity(
        {
            url: BROWSE_URL,
            html: NEW_TAB_HTML,
            async run(ctx) {
                await newTabRun(ctx)();
            },
            snapshot: newTabSnapshot,
        },
        'browse 页新标签链接行为不一致'
    );
    const targets = Object.fromEntries(legacy.links.map((link) => [link.id, link.target]));
    assert.deepStrictEqual(targets, {
        l1: '_blank', // 有 data-issue-key → 新标签
        l2: null, // 无 data-issue-key → 不处理
        l3: null, // 带查询串 → 不处理
        l4: '_blank', // 本来已是 _blank
        l5: null, // 非当前 JIRA 域名 → 不处理
        l6: '_blank', // 动态新增 → 新标签
    });
    assert.strictEqual(legacy.updateLogs.length, 2); // l1 + l6
});

test('场景3b：问题筛选列表页所有本域 browse 链接都新标签页打开', async () => {
    const legacy = await assertParity(
        {
            url: FILTER_URL,
            html: NEW_TAB_HTML,
            async run(ctx) {
                await delay(10);
                const extra = ctx.document.createElement('a');
                extra.id = 'l6';
                extra.setAttribute('href', 'https://jira.ihotel.cn/browse/FOO-6');
                extra.textContent = 'FOO-6';
                ctx.document.getElementById('desc').appendChild(extra);
                await delay(30);
            },
            snapshot: newTabSnapshot,
        },
        'filter 页新标签链接行为不一致'
    );

    const targets = Object.fromEntries(legacy.links.map((link) => [link.id, link.target]));
    assert.deepStrictEqual(targets, {
        l1: '_blank',
        l2: '_blank', // 筛选页无需 data-issue-key
        l3: null, // 带查询串 → 不处理
        l4: '_blank',
        l5: null,
        l6: '_blank',
    });
});

// ===========================================================================
// 场景 4：问题筛选列表页计算工时
// ===========================================================================
test('场景4：筛选列表页工时计算按钮与 Toast', async () => {
    const legacy = await assertParity(
        {
            url: FILTER_URL,
            html: `<!doctype html><html><head></head><body>
                <div id="create-menu"></div>
                <table><tbody><tr>
                    <td><span class="timeoriginalestimate">3 hours, 2 days</span></td>
                    <td><span class="timeoriginalestimate">1 day</span></td>
                    <td><span class="aggregatetimespent">4 hours</span></td>
                    <td><span class="aggregatetimespent">1 week</span></td>
                </tr></tbody></table>
            </body></html>`,
            async run(ctx) {
                ctx.observed.buttons = snapshotButtonOrder(ctx.document);
                await ctx.click('#calcTime');
                await delay(10);
                ctx.observed.estimateToast = ctx.toasts.length ? ctx.toasts[ctx.toasts.length - 1].text : null;
                await ctx.click('#reallyCalcTime');
                await delay(10);
                ctx.observed.spentToast = ctx.toasts.length ? ctx.toasts[ctx.toasts.length - 1].text : null;
            },
            snapshot(ctx) {
                return {
                    buttons: ctx.observed.buttons,
                    estimateToast: ctx.observed.estimateToast,
                    spentToast: ctx.observed.spentToast,
                    allToasts: ctx.toasts,
                    headLinks: snapshotHeadLinks(ctx.document),
                };
            },
        },
        'dist 与 legacy 的工时计算行为不一致'
    );

    assert.deepStrictEqual(legacy.buttons, ['create-menu', 'reallyCalcTime', 'calcTime']);
    assert.strictEqual(legacy.estimateToast, '总工时：3.38人天'); // (3*1 + 2*8 + 1*8) / 8
    assert.strictEqual(legacy.spentToast, '总工时：5.50人天'); // (4 + 1*40) / 8
    assert.deepStrictEqual(legacy.headLinks, [{ rel: 'stylesheet', type: 'text/css', href: TOASTIFY_CSS }]);
});

// ===========================================================================
// 场景 5：创建计划 initPlan（DELETE + POST）
// ===========================================================================
const INIT_PLAN_HTML = `<!doctype html><html><head></head><body>
    <div id="key-val" rel="12345">DEMO-1</div>
    <input id="customfield_10300" value="15/三月/2024">
    <input id="customfield_10301" value="20/三月/2024">
    <input id="timetracking_originalestimate" value="2d">
    <span id="assignee-val">
        <span class="aui-avatar-inner"><img src="https://jira.ihotel.cn/secure/useravatar?ownerId=JIRAUSER10515&size=32"></span>
    </span>
    <div name="tempoTableCellContent"><div><input name="value_plan_777" value="旧计划"></div></div>
    <button id="edit-issue-submit">保存</button>
</body></html>`;

test('场景5：创建计划保存时 DELETE 旧计划 + POST 新计划（payload 对比）', async () => {
    const legacy = await assertParity(
        {
            url: BROWSE_URL,
            html: INIT_PLAN_HTML,
            fetch(req) {
                if (req.method === 'DELETE') return { ok: true, status: 204 };
                if (req.method === 'POST') return { ok: true, status: 201 };
                return { ok: true, body: '' };
            },
            async run(ctx) {
                await ctx.click('#edit-issue-submit');
                await delay(80);
            },
            snapshot(ctx) {
                return { requests: snapshotRequests(ctx.requests), toasts: ctx.toasts };
            },
        },
        'dist 与 legacy 的创建计划请求不一致'
    );

    assert.deepStrictEqual(legacy.requests, [
        {
            url: 'https://jira.ihotel.cn/rest/tempo-planning/1/allocation/777',
            method: 'DELETE',
            body: null,
        },
        {
            url: 'https://jira.ihotel.cn/rest/tempo-planning/1/plan',
            method: 'POST',
            body: {
                planItemType: 'ISSUE',
                planItemId: '12345',
                planApproval: null,
                start: '2024-03-15',
                end: '2024-03-20',
                day: '2024-03-15',
                assigneeKey: 'JIRAUSER10515',
                includeNonWorkingDays: false,
                secondsPerDay: 14400, // 2d = 57600s；15~20 号含 2 天周末，(5-2+1)=4 天
            },
        },
    ]);
    assert.deepStrictEqual(legacy.toasts, []);
});

test('场景5b：计划结束早于开始时只提示错误、不发请求', async () => {
    const legacy = await assertParity(
        {
            url: BROWSE_URL,
            html: INIT_PLAN_HTML.replace('value="20/三月/2024"', 'value="10/三月/2024"'),
            fetch(req) {
                return { ok: true, status: 200 };
            },
            async run(ctx) {
                await ctx.click('#edit-issue-submit');
                await delay(80);
            },
            snapshot(ctx) {
                return { requests: snapshotRequests(ctx.requests), toasts: ctx.toasts };
            },
        },
        'dist 与 legacy 的计划日期校验行为不一致'
    );

    assert.deepStrictEqual(legacy.requests, []);
    assert.deepStrictEqual(legacy.toasts, [
        {
            text: '计划完成时间不能早于计划开始时间',
            position: 'center',
            style: { background: 'linear-gradient(to right, red, red)' },
        },
    ]);
});

// ===========================================================================
// 场景 6：列表页排期列 initPlanTime
// ===========================================================================
test('场景6：问题列表页插入排期列与工时列', async () => {
    const issueHtml = (fromDate, toDate, orig, remain) => `<!doctype html><html><body>
        <div id="customfield_10300-val">${fromDate ? `<time>${fromDate}</time>` : ''}</div>
        <div id="customfield_10301-val">${toDate ? `<time>${toDate}</time>` : ''}</div>
        <span id="tt_single_values_orig"> ${orig} </span>
        <span id="tt_single_values_remain"> ${remain} </span>
    </body></html>`;

    const legacy = await assertParity(
        {
            url: BROWSE_URL,
            html: `<!doctype html><html><head></head><body>
                <table id="issuetable"><tbody>
                    <tr data-issuekey="DEMO-1"><td class="issue_actions"></td><td class="progress"></td></tr>
                    <tr data-issuekey="DEMO-2"><td class="issue_actions"></td><td class="progress"></td></tr>
                </tbody></table>
            </body></html>`,
            fetch(req) {
                if (req.url === 'https://jira.ihotel.cn/browse/DEMO-1') {
                    return { ok: true, body: issueHtml('2024-03-15', '2024-03-20', '5d', '2h') };
                }
                if (req.url === 'https://jira.ihotel.cn/browse/DEMO-2') {
                    return { ok: true, body: issueHtml('', '', '', '') };
                }
                return { ok: true, body: '' };
            },
            async run(ctx) {
                await delay(80);
            },
            snapshot(ctx) {
                return {
                    rows: ctx.queryAll('#issuetable tr').map((tr) => ({
                        key: tr.getAttribute('data-issuekey'),
                        cells: [...tr.children].map((td) => ({
                            tag: td.tagName.toLowerCase(),
                            className: td.getAttribute('class'),
                            style: td.getAttribute('style'),
                            text: textOf(td),
                            html: td.innerHTML,
                        })),
                    })),
                    requests: snapshotRequests(ctx.requests),
                };
            },
        },
        'dist 与 legacy 的列表排期列行为不一致'
    );

    assert.deepStrictEqual(legacy.requests, [
        { url: 'https://jira.ihotel.cn/browse/DEMO-1', method: 'GET', body: null },
        { url: 'https://jira.ihotel.cn/browse/DEMO-2', method: 'GET', body: null },
    ]);
    assert.deepStrictEqual(legacy.rows[0], {
        key: 'DEMO-1',
        cells: [
            { tag: 'td', className: 'planTime', style: 'min-width:70px', text: '2024-03-152024-03-20', html: '2024-03-15<br>2024-03-20' },
            { tag: 'td', className: 'issue_actions', style: null, text: '', html: '' },
            { tag: 'td', className: 'progress', style: null, text: '', html: '' },
            { tag: 'td', className: 'timeCount', style: 'min-width:20px', text: '5d2h', html: '5d<br>2h' },
        ],
    });
    assert.deepStrictEqual(legacy.rows[1].cells, [
        { tag: 'td', className: 'planTime', style: 'min-width:70px', text: '开始时间未排结束时间未排', html: '开始时间未排<br>结束时间未排' },
        { tag: 'td', className: 'issue_actions', style: null, text: '', html: '' },
        { tag: 'td', className: 'progress', style: null, text: '', html: '' },
        { tag: 'td', className: 'timeCount', style: 'min-width:20px', text: '', html: '<br>' },
    ]);
});

// ===========================================================================
// 场景 7：Tempo 资源规划排期同步
// ===========================================================================
const TEMPO_PLAN_BODY = {
    planItemType: 'ISSUE',
    planItemId: '12345',
    start: '2024-03-01',
    end: '2024-03-02',
    assigneeKey: 'JIRAUSER10515',
    allocationId: 99,
};

function tempoScenario({ planType, responseAssignee, issueFields }) {
    return {
        url: TEMPO_URL,
        html: '<!doctype html><html><head></head><body><div id="tempo"></div></body></html>',
        fetch(req) {
            if (req.url === '/rest/api/2/myself') {
                return { json: { key: 'JIRAUSER10515' } };
            }
            if (req.url === '/rest/tempo-planning/1/plan') {
                return {
                    body: JSON.stringify([
                        {
                            allocationId: 99,
                            assignee: responseAssignee,
                            planItemInfo: { key: 'DEMO-1' },
                            planStart: '2024-04-01',
                            planEnd: '2024-04-03',
                        },
                    ]),
                };
            }
            if (req.url === '/rest/api/2/issue/DEMO-1?fields=key,customfield_10300,customfield_10301') {
                return { json: { key: 'DEMO-1', fields: issueFields } };
            }
            if (req.url === '/rest/api/2/issue/DEMO-1' && req.method === 'PUT') {
                return { ok: true, status: 204 };
            }
            return { ok: true, body: '' };
        },
        async run(ctx) {
            await delay(20); // 等初始化时 /rest/api/2/myself 完成
            ctx.observed.initRequests = ctx.requests.length;
            ctx.window.fetch('/rest/tempo-planning/1/plan', {
                method: 'PUT',
                body: JSON.stringify({ ...TEMPO_PLAN_BODY, planItemType: planType }),
            });
            await delay(1000); // 500ms debounce + 后续请求
        },
        snapshot(ctx) {
            return {
                hooked: ctx.window.__tempoPlanSyncHooked === true,
                requests: snapshotRequests(ctx.requests),
                toasts: ctx.toasts,
                headLinks: snapshotHeadLinks(ctx.document),
                skipLogs: ctx.logs.filter((entry) => entry.text.includes('非本人的计划，跳过同步')).map((entry) => entry.text),
            };
        },
    };
}

test('场景7：Tempo 保存计划后按响应日期同步 JIRA 任务排期（GET 字段 + PUT 更新）', async () => {
    const legacy = await assertParity(
        tempoScenario({
            planType: 'ISSUE',
            responseAssignee: 'JIRAUSER10515',
            issueFields: { customfield_10300: '2024-03-01', customfield_10301: '2024-03-02' },
        }),
        'dist 与 legacy 的 Tempo 排期同步行为不一致'
    );

    assert.strictEqual(legacy.hooked, true);
    assert.deepStrictEqual(legacy.requests, [
        { url: '/rest/api/2/myself', method: 'GET', body: null },
        {
            url: '/rest/tempo-planning/1/plan',
            method: 'PUT',
            body: { ...TEMPO_PLAN_BODY, planItemType: 'ISSUE' },
        },
        { url: '/rest/api/2/issue/DEMO-1?fields=key,customfield_10300,customfield_10301', method: 'GET', body: null },
        {
            url: '/rest/api/2/issue/DEMO-1',
            method: 'PUT',
            body: { fields: { customfield_10300: '2024-04-01', customfield_10301: '2024-04-03' } },
        },
    ]);
    assert.deepStrictEqual(legacy.toasts, [
        { text: 'DEMO-1 排期已同步至 JIRA：2024-04-01 ~ 2024-04-03', position: 'center', style: null },
    ]);
    assert.deepStrictEqual(legacy.headLinks, [{ rel: 'stylesheet', type: 'text/css', href: TOASTIFY_CSS }]);
});

test('场景7b：planItemType 非 ISSUE 时跳过同步', async () => {
    const legacy = await assertParity(
        tempoScenario({
            planType: 'TASK',
            responseAssignee: 'JIRAUSER10515',
            issueFields: { customfield_10300: '2024-03-01', customfield_10301: '2024-03-02' },
        }),
        'dist 与 legacy 的非 ISSUE 计划跳过逻辑不一致'
    );

    assert.deepStrictEqual(
        legacy.requests.map((req) => `${req.method} ${req.url}`),
        ['GET /rest/api/2/myself', 'PUT /rest/tempo-planning/1/plan']
    );
    assert.deepStrictEqual(legacy.toasts, []);
});

test('场景7c：计划负责人非本人时跳过同步', async () => {
    const legacy = await assertParity(
        tempoScenario({
            planType: 'ISSUE',
            responseAssignee: 'JIRAUSER99999',
            issueFields: { customfield_10300: '2024-03-01', customfield_10301: '2024-03-02' },
        }),
        'dist 与 legacy 的非本人计划跳过逻辑不一致'
    );

    assert.deepStrictEqual(
        legacy.requests.map((req) => `${req.method} ${req.url}`),
        ['GET /rest/api/2/myself', 'PUT /rest/tempo-planning/1/plan']
    );
    assert.deepStrictEqual(legacy.toasts, []);
    assert.deepStrictEqual(legacy.skipLogs, ['[Tempo排期同步] DEMO-1 非本人的计划，跳过同步']);
});

// ===========================================================================
// 场景 8：路由分发——非 JIRA 页面不初始化任何功能
// ===========================================================================
test('场景8：非 JIRA 页面不插入按钮/不请求/不注入 CSS', async () => {
    const legacy = await assertParity(
        {
            url: 'https://example.com/unrelated',
            html: `<!doctype html><html><head></head><body>
                <div id="create-menu"></div>
                <div class="aui-theme-default">
                    <a id="l1" href="https://jira.ihotel.cn/browse/FOO-2" data-issue-key="FOO-2">FOO-2</a>
                </div>
            </body></html>`,
            async run(ctx) {
                ctx.document.body.appendChild(ctx.document.createElement('div'));
                await delay(30);
            },
            snapshot(ctx) {
                return {
                    copyButtons: COPY_BUTTON_IDS.map((selector) => Boolean(ctx.document.querySelector(selector))),
                    calcButtons: ['#calcTime', '#reallyCalcTime'].map((selector) => Boolean(ctx.document.querySelector(selector))),
                    headLinks: snapshotHeadLinks(ctx.document),
                    requests: snapshotRequests(ctx.requests),
                    hooked: ctx.window.__tempoPlanSyncHooked === true,
                    linkTarget: ctx.document.getElementById('l1').getAttribute('target'),
                    toasts: ctx.toasts,
                };
            },
        },
        '非 JIRA 页面的路由分发行为不一致'
    );

    assert.deepStrictEqual(legacy, {
        copyButtons: [false, false, false],
        calcButtons: [false, false],
        headLinks: [],
        requests: [],
        hooked: false,
        linkTarget: null,
        toasts: [],
    });
});

// ===========================================================================
// 场景 9：内网 JIRA 域名（currentDomain 判定）与 projects/issues 路由
// ===========================================================================
test('场景9：内网 JIRA 域名下复制按钮/剪贴板/新标签链接使用内网域名', async () => {
    const legacy = await assertParity(
        {
            url: 'http://192.168.0.151:8080/browse/DEMO-1',
            html: `<!doctype html><html><head></head><body>
                <div id="create-menu"></div>
                <h1 id="summary-val">内网任务</h1>
                <a id="key-val">DEMO-1</a>
                <a id="header-details-user-fullname" data-displayname="王五"></a>
                <div class="aui-theme-default" id="desc">
                    <a id="l1" href="http://192.168.0.151:8080/browse/FOO-2" data-issue-key="FOO-2">内网链接</a>
                    <a id="l2" href="https://jira.ihotel.cn/browse/FOO-3" data-issue-key="FOO-3">正式环境链接</a>
                </div>
            </body></html>`,
            async run(ctx) {
                const extra = ctx.document.createElement('a');
                extra.id = 'l3';
                extra.setAttribute('href', 'http://192.168.0.151:8080/browse/FOO-4');
                extra.setAttribute('data-issue-key', 'FOO-4');
                extra.textContent = 'FOO-4';
                ctx.document.getElementById('desc').appendChild(extra);
                await delay(30);
                await ctx.click('#copyTitleAndLink');
            },
            snapshot(ctx) {
                return {
                    buttons: snapshotCopyButtons(ctx.document).buttons.map((b) => b && b.id),
                    clipboard: ctx.clipboard[ctx.clipboard.length - 1],
                    toastTexts: ctx.toasts.map((t) => t.text),
                    targets: snapshotLinkTargets(ctx.document),
                    hooked: ctx.window.__tempoPlanSyncHooked === true,
                };
            },
        },
        '内网 JIRA 域名的复制/新标签链接行为不一致'
    );

    assert.deepStrictEqual(legacy.buttons, ['copySourceCodeKey', 'copyTitleAndLink', 'copyTitle']);
    assert.strictEqual(legacy.clipboard, '内网任务 http://192.168.0.151:8080/browse/DEMO-1 ');
    assert.deepStrictEqual(
        legacy.targets.map((link) => [link.id, link.target]),
        [
            ['l1', '_blank'], // 内网域名 → 处理
            ['l2', null], // 正式环境域名 ≠ currentDomain → 不处理
            ['l3', '_blank'],
        ]
    );
    assert.strictEqual(legacy.hooked, false);
});

test('场景9b：projects/.../issues 页面同样初始化复制按钮', async () => {
    const legacy = await assertParity(
        {
            url: 'https://jira.ihotel.cn/projects/DEMO/issues',
            html: `<!doctype html><html><head></head><body>
                <div id="create-menu"></div>
                <h1 id="summary-val">项目问题列表</h1>
                <a id="key-val">DEMO-1</a>
            </body></html>`,
            async run() {},
            snapshot(ctx) {
                return {
                    buttons: snapshotCopyButtons(ctx.document).buttons.map((b) => b && b.id),
                    headLinks: snapshotHeadLinks(ctx.document),
                };
            },
        },
        'projects/issues 路由初始化行为不一致'
    );

    assert.deepStrictEqual(legacy.buttons, ['copySourceCodeKey', 'copyTitleAndLink', 'copyTitle']);
    assert.deepStrictEqual(legacy.headLinks, [{ rel: 'stylesheet', type: 'text/css', href: TOASTIFY_CSS }]);
});

test('场景7d：Tempo 通过 XHR 保存计划时同样同步 JIRA 排期（XHR 钩子路径）', async () => {
    const responsePlans = JSON.stringify([
        {
            allocationId: 99,
            assignee: 'JIRAUSER10515',
            planItemInfo: { key: 'DEMO-1' },
            planStart: '2024-05-01',
            planEnd: '2024-05-03',
        },
    ]);
    const legacy = await assertParity(
        {
            url: TEMPO_URL,
            html: '<!doctype html><html><head></head><body><div id="tempo"></div></body></html>',
            fetch(req) {
                if (req.url === '/rest/api/2/myself') return { json: { key: 'JIRAUSER10515' } };
                if (req.url === '/rest/api/2/issue/DEMO-1?fields=key,customfield_10300,customfield_10301') {
                    return { json: { key: 'DEMO-1', fields: { customfield_10300: '2024-03-01', customfield_10301: '2024-03-02' } } };
                }
                if (req.url === '/rest/api/2/issue/DEMO-1' && req.method === 'PUT') return { ok: true, status: 204 };
                return { ok: true, body: '' };
            },
            xhr: {
                respond() {
                    return { status: 200, body: responsePlans };
                },
            },
            async run(ctx) {
                await delay(20);
                const xhr = new ctx.window.XMLHttpRequest();
                xhr.open('PUT', '/rest/tempo-planning/1/plan');
                xhr.send(JSON.stringify({ ...TEMPO_PLAN_BODY, planItemType: 'ISSUE' }));
                await delay(1000);
            },
            snapshot(ctx) {
                return {
                    xhrRequests: ctx.xhrRequests.map((req) => ({ url: req.url, method: req.method, body: req.body })),
                    requests: snapshotRequests(ctx.requests),
                    toasts: ctx.toasts,
                };
            },
        },
        'XHR 保存计划路径与 legacy 不一致'
    );

    assert.deepStrictEqual(legacy.xhrRequests, [
        { url: '/rest/tempo-planning/1/plan', method: 'PUT', body: { ...TEMPO_PLAN_BODY, planItemType: 'ISSUE' } },
    ]);
    assert.deepStrictEqual(legacy.requests, [
        { url: '/rest/api/2/myself', method: 'GET', body: null },
        { url: '/rest/api/2/issue/DEMO-1?fields=key,customfield_10300,customfield_10301', method: 'GET', body: null },
        {
            url: '/rest/api/2/issue/DEMO-1',
            method: 'PUT',
            body: { fields: { customfield_10300: '2024-05-01', customfield_10301: '2024-05-03' } },
        },
    ]);
    assert.deepStrictEqual(legacy.toasts, [
        { text: 'DEMO-1 排期已同步至 JIRA：2024-05-01 ~ 2024-05-03', position: 'center', style: null },
    ]);
});

test('场景7e：Tempo 页面 hashchange 重复触发时排期同步只初始化一次', async () => {
    const legacy = await assertParity(
        {
            url: TEMPO_URL,
            html: '<!doctype html><html><head></head><body><div id="tempo"></div></body></html>',
            fetch(req) {
                if (req.url === '/rest/api/2/myself') return { json: { key: 'JIRAUSER10515' } };
                return { ok: true, body: '' };
            },
            async run(ctx) {
                await delay(20);
                ctx.window.dispatchEvent(new ctx.window.Event('hashchange'));
                await delay(50);
                ctx.window.dispatchEvent(new ctx.window.Event('hashchange'));
                await delay(50);
            },
            snapshot(ctx) {
                return {
                    hooked: ctx.window.__tempoPlanSyncHooked === true,
                    headLinks: snapshotHeadLinks(ctx.document),
                    requests: snapshotRequests(ctx.requests),
                };
            },
        },
        'Tempo hashchange 重复初始化行为不一致'
    );

    assert.strictEqual(legacy.hooked, true);
    assert.deepStrictEqual(legacy.headLinks, [{ rel: 'stylesheet', type: 'text/css', href: TOASTIFY_CSS }]);
    assert.deepStrictEqual(legacy.requests, [{ url: '/rest/api/2/myself', method: 'GET', body: null }]);
});
