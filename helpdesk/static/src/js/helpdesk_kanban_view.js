/** @odoo-module  **/

import { _lt } from 'web.core';
import { HelpdeskKanbanController } from './helpdesk_kanban_controller';
import { HelpdeskKanbanRenderer } from './helpdesk_kanban_renderer';
import KanbanView from 'web.KanbanView';
import registry from 'web.view_registry';

export const HelpdeskDashboardView = KanbanView.extend({
    config: Object.assign({}, KanbanView.prototype.config, {
        Renderer: HelpdeskKanbanRenderer,
        Controller: HelpdeskKanbanController,
    }),
    display_name: _lt('Dashboard'),
    icon: 'fa-dashboard',
    searchview_hidden: true,
});

registry.add('helpdesk_dashboard', HelpdeskDashboardView);
