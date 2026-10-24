// 节日 / 时段相关的彩蛋文案，被「复制」相关功能复用

// 获取复制内容前面的特殊标记
export function getSpecialContent(title) {
    let text = '';
    let now = new Date();
    let month = now.getMonth();
    let date = now.getDate();
    if (month === 0 && date === 1) {
        // 元旦
        text = '[烟花] ';
    } else if (month === 1 && date === 14) {
        // 2月14号
        text = '[送花花] ';
    } else if (month === 3 && date === 1) {
        // 4月1号
        text = '[调皮] ';
    } else if (month === 10 && date === 11) {
        // 11月11号
        text = '[火箭] ';
    } else if (title.indexOf('非计划内') > 0) {
        text = '[鞠躬] ';
    }
    return text;
}

// 获取复制成功提示里的彩蛋文案
export function getSpecialText() {
    let text = '';
    let now = new Date();
    let hours = now.getHours();
    let month = now.getMonth();
    let date = now.getDate();
    if (month === 0 && date === 1) {
        // 元旦
        text = '，元旦快乐！';
    } else if (month === 1 && date === 14) {
        // 2月14号
        let randNum = Math.floor(Math.random() * 2);
        let specialTextArr = ['无论如何都要幸福呀！', '情人节快乐！'];
        text = '，' + specialTextArr[randNum];
    } else if (month === 3 && date === 1) {
        // 4月1号
        let randNum = Math.floor(Math.random() * 5);
        let specialTextArr = ['再工作，系统将崩溃！', '愚人节快乐！', '略略略^v^', '你被骗啦！', '哈哈哈哈！'];
        text = '，' + specialTextArr[randNum];
    } else if (month === 4 && date === 1) {
        // 5月1号
        let randNum = Math.floor(Math.random() * 5);
        let specialTextArr = ['打工是不可能打工的！', '打工仔也太拼了！', '劳动节快乐^v^', '劳动节就该劳动起来！', '劳动最光荣！'];
        text = '，' + specialTextArr[randNum];
    } else if (month === 4 && date === 4) {
        // 5月4号
        text = '，青年人，靠你了！';
    } else if (month === 9 && date >= 1 && date <= 7) {
        // 10月1号至7号
        text = '，国庆快乐！';
    } else if (month === 10 && date === 11) {
        // 11月11号
        text = '，即使一个人也要好好生活！';
    } else if (month === 11 && date === 25) {
        // 12月25号
        text = '，圣诞快乐！';
    } else if (hours >= 18 && hours <= 20) {
        // 18点到20点
        text = '，今天辛苦了！';
    } else if (hours >= 21 && hours <= 23) {
        // 21点到23点
        text = '，还在工作，你太卷了！';
    } else if (hours >= 0 && hours <= 6) {
        // 0点到6点
        text = '，太拼了，注意休息！';
    } else if (hours >= 7 && hours <= 8) {
        // 7点到8点
        text = '，早上好！';
    } else {
        let randNum = Math.floor(Math.random() * 9);
        let specialTextArr = ['加油呀！', '奥利给^v^', '又是美好的一天！', '太棒了！', '努力呀！', '任重而道远！', '完美！', 'nice！', '你最棒了！'];
        text = '，' + specialTextArr[randNum];
    }

    return text;
}
