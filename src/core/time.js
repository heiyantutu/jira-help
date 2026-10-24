// 工时 / 日期相关的纯函数（不依赖 DOM，便于单元测试）

// 把 "3 hours, 2 days" 这类工时文本数组换算成小时数
export function parseTime(arr) {
    let hours = 0;
    let arrs = [];
    let timeToHour = {
        hour: 1,
        hours: 1,
        day: 8,
        days: 8,
        week: 40,
        weeks: 40,
        minute: 0.01667,
        minutes: 0.01667,
    };

    arr.forEach((n) => {
        if (n.indexOf(',') > 0) {
            let time = n.split(',');
            arrs.push(time[0]);
            arrs.push(time[1].trim());
        } else {
            arrs.push(n);
        }
    });

    arrs.forEach((m) => {
        let dataCount = m.split(' ')[0];
        let dateType = m.split(' ')[1];
        hours += dataCount * timeToHour[dateType];
    });
    return hours;
}

// 把 JIRA 时间跟踪输入框里的 "1d 2h 30m" 解析成秒
export function parseTimeString(timeString) {
    const timeUnits = {
        w: 7 * 8 * 60 * 60, // 1 week = 7 days
        d: 8 * 60 * 60, // 1 day = 8 hours
        h: 60 * 60, // 1 hour = 60 minutes
        m: 60, // 1 minute = 60 seconds
        s: 1, // 1 second = 1 second
    };

    const regex = /(\d+)([wdhms])/g;
    let match;
    let totalSeconds = 0;

    while ((match = regex.exec(timeString)) !== null) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        totalSeconds += value * timeUnits[unit];
    }

    return totalSeconds;
}

// 把 JIRA 中文日期（01/一月/2024）转换成 moment 可解析的英文日期
export function convertChineseDateToEnglish(dateStr) {
    // 分割字符串
    const parts = dateStr.split('/');
    const day = parts[0];
    const monthCN = parts[1];
    const year = parts[2];
    // 中文月份到英文月份的映射
    const monthMap = {
        一月: 'Jan',
        二月: 'Feb',
        三月: 'Mar',
        四月: 'Apr',
        五月: 'May',
        六月: 'Jun',
        七月: 'Jul',
        八月: 'Aug',
        九月: 'Sep',
        十月: 'Oct',
        十一月: 'Nov',
        十二月: 'Dec',
    };
    // 转换月份
    const monthEN = monthMap[monthCN];
    if (!monthEN) {
        throw new Error('Invalid month');
    }
    // 重新组合
    return `${day}/${monthEN}/${year}`;
}

// 从 URL 中取查询参数（原脚本用于从头像地址里取 JIRA 用户 ownerId）
export function getUrlParameter(url, name) {
    var regexS = '[\\?&]' + name + '=([^&#]*)';
    var regex = new RegExp(regexS);
    var results = regex.exec(url);
    if (results == null) {
        return '';
    }
    return results[1];
}

// 日期显示格式 YYYY/MM/DD -> DD/MM/YYYY
// 保留自原脚本：目前没有任何地方调用，保留以免遗漏历史功能
export function betterTimeDisplay(str) {
    if (str) {
        return str.split('/').reverse().join('/');
    }
}
