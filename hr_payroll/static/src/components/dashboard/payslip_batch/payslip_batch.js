/** @odoo-module **/

import core from 'web.core';

const { Component } = owl;

const _t = core._t;

export class PayrollDashboardPayslipBatch extends Component {

    /**
     * @returns {object} Complete data provided as props
     */
    get data() {
        return this.props['data'];
    }

    /**
     * Handles clicking on the title
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickTitle(ev) {
        this.trigger('do-action', {
            action: 'hr_payroll.action_hr_payslip_run_tree',
        });
    }

    /**
     * Handles clicking on the line
     *
     * @private
     * @param {number} BatchID
     */
    _onClickLine(BatchID) {
        this.trigger('do-action', {
            action: {
                type: 'ir.actions.act_window',
                name: _t('Employee Payslips'),
                res_model: 'hr.payslip',
                domain: [['payslip_run_id', '=', BatchID]],
                views: [[false, 'list'], [false, 'form']],
            }
        });
    }
}

PayrollDashboardPayslipBatch.template = 'hr_payroll.PayslipBatch';
