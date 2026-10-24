// 修改 JIRA 任务排期时同步 Tempo 资源规划：
// 1. 在问题编辑弹窗里修改「预计开始 / 预计结束」后点击保存
// 2. 校验计划完成时间不能早于计划开始时间
// 3. 删除 Tempo 上该任务原有的计划（如果有）
// 4. 按新的时间范围重新创建 Tempo 计划
import { notifyError } from '../core/notify.js';
import { convertChineseDateToEnglish, getUrlParameter, parseTimeString } from '../core/time.js';

export function initPlan() {
    $(document).on('click', '#edit-issue-submit', function () {
        var startTime = $('#customfield_10300').val();
        var endTime = $('#customfield_10301').val();
        var planItemId = $('#key-val').attr('rel');
        let timetracking_originalestimate = $('#timetracking_originalestimate').val();
        // 当前经办人头像地址，ownerId 即 JIRA 用户 key
        var url = $('#assignee-val .aui-avatar-inner img').attr('src');
        let assigneeKey = getUrlParameter(url, 'ownerId');
        if (startTime && endTime && timetracking_originalestimate) {
            let tempoTableCellContent = $('[name="tempoTableCellContent"]');
            let deleteId = '';
            let newStartTime = moment(convertChineseDateToEnglish(startTime));
            let newEndTime = moment(convertChineseDateToEnglish(endTime));
            if (newEndTime.isBefore(newStartTime)) {
                notifyError('计划完成时间不能早于计划开始时间');
                return false;
            }
            function traverseAndExtractId(element) {
                $(element)
                    .children()
                    .each(function () {
                        // 检查当前元素是否有 name 属性
                        var nameAttr = $(this).attr('name');
                        if (nameAttr) {
                            // 使用正则表达式匹配并提取数字部分
                            var match = nameAttr.match(/value_plan_(\d+)$/);
                            if (match) {
                                deleteId = match[1];
                            }
                        }
                        // 递归遍历子元素
                        traverseAndExtractId(this);
                    });
            }
            traverseAndExtractId(tempoTableCellContent);
            // 注意：Tempo 接口地址固定使用正式环境域名，沿用原脚本行为
            function deletePlan(id, cb) {
                fetch(`https://jira.ihotel.cn/rest/tempo-planning/1/allocation/${id}`, {
                    method: 'DELETE', // *GET, POST, PUT, DELETE, etc.
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                    .then((res) => {
                        cb && cb();
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                    });
            }
            function addPlan() {
                function getCountWeekends(startDateStr, endDateStr) {
                    const startDate = startDateStr;
                    const endDate = endDateStr;
                    let countWeekends = 0;
                    let currentDate = startDate.clone();
                    while (currentDate.isBefore(endDate) || currentDate.isSame(endDate)) {
                        const dayOfWeek = currentDate.day();
                        if (dayOfWeek === 0) {
                            countWeekends++;
                        } else if (dayOfWeek === 6) {
                            countWeekends++;
                        }
                        currentDate.add(1, 'days');
                    }
                    return countWeekends;
                }
                let countWeekends = getCountWeekends(newStartTime, newEndTime);
                let data = {
                    planItemType: 'ISSUE',
                    planItemId: planItemId,
                    planApproval: null,
                    start: newStartTime.format('YYYY-MM-DD'),
                    end: newEndTime.format('YYYY-MM-DD'),
                    day: moment().format('YYYY-MM-DD'),
                    assigneeKey: assigneeKey,
                    includeNonWorkingDays: false,
                    secondsPerDay:
                        parseTimeString(timetracking_originalestimate) /
                        (newEndTime.diff(newStartTime, 'days') - countWeekends + 1),
                };
                fetch('https://jira.ihotel.cn/rest/tempo-planning/1/plan', {
                    method: 'POST', // *GET, POST, PUT, DELETE, etc.
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });
            }
            if (deleteId) {
                deletePlan(deleteId, () => {
                    addPlan();
                });
            } else {
                addPlan();
            }
        }
    });
}
