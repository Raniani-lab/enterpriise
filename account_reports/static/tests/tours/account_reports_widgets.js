/** @odoo-module **/

import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add('account_reports_widgets', {
    test: true,
    url: '/web?#action=account_reports.action_account_report_pl',
    steps: () => [
        {
            content: "change date filter",
            trigger: ".acc_rep_filter_date button",
            run: 'click',
        },
        {
            content: "change date filter",
            trigger: ".acc_rep_filter_date span:contains('Last Financial Year')",
            run: 'click'
        },
        {
            content: "wait refresh",
            trigger: ".acc_rep_filter_date button:contains('2019')",
        },
        {
            content: "change comparison filter",
            trigger: ".acc_rep_filter_comparison button",
        },
        {
            content: "wait for Apply button and click on it",
            trigger: ".acc_rep_filter_comparison .acc_rep_search.o_filter_date:first() button",
            run: 'click',
        },
        {
            content: "wait refresh, report should have 4 columns",
            trigger: "th + th + th + th",
            run: function(){},
        },
        {
            title: "export xlsx",
            trigger: "button:contains('XLSX')",
            run: 'click'
        },
    ]
});
