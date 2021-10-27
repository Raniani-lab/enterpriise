/** @odoo-module **/

import KanbanController from 'web.KanbanController';
import KanbanView from 'web.KanbanView';
import viewRegistry from 'web.view_registry';

export const TimesheetValidationKanbanController = KanbanController.extend({
    buttons_template: 'TimesheetKanbanView.buttons',
    events: Object.assign({}, KanbanController.prototype.events, {
        'click .o_timesheet_kanban_validate': '_onValidateButtonClicked',
    }),

    //----------------------------------------------------------------------
    // Handlers
    //----------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    async _onValidateButtonClicked(ev) {
        ev.stopPropagation();
        const state = this.model.get(this.handle, {raw: true});
        const recordIds = state.data.map(record => record.res_id);
        const res = await this._rpc({
            model: 'account.analytic.line',
            method: 'action_validate_timesheet',
            args: [recordIds],
        });
        this.displayNotification({type: res.params.type, title: res.params.title});
        this.reload();
    },
});

const TimesheetValidationKanbanView = KanbanView.extend({
    config: Object.assign({}, KanbanView.prototype.config, {
        Controller: TimesheetValidationKanbanController,
    })
});

viewRegistry.add('timesheet_validation_kanban', TimesheetValidationKanbanView);
