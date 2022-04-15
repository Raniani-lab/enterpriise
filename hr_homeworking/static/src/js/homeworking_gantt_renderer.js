/** @odoo-module **/

import GanttRenderer from 'web_gantt.GanttRenderer';
import HomeworkingGanttRow from './homeworking_gantt_row';

export default GanttRenderer.extend({
    config: Object.assign({}, GanttRenderer.prototype.config, {
        GanttRow: HomeworkingGanttRow
    }),
});
