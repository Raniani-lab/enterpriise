/** @odoo-module **/

import viewRegistry from 'web.view_registry';
import GanttView from 'web_gantt.GanttView';
import GanttController from 'web_gantt.GanttController';
import GanttRenderer from 'web_gantt.GanttRenderer';
import { TaskGanttModel } from '@project_enterprise/js/task_gantt_model';

export const TaskGanttView = GanttView.extend({
    config: Object.assign({}, GanttView.prototype.config, {
        Controller: GanttController,
        Renderer: GanttRenderer,
        Model: TaskGanttModel,
    }),
});

viewRegistry.add('task_gantt', TaskGanttView);
