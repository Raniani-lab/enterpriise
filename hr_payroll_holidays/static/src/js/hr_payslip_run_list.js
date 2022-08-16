/** @odoo-module **/

import { registry } from '@web/core/registry';
import { listView } from '@web/views/list/list_view';
import { ListController } from "@web/views/list/list_controller";
import { useTimeOffToDefer } from '@hr_payroll_holidays/js/hr_work_entries_controller_mixin_owl';

export class PayslipRunController extends ListController {
    setup() {
        super.setup();
        useTimeOffToDefer('.o_list_renderer', { position: "first-child" });
    }
}

registry.category('views').add('hr_payslip_run_tree', {
    ...listView,
    Controller: PayslipRunController,
    buttonTemplate: 'hr_payroll_holidays.ListViewButtonTemplate'
});
