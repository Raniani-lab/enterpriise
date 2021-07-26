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

    _onManageTogglerClicked: function (event) {
        this._super.apply(this, arguments);
        const thisSettingToggle = this.el.querySelector('.o_kanban_manage_toggle_button');
        this.el.parentNode.querySelectorAll('.o_kanban_manage_toggle_button.show').forEach(el => {
            if (el !== thisSettingToggle) {
                el.classList.remove('show');
            }
        });
        thisSettingToggle.classList.toggle('show');
    },
});
