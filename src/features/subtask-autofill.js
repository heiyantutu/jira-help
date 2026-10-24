// 创建子任务时自动填充父任务信息：
// - 摘要、描述（附父任务链接）
// - 成本部门、修复版本、模块
// - 支持「创建并再创建一个」连续创建子任务

// 收集父任务（需求/任务）上需要带到子任务的信息
export function collectParentIssueData() {
    if (!$('#summary-val').length) {
        return null;
    }

    let versionArray = [];
    $('#fixfor-val')
        .find('a')
        .each(function () {
            let text = $(this).text().trim();
            if (text) {
                versionArray.push(text);
            }
        });

    let componentArray = [];
    $('#components-val')
        .find('a')
        .each(function () {
            if (!this.classList.contains('ellipsis')) {
                let title = this.title;
                if (title) {
                    componentArray.push(title);
                }
            }
        });

    let costDeptArray = [];
    $('#customfield_10700-val')
        .find('span')
        .each(function () {
            let text = $(this).text().trim();
            if (text) {
                costDeptArray.push(text);
            }
        });

    return {
        summary: $('#summary-val').text().trim(),
        customfield_10209: $('#customfield_10209-val').text().trim(),
        costDeptArray: costDeptArray,
        componentArray: componentArray,
        versionArray: versionArray,
        mianLink: window.location.href.split('?')[0],
    };
}

// 同步多选下拉框的选中状态与 textarea 显示
function syncMultiSelectUi(selectId, values) {
    let $select = $('#' + selectId);
    let $textarea = $('#' + selectId + '-textarea');
    if (!$select.length) {
        return;
    }

    $select.find('option').prop('selected', false);
    values.forEach(function (item) {
        $select.find('option').each(function () {
            if ($(this).text().trim() === item) {
                $(this).prop('selected', true);
            }
        });
    });

    if ($textarea.length) {
        $textarea.val(values.join(', ')).trigger('input').trigger('change');
    }
    $select.trigger('change');
}

// 把父任务信息填进子任务表单（表单可能有延迟渲染，最多重试 30 次 * 200ms）
export function fillSubTaskForm(data, retryCount) {
    if (!data) {
        return;
    }
    retryCount = retryCount || 0;

    if (!$('#summary').length) {
        if (retryCount < 30) {
            setTimeout(function () {
                fillSubTaskForm(data, retryCount + 1);
            }, 200);
        }
        return;
    }

    if (!$('#summary').val().trim()) {
        $('#summary').val(data.summary);
    }

    let description = '详情见于需求，请[点击查看|' + data.mianLink + ']';
    if (!$('#description').val().trim() && description.trim() !== '点击添加描述信息') {
        $('#description').val(description);
    }

    if ($('#customfield_10209').length && !$('#customfield_10209').val().trim()) {
        $('#customfield_10209').val(data.customfield_10209);
    }

    if ($('#customfield_10700').length && data.costDeptArray.length > 0) {
        let hasCostDept =
            $('#customfield_10700 option:selected').filter(function () {
                return $(this).val() !== '-1';
            }).length > 0;
        if (!hasCostDept) {
            $('#customfield_10700 option').prop('selected', false);
            data.costDeptArray.forEach(function (item) {
                $('#customfield_10700 option').each(function () {
                    if ($(this).text().trim() === item) {
                        $(this).prop('selected', true);
                    }
                });
            });
            $('#customfield_10700').trigger('change');
        }
    }

    if ($('#fixVersions-textarea').length && !$('#fixVersions-textarea').val().trim() && data.versionArray.length > 0) {
        syncMultiSelectUi('fixVersions', data.versionArray);
    }

    if ($('#components-textarea').length && !$('#components-textarea').val().trim() && data.componentArray.length > 0) {
        syncMultiSelectUi('components', data.componentArray);
    }
}

export function autoCopySubTask() {
    let data = collectParentIssueData();
    if (!data) {
        return;
    }
    console.log('autoCopySubTask version:' + data.versionArray.join(','));
    console.log('autoCopySubTask component:' + data.componentArray.join(','));
    console.log('autoCopySubTask costDept:' + data.costDeptArray.join(','));
    fillSubTaskForm(data);
}

// 点击「创建并再创建一个」后，等表单重置完再填充下一个子任务
export function autoCopySubTaskAfterCreateAnother() {
    let data = collectParentIssueData();
    if (!data) {
        return;
    }

    let attempts = 0;
    function waitForReset() {
        attempts++;
        let formReady = $('#summary').length > 0;
        let formReset = formReady && !$('#summary').val().trim();

        if (formReady && formReset) {
            fillSubTaskForm(data);
            return;
        }
        if (attempts < 40) {
            setTimeout(waitForReset, 200);
        }
    }
    setTimeout(waitForReset, 300);
}

// 注册子任务自动填充相关事件（所有页面绑定，实际由页面元素决定是否触发）
export function bindSubTaskAutoFill() {
    $(document).on('click', '#stqc_show,#create-subtask', function () {
        autoCopySubTask();
    });
    $(document).on('click', '#create-issue-submit', function () {
        if ($('#qf-create-another').prop('checked')) {
            autoCopySubTaskAfterCreateAnother();
        }
    });
}
