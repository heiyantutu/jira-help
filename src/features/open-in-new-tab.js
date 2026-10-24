// 需求 / 任务链接在新标签页打开：
// 用 MutationObserver 持续处理页面动态渲染出来的问题链接（详情页、问题筛选列表）
import { currentDomain, locationhref } from '../core/env.js';

let numCount = 0;
let mutationCount = 0;

const checkForLinks = function () {
    mutationCount++;

    const descriptionLinks = [...document.getElementsByClassName('aui-theme-default')].flatMap((e) => [
        ...e.getElementsByTagName('a'),
    ]);
    for (const link of descriptionLinks) {
        let replace = false;
        if (
            locationhref.indexOf(currentDomain + '/issues/?filter') == 0 &&
            link.target !== '_blank' &&
            link.href.indexOf(currentDomain + '/browse/') == 0 &&
            link.href.indexOf('?') == -1 &&
            link.href.indexOf('#') == -1
        ) {
            replace = true;
        } else if (
            link.target !== '_blank' &&
            link.href.indexOf(currentDomain + '/browse/') == 0 &&
            link.href.indexOf('?') == -1 &&
            link.href.indexOf('#') == -1 &&
            link.dataset &&
            link.dataset.issueKey &&
            link.dataset.issueKey != ''
        ) {
            replace = true;
        }
        if (replace) {
            numCount++;
            console.log(`[${mutationCount}] [${numCount}] Updating target for link ${link.href}`);
            link.target = '_blank';
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                return false;
            });
        }
    }
};

// 开始监听页面 DOM 变化
export function initOpenIssueLinksInNewTab() {
    const observer = new MutationObserver(checkForLinks);
    observer.observe(document.body, { attributes: false, childList: true, subtree: true });
    return observer;
}
