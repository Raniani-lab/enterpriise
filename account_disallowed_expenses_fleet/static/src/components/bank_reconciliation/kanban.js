/** @odoo-module **/
import { patch } from "@web/core/utils/patch";

import { BankRecKanbanController } from "@account_accountant/components/bank_reconciliation/kanban";

patch(BankRecKanbanController.prototype, "account_disallowed_expenses_fleet", {
    getBankRecLineInvalidFields(line){
        const invalidFields = this._super(...arguments);
        if (line.data.vehicle_required && !line.data.vehicle_id) {
            invalidFields.push("vehicle");
        }
        return invalidFields;
    }
});
