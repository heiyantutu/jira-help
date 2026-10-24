// 运行时环境信息：当前页面地址与 JIRA 站点域名
// 脚本只在内网 JIRA（192.168.0.151:8080）与正式环境（jira.ihotel.cn）生效

export const locationhref = window.location.href;

let currentDomain = 'http://192.168.0.151:8080';
if (locationhref.indexOf('https://jira.ihotel.cn') === 0) {
    currentDomain = 'https://jira.ihotel.cn';
}

export { currentDomain };
