// 统一的 Toast 提示
// Toastify 由 UserScript 头部 @require 引入，挂载在 window 上

export function notify(text) {
    Toastify({
        text: text,
        position: 'center',
    }).showToast();
}

export function notifyError(text) {
    Toastify({
        text: text,
        position: 'center',
        style: {
            background: 'linear-gradient(to right, red, red)',
        },
    }).showToast();
}
