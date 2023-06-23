/** @odoo-module **/

import SalaryPackageWidget from "@hr_contract_salary/js/hr_contract_salary";
import core from "@web/legacy/js/services/core";

var qweb = core.qweb;

SalaryPackageWidget.include({
    updateGrossToNetModal(data) {
        var modal_body = $(qweb.render('hr_contract_salary_payroll.salary_package_brut_to_net_modal', {'datas': data.payslip_lines}));
        this.$("main.modal-body").html(modal_body);
        this._super.apply(this, arguments);
    },
});
