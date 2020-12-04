# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _
from odoo.http import request

from odoo.addons.hr_contract_salary.controllers import main
from odoo.addons.sign.controllers.main import Sign

class SignContract(Sign):

    def _update_contract_on_signature(self, request_item, contract):
        result = super()._update_contract_on_signature(request_item, contract)
        if request_item.sign_request_id.nb_closed == 2:
            auto_allocation = request.env.company.hr_contract_timeoff_auto_allocation
            if auto_allocation and contract.holidays:
                time_off_type = request.env.company.hr_contract_timeoff_auto_allocation_type_id
                request.env['hr.leave.allocation'].create({
                    'name': time_off_type.name,
                    'employee_id': contract.employee_id.id,
                    'number_of_days': contract.holidays,
                    'holiday_status_id': time_off_type.id})
        return result
