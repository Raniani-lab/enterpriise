/** @odoo-module **/

import KanbanRecord from 'web.KanbanRecord';

export const HelpdeskKanbanRecord = KanbanRecord.extend({
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    _openRecord() {
        const kanbanTicketElement = this.el.querySelector('.o_helpdesk_ticket_btn');
        if (!this.selectionMode && this.modelName === 'helpdesk.team' && kanbanTicketElement) {
            kanbanTicketElement.click();
        } else {
            this._super(...arguments);
        }
    },
});
