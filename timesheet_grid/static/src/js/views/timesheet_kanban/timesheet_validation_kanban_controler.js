/** @odoo-module **/

import { KanbanController } from "@web/views/kanban/kanban_controller";

export class TimesheetValidationKanbanController extends KanbanController {

    async validateTimesheet() {
        const result = await this.model.orm.call(this.props.resModel, "action_validate_timesheet", [[this.props.resIds]]);
        await this.model.notificationService.add(result.param.title, { type: result.params.type });
        this.render(true);
    }

}
