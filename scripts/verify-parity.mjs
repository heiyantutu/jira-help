#!/usr/bin/env node
// 重构功能校验：对比 legacy/jira.user.js（重构前原脚本）与 dist/jira.user.js（构建产物）
// 确保「功能都保留」：
//   1. UserScript 元数据逐项一致（@version 允许升级，额外新增的 @homepageURL 等字段允许）
//   2. 原脚本里的每个函数都还能在产物中找到
//   3. 原脚本里的每个字符串字面量（按钮 id、CSS 选择器、接口地址、提示文案等）都还能在产物中找到
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const legacy = readFileSync(new URL('legacy/jira.user.js', root), 'utf8').replace(/\r\n/g, '\n');
const dist = readFileSync(new URL('dist/jira.user.js', root), 'utf8').replace(/\r\n/g, '\n');

// 重构时有意去掉的字符串：
// - '\\['、'\\\\\\]'：历史上用于拼接 getUrlParameter 的正则转义，实际是坏掉的空字符类，永远不生效
// - '，还在工作，您太卷了！'：原脚本里被注释掉的文案（不是功能）
const REMOVED_LITERALS = new Set(['\\[', '\\\\\\]', '，还在工作，您太卷了！']);

const failures = [];
const sections = [];

function report(name, checkedCount, missing) {
    sections.push({ name, checkedCount, missing });
    if (missing.length) {
        failures.push({ name, missing });
    }
}

// ---------- 1. UserScript 元数据 ----------
function parseMeta(source) {
    const block = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
    const result = new Map();
    if (!block) {
        return result;
    }
    for (const line of block[1].split('\n')) {
        const matched = line.match(/^\/\/\s+@(\S+)\s+(.*)$/);
        if (!matched) {
            continue;
        }
        const key = matched[1];
        const value = matched[2].trim();
        if (!result.has(key)) {
            result.set(key, []);
        }
        result.get(key).push(value);
    }
    return result;
}

const legacyMeta = parseMeta(legacy);
const distMeta = parseMeta(dist);
const metaMissing = [];
let metaChecked = 0;
for (const [key, values] of legacyMeta) {
    if (key === 'version') {
        continue; // 允许升级版本号
    }
    const distValues = distMeta.get(key) || [];
    values.forEach((value) => {
        metaChecked++;
        if (!distValues.includes(value)) {
            metaMissing.push(`@${key} ${value}`);
        }
    });
}
report('UserScript 元数据', metaChecked, metaMissing);

// ---------- 2. 函数声明 ----------
function collectFunctionNames(source) {
    const names = new Set();
    for (const matched of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
        names.add(matched[1]);
    }
    for (const matched of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*function\b/g)) {
        names.add(matched[1]);
    }
    return names;
}

function isFunctionPresent(name, source) {
    const escaped = name.replace(/\$/g, '\\$');
    // 函数声明：function foo(...)
    if (new RegExp(`\\bfunction\\s+${escaped}\\s*\\(`).test(source)) {
        return true;
    }
    // 函数表达式：const foo = function (...) / const foo = (...) => ...
    return new RegExp(`\\b${escaped}\\s*=\\s*(?:async\\s+)?(?:function\\b|\\()`).test(source);
}

const legacyFunctions = collectFunctionNames(legacy);
const functionMissing = [...legacyFunctions].filter((name) => !isFunctionPresent(name, dist));
report('函数声明', legacyFunctions.size, functionMissing);

// ---------- 3. 字符串字面量（功能选择器 / 接口地址 / 提示文案） ----------
function collectStringLiterals(source) {
    const literals = new Set();
    const regex = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
    for (const matched of source.matchAll(regex)) {
        const value = matched[0].slice(1, -1);
        if (value.length > 0) {
            literals.add(value);
        }
    }
    return literals;
}

const legacyLiterals = collectStringLiterals(legacy);
const literalMissing = [...legacyLiterals].filter((literal) => {
    if (REMOVED_LITERALS.has(literal)) {
        return false;
    }
    return !dist.includes(literal);
});
report('字符串字面量', legacyLiterals.size, literalMissing);

// ---------- 输出 ----------
let hasFailure = false;
for (const section of sections) {
    if (section.missing.length === 0) {
        console.log(`✓ ${section.name}：${section.checkedCount} 项全部保留`);
        continue;
    }
    hasFailure = true;
    console.error(`✗ ${section.name}：${section.missing.length}/${section.checkedCount} 项缺失`);
    for (const item of section.missing.slice(0, 30)) {
        console.error(`    - ${item}`);
    }
    if (section.missing.length > 30) {
        console.error(`    ... 其余 ${section.missing.length - 30} 项省略`);
    }
}

if (hasFailure) {
    console.error('\n功能校验失败：重构后疑似丢失了以上功能，请检查。');
    process.exit(1);
}

console.log('\n功能校验通过：原脚本的元数据、函数与功能字符串在构建产物中均保留。');
