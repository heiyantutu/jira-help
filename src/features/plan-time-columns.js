// 问题列表页：在列表里补充显示「预计开始 / 预计结束」与工时信息
// 逐个请求问题详情页（/browse/{key}）并解析对应的字段，插入到问题行中
export function initPlanTime() {
    let theList = $('#issuetable tr');
    let issueList = [];
    theList.each((i, n) => {
        if ($(n).attr('data-issuekey')) {
            issueList.push(n);
        }
    });
    if (issueList.length > 0) {
        issueList.forEach((n) => {
            let issuekey = $(n).attr('data-issuekey');
            fetch(`https://jira.ihotel.cn/browse/${issuekey}`, {
                method: 'GET',
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.text();
                })
                .then((html) => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    let fromDate = $(doc).find('#customfield_10300-val time').text();
                    let toDate = $(doc).find('#customfield_10301-val time').text();
                    // 与 legacy 脚本保持完全一致的单行模板，便于自动校验功能字符串
                    // prettier-ignore
                    var $planTimeTd = $(`<td class="planTime" style="min-width:70px">${fromDate ? fromDate : "开始时间未排"}<br>${toDate ? toDate :"结束时间未排"}</td>`);
                    $(n).find('.issue_actions').before($planTimeTd);
                    let orig = $(doc).find('#tt_single_values_orig').text().trim();
                    let remain = $(doc).find('#tt_single_values_remain').text().trim();
                    var $timeCount = $(`<td class="timeCount" style="min-width:20px">${orig}<br>${remain}</td>`);
                    $(n).find('.progress').after($timeCount);
                });
        });
    }
}
