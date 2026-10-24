// 纯函数单元测试：不依赖 DOM，直接 import src 下的模块
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    betterTimeDisplay,
    convertChineseDateToEnglish,
    getUrlParameter,
    parseTime,
    parseTimeString,
} from '../src/core/time.js';
import { getSpecialContent, getSpecialText } from '../src/greetings/index.js';

// 在固定时间下执行函数（greetings 内部使用 new Date()）
function withNow({ year, monthIndex, day, hours }, fn) {
    const RealDate = Date;
    class FakeDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) {
                super(year, monthIndex, day, hours, 0, 0);
            } else {
                super(...args);
            }
        }
        static now() {
            return new RealDate(year, monthIndex, day, hours, 0, 0).getTime();
        }
    }
    globalThis.Date = FakeDate;
    try {
        return fn();
    } finally {
        globalThis.Date = RealDate;
    }
}

test('parseTime：JIRA 工时文本换算成小时', () => {
    assert.equal(parseTime([]), 0);
    assert.equal(parseTime(['3 hours', '2 days']), 19);
    assert.equal(parseTime(['1 week', '8 hours']), 48);
    // 原脚本兼容 "3 hours, 2 days" 这种带逗号的文本
    assert.equal(parseTime(['3 hours, 2 days']), 19);
    assert.ok(Math.abs(parseTime(['30 minutes']) - 0.5001) < 1e-9);
});

test('parseTimeString：JIRA 时间跟踪输入换算成秒', () => {
    assert.equal(parseTimeString('1w'), 7 * 8 * 60 * 60);
    assert.equal(parseTimeString('1d'), 8 * 60 * 60);
    assert.equal(parseTimeString('2h 30m'), 2 * 60 * 60 + 30 * 60);
    assert.equal(parseTimeString('1d 2h 3m 4s'), 8 * 3600 + 2 * 3600 + 3 * 60 + 4);
    assert.equal(parseTimeString(''), 0);
});

test('convertChineseDateToEnglish：中文月份转英文月份', () => {
    assert.equal(convertChineseDateToEnglish('01/一月/2024'), '01/Jan/2024');
    assert.equal(convertChineseDateToEnglish('31/十二月/2025'), '31/Dec/2025');
    assert.equal(convertChineseDateToEnglish('15/五月/24'), '15/May/24');
    assert.throws(() => convertChineseDateToEnglish('01/不存在的月份/2024'), /Invalid month/);
});

test('getUrlParameter：从 URL 中取 ownerId', () => {
    assert.equal(getUrlParameter('https://jira.ihotel.cn/avatar?ownerId=JIRAUSER10515', 'ownerId'), 'JIRAUSER10515');
    assert.equal(getUrlParameter('https://jira.ihotel.cn/avatar?foo=1&ownerId=U2&bar=3', 'ownerId'), 'U2');
    assert.equal(getUrlParameter('https://jira.ihotel.cn/avatar', 'ownerId'), '');
    assert.equal(getUrlParameter(undefined, 'ownerId'), '');
});

test('betterTimeDisplay：日期反转显示（原脚本保留的工具函数）', () => {
    assert.equal(betterTimeDisplay('2024/05/01'), '01/05/2024');
    assert.equal(betterTimeDisplay(''), undefined);
});

test('getSpecialContent：节日彩蛋前缀', () => {
    assert.equal(withNow({ year: 2024, monthIndex: 0, day: 1, hours: 12 }, () => getSpecialContent('随便一个标题')), '[烟花] ');
    assert.equal(
        withNow({ year: 2024, monthIndex: 1, day: 14, hours: 12 }, () => getSpecialContent('随便一个标题')),
        '[送花花] '
    );
    // 标题中包含「非计划内」（且不在开头）时追加鞠躬彩蛋
    assert.equal(
        withNow({ year: 2024, monthIndex: 5, day: 1, hours: 12 }, () => getSpecialContent('标题-非计划内需求')),
        '[鞠躬] '
    );
    assert.equal(
        withNow({ year: 2024, monthIndex: 5, day: 1, hours: 12 }, () => getSpecialContent('非计划内需求')),
        ''
    );
});

test('getSpecialText：节日 / 时段彩蛋文案', () => {
    assert.equal(withNow({ year: 2024, monthIndex: 0, day: 1, hours: 12 }, () => getSpecialText()), '，元旦快乐！');
    assert.equal(withNow({ year: 2024, monthIndex: 4, day: 4, hours: 12 }, () => getSpecialText()), '，青年人，靠你了！');
    assert.equal(withNow({ year: 2024, monthIndex: 9, day: 3, hours: 12 }, () => getSpecialText()), '，国庆快乐！');
    assert.equal(withNow({ year: 2024, monthIndex: 11, day: 25, hours: 12 }, () => getSpecialText()), '，圣诞快乐！');
    assert.equal(withNow({ year: 2024, monthIndex: 5, day: 1, hours: 19 }, () => getSpecialText()), '，今天辛苦了！');
    assert.equal(withNow({ year: 2024, monthIndex: 5, day: 1, hours: 22 }, () => getSpecialText()), '，还在工作，你太卷了！');
    assert.equal(withNow({ year: 2024, monthIndex: 5, day: 1, hours: 3 }, () => getSpecialText()), '，太拼了，注意休息！');
    assert.equal(withNow({ year: 2024, monthIndex: 5, day: 1, hours: 8 }, () => getSpecialText()), '，早上好！');
    // 普通时段是随机文案，只校验格式
    const normal = withNow({ year: 2024, monthIndex: 5, day: 1, hours: 12 }, () => getSpecialText());
    assert.ok(normal.startsWith('，'));
    assert.ok(normal.length > 2);
});
