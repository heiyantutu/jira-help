import { readFileSync } from 'node:fs';

// UserScript 元数据单独维护在 src/meta.js，构建时作为 banner 注入产物顶部
const meta = readFileSync(new URL('./src/meta.js', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n')
    .trimEnd();

export default {
    input: 'src/main.js',
    // 关闭 tree-shaking：源码中可能保留暂未被调用的工具函数，构建时不应被移除
    treeshake: false,
    output: {
        file: 'dist/jira.user.js',
        format: 'iife',
        banner: meta + '\n',
        sourcemap: false,
    },
};
