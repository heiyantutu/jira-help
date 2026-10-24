// 问题筛选列表页：计算「预估工时 / 实际工时」并提示总人天
import { loadCSS } from '../core/dom.js';
import { notify } from '../core/notify.js';
import { parseTime } from '../core/time.js';

// 计算工时：className 为 JIRA 列表中的工时列 class
export function calcWorkTime(className) {
    let timeoriginalestimate = document.querySelectorAll(className);
    let timesDescArray = [];
    timeoriginalestimate.forEach((n) => {
        if (n.textContent) {
            timesDescArray.push(n.textContent);
        }
    });

    let hours = parseTime(timesDescArray);
    let days = Number(hours / 8).toFixed(2);
    notify('总工时：' + days + '人天');
}

// 在问题筛选列表页初始化两个计算工时按钮
export function initIssueFilterTimeButtons() {
    $('#create-menu').after(
        '<button class="aui-button aui-button-primary aui-style" style="background-color: red;" id="calcTime">预估工时</button>'
    );
    $('#create-menu').after(
        '<button class="aui-button aui-button-primary aui-style" style="background-color: green;" id="reallyCalcTime">实际工时</button>'
    );
    loadCSS('https://cdnjs.cloudflare.com/ajax/libs/toastify-js/1.12.0/toastify.min.css');
    $('#calcTime').on('click', function () {
        calcWorkTime('.timeoriginalestimate');
    });
    $('#reallyCalcTime').on('click', function () {
        calcWorkTime('.aggregatetimespent');
    });
}
