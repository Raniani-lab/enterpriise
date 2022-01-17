/** @odoo-module **/

import KanbanRenderer from 'web.KanbanRenderer';
import { TicketKanbanColumn } from './ticket_kanban_column';

export const TicketKanbanRenderer = KanbanRenderer.extend({
    config: Object.assign({}, KanbanRenderer.prototype.config, {
        KanbanColumn: TicketKanbanColumn,
    }),
});
