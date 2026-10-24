// 入口文件：按原脚本的初始化顺序装配各功能模块
// 1. 全局事件绑定（所有页面注册，实际由页面元素决定是否触发）
// 2. 需求/任务链接新标签页打开
// 3. Tempo 资源规划排期同步（hash 路由）
// 4. 问题详情页 / 项目问题列表页：复制按钮、创建计划、列表排期列
// 5. 问题筛选列表页：计算工时
import { loadCSS } from './core/dom.js';
import { currentDomain, locationhref } from './core/env.js';
import { initCopyIssueButtons } from './features/copy-issue.js';
import { initOpenIssueLinksInNewTab } from './features/open-in-new-tab.js';
import { initPlan } from './features/plan-schedule.js';
import { initPlanTime } from './features/plan-time-columns.js';
import { bindSubTaskAutoFill } from './features/subtask-autofill.js';
import { bindTempoPlanSyncRoute } from './features/tempo-plan-sync.js';
import { initIssueFilterTimeButtons } from './features/worktime-calc.js';

bindSubTaskAutoFill();

initOpenIssueLinksInNewTab();

bindTempoPlanSyncRoute();

if (
    locationhref.indexOf(currentDomain + '/browse/') == 0 ||
    (locationhref.indexOf(currentDomain + '/projects/') == 0 && locationhref.indexOf('issues') != -1)
) {
    loadCSS('https://cdnjs.cloudflare.com/ajax/libs/toastify-js/1.12.0/toastify.min.css');
    initCopyIssueButtons();
    initPlan();
    initPlanTime();
}

if (locationhref.indexOf(currentDomain + '/issues/?filter') == 0) {
    initIssueFilterTimeButtons();
}
