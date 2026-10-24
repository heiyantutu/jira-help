// 复制文本到剪贴板
// 兼容老版 JIRA：创建临时 input + document.execCommand('Copy')

export function copyTextToClipboard(text) {
    var input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, input.value.length);
    document.execCommand('Copy');
    document.body.removeChild(input);
}
