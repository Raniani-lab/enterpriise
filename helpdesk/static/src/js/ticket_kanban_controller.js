/** @odoo-module **/

import KanbanController from 'web.KanbanController';

export const TicketKanbanController = KanbanController.extend({
    custom_events: Object.assign({}, KanbanController.prototype.custom_events, {
        kanban_column_delete_wizard: '_onDeleteColumnWizard',
    }),

    /**
     * @private
     * @param {OdooEvent} e
     */
    async _onDeleteColumnWizard(e) {
        e.stopPropagation();
        const column_id = e.target.id;
        const state = this.model.get(this.handle, {raw: true});
        const action = await this._rpc({
            model: 'helpdesk.stage',
            method: 'action_unlink_wizard',
            args: [column_id],
            context: state.getContext(),
        });
        this.do_action(action);
    }
});
