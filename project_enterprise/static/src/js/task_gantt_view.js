/** @odoo-module **/

import viewRegistry from 'web.view_registry';
import GanttView from 'web_gantt.GanttView';
import GanttController from 'web_gantt.GanttController';
import GanttRenderer from 'web_gantt.GanttRenderer';
import { TaskGanttModel } from '@project_enterprise/js/task_gantt_model';
import { ProjectControlPanel } from '@project/js/project_control_panel';

const ProjectGanttRenderer = GanttRenderer.extend({
    async _renderView() {
        await this._super(...arguments);
        this.el.classList.add('o_project_gantt');
    },
});

export const TaskGanttView = GanttView.extend({
    config: Object.assign({}, GanttView.prototype.config, {
        Controller: GanttController,
        Renderer: ProjectGanttRenderer,
        Model: TaskGanttModel,
        ControlPanel: ProjectControlPanel,
    }),
});

viewRegistry.add('task_gantt', TaskGanttView);
