/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";

const { Component } = owl;

export class PayrollDashboardPayslipBatch extends Component {
    setup() {
        this.actionService = useService("action");
    }

    /**
     * Handles clicking on the title
     */
    onClickTitle() {
        this.actionService.doAction('hr_payroll.action_hr_payslip_run_tree');
    }

    getColorFromState(state) {
        const colorMap = {
            'New': 'bg-info bg-opacity-50',
            'Confirmed': 'bg-success bg-opacity-50',
            'Done': 'bg-primary bg-opacity-50',
            'Paid': 'bg-warning bg-opacity-50',
        };
        return colorMap[state] || 'bg-primary'
    }

    /**
     * Handles clicking on the line
     *
     * @param {number} batchID
     * @param {string} batchNames
     */
    onClickLine(batchID, batchName) {
        this.actionService.doAction({
            name: batchName,
            type: 'ir.actions.act_window',
            name: this.env._t('Employee Payslips'),
            res_model: 'hr.payslip.run',
            res_id: batchID,
            views: [[false, 'form']],
        });
    }
}

PayrollDashboardPayslipBatch.template = 'hr_payroll.PayslipBatch';
