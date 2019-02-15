odoo.define('web_gantt.GanttRenderer', function (require) {
"use strict";

var AbstractRenderer = require('web.AbstractRenderer');
var core = require('web.core');
var GanttRow = require('web_gantt.GanttRow');
var qweb = require('web.QWeb');
var session = require('web.session');
var utils = require('web.utils');

var QWeb = core.qweb;


var GanttRenderer = AbstractRenderer.extend({
    DECORATIONS: [
        'decoration-secondary',
        'decoration-success',
        'decoration-info',
        'decoration-warning',
        'decoration-danger',
    ],
    /**
     * @override
     * @param {Widget} parent
     * @param {Object} state
     * @param {Object} params
     * @param {boolean} params.canCreate
     * @param {boolean} params.canEdit
     * @param {Object} params.cellPrecisions
     * @param {string} params.colorField
     * @param {Object} params.fieldsInfo
     * @param {Object} params.SCALES
     * @param {string} params.string
     * @param {string} params.totalRow
     * @param {string} [params.popoverTemplate]
     */
    init: function (parent, state, params) {
        var self = this;
        this._super.apply(this, arguments);

        this.canCreate = params.canCreate;
        this.canEdit = params.canEdit;
        this.cellPrecisions = params.cellPrecisions;
        this.colorField = params.colorField;
        this.progressField = params.progressField;
        this.consolidationParams = params.consolidationParams;
        this.fieldsInfo = params.fieldsInfo;
        this.SCALES = params.SCALES;
        this.string = params.string;
        this.totalRow = params.totalRow;
        this.collapseFirstLevel = params.collapseFirstLevel;
        this.rowWidgets = {};
        // Pill decoration colors, By default display primary color for pill
        this.pillDecorations = _.chain(this.arch.attrs)
            .pick(function (value, key) {
                return self.DECORATIONS.indexOf(key) >= 0;
            }).mapObject(function (value) {
                return py.parse(py.tokenize(value));
            }).value();
        if (params.popoverTemplate) {
            this.popoverQWeb = new qweb(session.debug, {_s: session.origin});
            this.popoverQWeb.add_template(utils.json_node_to_xml(params.popoverTemplate));
        } else {
            this.popoverQWeb = QWeb;
        }
    },
    /**
     * Called each time the renderer is attached into the DOM.
     */
    on_attach_callback: function () {
        this._isInDom = true;
        this._setRowsDroppable();
    },
    /**
     * Called each time the renderer is detached from the DOM.
     */
    on_detach_callback: function () {
        this._isInDom = false;
        _.invoke(this.rowWidgets, 'on_detach_callback');
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Re-render a given row and its sub-rows. This typically occurs when a row
     * is collapsed/expanded, to prevent from re-rendering the whole view.
     *
     * @param {Object} rowState part of the state concerning the row to update
     * @returns {$.Promise}
     */
    updateRow: function (rowState) {
        var self = this;
        var oldRowIds = [rowState.id].concat(rowState.childrenRowIds);
        var oldRows = [];
        oldRowIds.forEach(function (rowId) {
            if (self.rowWidgets[rowId]) {
                oldRows.push(self.rowWidgets[rowId]);
                delete self.rowWidgets[rowId];
            }
        });
        return this._renderRows([rowState], rowState.groupedBy).then(function (rows) {
            var $previousRow = oldRows[0].$el;
            rows.forEach(function (row) {
                row.$el.insertAfter($previousRow);
                $previousRow = row.$el;
            });
            _.invoke(oldRows, 'destroy');
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Format focus date which is used to display in gantt header (see XML
     * template).
     *
     * @private
     */
    _getFocusDateFormat: function () {
        var focusDate = this.state.focusDate;
        switch (this.state.scale) {
            case 'day':
                return focusDate.format('DD MMMM YYYY');
            case 'week':
                var dateStart = focusDate.clone().startOf('week').format('DD MMMM YYYY');
                var dateEnd = focusDate.clone().endOf('week').format('DD MMMM YYYY');
                return _.str.sprintf('%s - %s', dateStart, dateEnd);
            case 'month':
                return focusDate.format('MMMM YYYY');
            case 'year':
                return focusDate.format('YYYY');
            default:
                break;
        }
    },
    /**
     * Get dates between gantt start and gantt stop date to render gantt slots
     *
     * @private
     * @returns {Moment[]}
     */
    _getSlotsDates: function () {
        var token = this.SCALES[this.state.scale].interval;
        var stopDate = this.state.stopDate;
        var day = this.state.startDate;
        var dates = [];
        while (day <= stopDate) {
            dates.push(day);
            day = day.clone().add(1, token);
        }
        return dates;
    },
    /**
     * Prepare view info which is used by GanttRow widget
     *
     * @private
     * @returns {Object}
     */
    _prepareViewInfo: function () {
        return {
            colorField: this.colorField,
            progressField: this.progressField,
            consolidationParams: this.consolidationParams,
            state: this.state,
            slots: this._getSlotsDates(),
            pillDecorations: this.pillDecorations,
            popoverQWeb: this.popoverQWeb,
            activeScaleInfo: {
                precision: this.cellPrecisions[this.state.scale],
                interval: this.SCALES[this.state.scale].cellPrecisions[this.cellPrecisions[this.state.scale]],
                time: this.SCALES[this.state.scale].time,
            },
        };
    },
    /**
     * Render gantt view and its rows.
     *
     * @override
     * @private
     * @returns {Deferred}
     */
    _render: function () {
        var self = this;
        var oldRowWidgets = Object.keys(this.rowWidgets).map(function (rowId) {
            return self.rowWidgets[rowId];
        });
        this.rowWidgets = {};
        this.viewInfo = this._prepareViewInfo();

        var defs = [];
        defs.push(this._renderRows(this.state.rows, this.state.groupedBy));
        if (this.totalRow) {
            defs.push(this._renderTotalRow());
        }
        defs.push(this._super.apply(this, arguments));

        return $.when.apply($, defs).then(function (rows, totalRow) {
            self.$el.empty();
            _.invoke(oldRowWidgets, 'destroy');

            self.$el.append(QWeb.render('GanttView', {widget: self}));
            rows.forEach(function (row) {
                row.$el.appendTo(self.$('.o_gantt_row_container'));
            });
            if (totalRow) {
                totalRow.$el.appendTo(self.$('.o_gantt_total_row_container'));
            }

            if (self._isInDom) {
                self._setRowsDroppable();
            }
        });
    },
    /**
     * Render rows outside the DOM, so that we can insert them to the DOM once
     * they are all ready.
     *
     * @private
     * @param {Object[]} rows recursive structure of records according to
     *   groupBys
     * @param {string[]} groupedBy
     * @returns {$.Promise<GanttRow[]>} resolved with the row widgets
     */
    _renderRows: function (rows, groupedBy) {
        var self = this;
        var defs = [];
        var rowWidgets = [];
        var disableResize = this.state.scale === 'year';

        var groupLevel = this.state.groupedBy.length - groupedBy.length;
        // FIXME: could we get rid of collapseFirstLevel in Renderer, and fully
        // handle this in Model?
        var hideSidebar = groupedBy.length === 0;
        if (this.collapseFirstLevel) {
            hideSidebar = self.state.groupedBy.length === 0;
        }
        rows.forEach(function (row) {
            var pillsInfo = {
                groupId: row.groupId,
                pills: row.records,
                groupLevel: groupLevel,
            };
            if (groupedBy.length) {
                pillsInfo.groupName = row.name;
            }

            var consolidate = groupLevel === 0 && self.state.groupedBy[0] === self.consolidationParams.maxField;

            var params = {
                canCreate: self.canCreate,
                canEdit: self.canEdit,
                isGroup: row.isGroup,
                consolidate: consolidate,
                hideSidebar: hideSidebar,
                isOpen: row.isOpen,
                disableResize: disableResize,
                rowId: row.id,
                scales: self.SCALES,
            };
            var rowDef = self._renderRow(pillsInfo, params).then(function (row) {
                rowWidgets.push(row);
            });
            defs.push(rowDef);
            if (row.isGroup && row.isOpen) {
                var subRowsDef = self._renderRows(row.rows, groupedBy.slice(1)).then(function (subRowWidgets) {
                    rowWidgets = rowWidgets.concat(subRowWidgets);
                });
                defs.push(subRowsDef);
            }
        });
        return $.when.apply($, defs).then(function () {
            return rowWidgets;
        });
    },
    /**
     * Render a row outside the DOM.
     *
     * Note that we directly call the private function _widgetRenderAndInsert to
     * prevent from generating a documentFragment for each row we have to
     * render. The Widget API should offer a proper way to start a widget
     * without inserting it anywhere.
     *
     * @param {Object} pillsInfo
     * @param {Object} params
     * @returns {$.Promise<GanttRow>} resolved when the row is ready
     */
    _renderRow: function (pillsInfo, params) {
        var ganttRow = new GanttRow(this, pillsInfo, this.viewInfo, params);
        this.rowWidgets[ganttRow.rowId] = ganttRow;
        return ganttRow._widgetRenderAndInsert(function () {}).then(function () {
            return ganttRow;
        });
    },
    /**
     * Renders the total row outside the DOM, so that we can insert it to the
     * DOM once all rows are ready.
     *
     * @returns {$.Promise<GanttRow} resolved with the row widget
     */
    _renderTotalRow: function () {
        var pillsInfo = {
            groupId: "groupTotal",
            pills: this.state.records,
            groupLevel: 0,
            groupName: "Total"
        };
        var params = {
            canCreate: this.canCreate,
            canEdit: this.canEdit,
            hideSidebar: this.state.groupedBy.length === 0,
            isGroup: true,
            rowId: '__total_row__',
            scales: this.SCALES,
        };
        return this._renderRow(pillsInfo, params);
    },
    /**
     * Set droppable on all rows
     */
    _setRowsDroppable: function () {
        // jQuery (< 3.0) rounds the width value but we need the exact value
        // getBoundingClientRect is costly when there are lots of rows
        var cellWidth = this.$('.o_gantt_header_scale .o_gantt_header_cell:first')[0].getBoundingClientRect().width;
        _.invoke(this.rowWidgets, 'setDroppable', cellWidth);
    }
});

return GanttRenderer;

});
