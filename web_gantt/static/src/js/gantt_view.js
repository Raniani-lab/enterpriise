odoo.define('web_gantt.GanttView', function (require) {
"use strict";

var AbstractView = require('web.AbstractView');
var core = require('web.core');
var GanttModel = require('web_gantt.GanttModel');
var GanttRenderer = require('web_gantt.GanttRenderer');
var GanttController = require('web_gantt.GanttController');
var pyUtils = require('web.py_utils');
var view_registry = require('web.view_registry');

var _t = core._t;
var _lt = core._lt;

var GanttView = AbstractView.extend({
    display_name: _lt('Gantt'),
    icon: 'fa-tasks',
    config: {
        Model: GanttModel,
        Controller: GanttController,
        Renderer: GanttRenderer,
    },
    viewType: 'gantt',

    /**
     * @override
     */
    init: function (viewInfo, params) {
        this._super.apply(this, arguments);

        this.SCALES = {
            day: { string: _t('Day'), cellPrecisions: { full: 60, half: 30, quarter: 15 }, defaultPrecision: 'full', time: 'minutes', interval: 'hour' },
            week: { string: _t('Week'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            month: { string: _t('Month'), cellPrecisions: { full: 24, half: 12 }, defaultPrecision: 'half', time: 'hours', interval: 'day' },
            year: { string: _t('Year'), cellPrecisions: { full: 1 }, defaultPrecision: 'full', time: 'months', interval: 'month' },
        };

        var arch = this.arch;

        // Decoration fields
        var decorationFields = [];
        _.each(arch.children, function (child) {
            if (child.tag === 'field') {
                decorationFields.push(child.attrs.name);
            }
        });

        var collapseFirstLevel = !!arch.attrs.collapse_first_level;

        // Unavailability
        var displayUnavailability = !!arch.attrs.display_unavailability;

        // Colors
        var colorField = arch.attrs.color;

        // Cell precision
        // precision = {'day': 'hour:half', 'week': 'day:half', 'month': 'day', 'year': 'month:quarter'}
        var precisionAttrs = arch.attrs.precision ? pyUtils.py_eval(arch.attrs.precision) : {};
        var cellPrecisions = {};
        _.each(this.SCALES, function (vals, key) {
            if (precisionAttrs[key]) {
                var precision = precisionAttrs[key].split(':'); // hour:half
                // Note that precision[0] (which is the cell interval) is not
                // taken into account right now because it is no customizable.
                if (precision[1] && _.contains(_.keys(vals.cellPrecisions), precision[1])) {
                    cellPrecisions[key] = precision[1];
                }
            }
            cellPrecisions[key] = cellPrecisions[key] || vals.defaultPrecision;
        });

        var consolidationMaxField;
        var consolidationMaxValue;
        var consolidationMax = arch.attrs.consolidation_max ? pyUtils.py_eval(arch.attrs.consolidation_max) : {};
        if (Object.keys(consolidationMax).length > 0) {
            consolidationMaxField = Object.keys(consolidationMax)[0];
            consolidationMaxValue = consolidationMax[consolidationMaxField];
            // We need to display the aggregates even if there is only one groupby
            collapseFirstLevel = !!consolidationMaxField || collapseFirstLevel;
        }

        var consolidationParams = {
            field: arch.attrs.consolidation,
            maxField: consolidationMaxField,
            maxValue: consolidationMaxValue,
            excludeField: arch.attrs.consolidation_exclude,
        };

        // form view which is opened by gantt
        var formViewId = false;
        if (params.action) {
            var contextID = params.action.context.form_view_id;
            var result = _.findWhere(params.action.views, { type: 'form' });
            formViewId = contextID || (result ? result.viewID : false);
        }
        var dialogViews = [[formViewId, 'form']];

        this.controllerParams.context = params.context || {};
        this.controllerParams.dialogViews = dialogViews;
        this.controllerParams.SCALES = this.SCALES;
        this.controllerParams.collapseFirstLevel = collapseFirstLevel;

        this.loadParams.initialDate = moment(params.initialDate || new Date());
        this.loadParams.collapseFirstLevel = collapseFirstLevel;
        this.loadParams.colorField = colorField;
        this.loadParams.dateStartField = arch.attrs.date_start;
        this.loadParams.dateStopField = arch.attrs.date_stop;
        this.loadParams.progressField = arch.attrs.progress;
        this.loadParams.decorationFields = decorationFields;
        this.loadParams.defaultGroupBy = this.arch.attrs.default_group_by;
        this.loadParams.displayUnavailability = displayUnavailability;
        this.loadParams.fields = this.fields;
        this.loadParams.scale = arch.attrs.default_scale || 'month';
        this.loadParams.consolidationParams = consolidationParams;

        this.rendererParams.canCreate = this.controllerParams.activeActions.create;
        this.rendererParams.canEdit = this.controllerParams.activeActions.edit;
        this.rendererParams.fieldsInfo = viewInfo.fields;
        this.rendererParams.SCALES = this.SCALES;
        this.rendererParams.cellPrecisions = cellPrecisions;
        this.rendererParams.totalRow = arch.attrs.total_row || false;
        this.rendererParams.string = arch.attrs.string || _t('Gantt View');
        this.rendererParams.popoverTemplate = _.findWhere(arch.children, {tag: 'templates'});
        this.rendererParams.colorField = colorField;
        this.rendererParams.progressField = arch.attrs.progress;
        this.rendererParams.displayUnavailability = displayUnavailability;
        this.rendererParams.collapseFirstLevel = collapseFirstLevel;
        this.rendererParams.consolidationParams = consolidationParams;
    },
});

view_registry.add('gantt', GanttView);

return GanttView;

});
