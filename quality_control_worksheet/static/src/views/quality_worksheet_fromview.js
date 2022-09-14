/** @odoo-module **/

import { registry } from "@web/core/registry";
import { RelationalModel } from "@web/views/basic_relational_model";
import { formView } from "@web/views/form/form_view";
import { FormController } from "@web/views/form/form_controller";

class WorksheetValidationController extends FormController {

    async save(params = {}) {
        await super.save(params);
        let record = this.model.root.data;
        let context = this.model.root.context;
        // after studio exit, although the mode is readonly, the save button is visible
        if (this.props.mode != 'readonly'){
            let action = await this.model.orm.call('quality.check', 'action_worksheet_check', [record.x_quality_check_id[0]], {context});
            this.model.actionService.doAction(action);
        }
    }

    async discard() {
        await super.discard();
        let record = this.model.root.data;
        let context = this.model.root.context;
        let action = await this.model.orm.call('quality.check', 'action_worksheet_discard', [record.x_quality_check_id[0]], {context});
        this.model.actionService.doAction(action);
    }
}

class WorksheetValidationModel extends RelationalModel {
    get canBeAbandoned() {
        return false;
    }
}

export const WorksheetValidationFormView = {
    ...formView,
    Controller: WorksheetValidationController,
    Model: WorksheetValidationModel
};

registry.category("views").add("worksheet_validation", WorksheetValidationFormView);
