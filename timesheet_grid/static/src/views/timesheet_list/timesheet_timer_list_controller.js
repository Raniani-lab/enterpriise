/** @odoo-module */

import { useState } from "@odoo/owl";

import { ListController } from "@web/views/list/list_controller";

export class TimesheetTimerListController extends ListController {
    static template = "timesheet_grid.TimesheetTimerListController";

    setup() {
        super.setup();
        this.timerState = useState({ reload: false });
    }

    get deleteConfirmationDialogProps() {
        this.timerState.reload = false;
        const dialogProps = super.deleteConfirmationDialogProps;
        if (this.model.root.selection.some((t) => t.data.is_timer_running)) {
            const oldConfirm = dialogProps.confirm;
            dialogProps.confirm = async () => {
                await oldConfirm();
                this.timerState.reload = true;
            }
        }
        return dialogProps;
    }
}
