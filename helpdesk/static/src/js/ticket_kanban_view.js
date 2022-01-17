/** @odoo-module **/

import { TicketKanbanController } from './ticket_kanban_controller';
import { TicketKanbanRenderer } from './ticket_kanban_renderer';
import KanbanView from 'web.KanbanView';
import registry from 'web.view_registry';

export const TicketKanbanView = KanbanView.extend({
    config: Object.assign({}, KanbanView.prototype.config, {
        Controller: TicketKanbanController,
        Renderer: TicketKanbanRenderer,
    }),
});

registry.add('ticket_kanban', TicketKanbanView);
