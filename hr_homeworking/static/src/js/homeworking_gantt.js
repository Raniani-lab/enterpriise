/** @odoo-module **/

import GanttView from 'web_gantt.GanttView';
import viewRegistry from 'web.view_registry';

import HomeworkingGanttController from './homeworking_gantt_controller';
import HomeworkingGanttRenderer from './homeworking_gantt_renderer';

const HomeworkingGanttView = GanttView.extend({
    config: _.extend({}, GanttView.prototype.config, {
        Controller: HomeworkingGanttController,
        Renderer: HomeworkingGanttRenderer,
    }),
});
viewRegistry.add('homeworking_gantt', HomeworkingGanttView);

export default HomeworkingGanttView;
