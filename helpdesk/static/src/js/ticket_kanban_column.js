/** @odoo-module **/

import KanbanColumn from 'web.KanbanColumn';

export const TicketKanbanColumn = KanbanColumn.extend({
    /**
     * @override
     * @private
     */
    _onDeleteColumn(event) {
        if (this.groupedBy === 'stage_id') {
            event.preventDefault();
            this.trigger_up('kanban_column_delete_wizard');
        } else {
            this._super.apply(this, arguments);
        }
    },
});
