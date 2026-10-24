// 问题详情页顶部的「复制」按钮组：
// - 复制源码关键字
// - 复制标题&链接
// - 复制标题
import { copyTextToClipboard } from '../core/clipboard.js';
import { notify } from '../core/notify.js';
import { getSpecialContent, getSpecialText } from '../greetings/index.js';

// 复制源码关键字
export function copySourceCodeKey() {
    $('#create-menu').after(
        '<button class="aui-button aui-button-primary aui-style" style="background-color: green;" id="copySourceCodeKey">复制源码关键字</button>'
    );
    $(document).on('click', '#copySourceCodeKey', function () {
        var link = window.location.href.split('?')[0]; // 去除查询参数
        var title = $('#summary-val').text();
        var displayname = $('#header-details-user-fullname').data('displayname');
        var keyval = $('#key-val').text();
        copyTextToClipboard('--key=' + keyval + ' --user=' + displayname + ' ' + title + ' ' + link);
        notify('复制成功' + getSpecialText());
    });
}

// 复制标题与链接
export function createCopyTitleAndLink() {
    $('#create-menu').after(
        '<button class="aui-button aui-button-primary aui-style" style="background-color: purple;" id="copyTitleAndLink">复制标题&链接</button>'
    );
    $(document).on('click', '#copyTitleAndLink', function () {
        var link = window.location.href.split('?')[0]; // 去除查询参数
        var title = $('#summary-val').text();
        copyTextToClipboard(title + ' ' + link + ' ' + getSpecialContent(title));
        notify('复制成功' + getSpecialText());
    });
}

// 复制标题
export function createCopyTitle() {
    $('#create-menu').after(
        '<button class="aui-button aui-button-primary aui-style" style="background-color: red;" id="copyTitle">复制标题</button>'
    );
    $(document).on('click', '#copyTitle', function () {
        var title = $('#summary-val').text();
        copyTextToClipboard(title);
        notify('复制成功' + getSpecialText());
    });
}

// 在问题详情页初始化三个复制按钮
export function initCopyIssueButtons() {
    copySourceCodeKey();
    createCopyTitleAndLink();
    createCopyTitle();
}
