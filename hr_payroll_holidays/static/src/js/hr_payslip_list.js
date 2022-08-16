/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PayslipListController } from "@hr_payroll/js/payslip_list";
import { useTimeOffToDefer } from '@hr_payroll_holidays/js/hr_work_entries_controller_mixin_owl';

patch(PayslipListController.prototype, 'hr_payroll_holidays_payslip_holidays_list_controller', {
    setup() {
        this._super.apply(this, arguments);
        useTimeOffToDefer('.o_list_renderer', { position: "first-child" });
    }
});
