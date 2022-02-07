/** @odoo-module **/

import KanbanRenderer from 'web.KanbanRenderer';
import { HelpdeskKanbanRecord } from '@helpdesk/js/helpdesk_kanban_record';

export const HelpdeskKanbanRenderer = KanbanRenderer.extend({
    config: Object.assign({}, KanbanRenderer.prototype.config, {
        KanbanRecord: HelpdeskKanbanRecord,
    }),
    /**
     * @override
     */
    async start() {
        this.el.classList.add('o_helpdesk_view', 'position-relative', 'align-content-start', 'flex-grow-1', 'flex-shrink-1');
        await this._super(...arguments);
    },

});
