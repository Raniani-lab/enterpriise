odoo.define('project_forecast.ForecastGanttRenderer', function (require) {
'use strict';

var GanttRenderer = require('web_gantt.GanttRenderer');
var ForecastGanttRow = require('project_forecast.ForecastGanttRow');

var ForecastGanttRenderer = GanttRenderer.extend({
    /**
     * Render a row outside the DOM.
     *
     * Note that we directly call the private function _widgetRenderAndInsert to
     * prevent from generating a documentFragment for each row we have to
     * render. The Widget API should offer a proper way to start a widget
     * without inserting it anywhere.
     *
     * @private
     * @override
     * @param {Object} pillsInfo
     * @param {Object} params
     * @returns {Promise<GanttRow>} resolved when the row is ready
     */
    _renderRow: function (pillsInfo, params) {
        var ganttRow = new ForecastGanttRow(this, pillsInfo, this.viewInfo, params);
        this.rowWidgets[ganttRow.rowId] = ganttRow;
        this.proms.push(ganttRow._widgetRenderAndInsert(function () {}));
        return ganttRow;
    },

});

return ForecastGanttRenderer;

});