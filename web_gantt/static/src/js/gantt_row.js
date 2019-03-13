odoo.define('web_gantt.GanttRow', function (require) {
"use strict";

var core = require('web.core');
var session = require('web.session');
var Widget = require('web.Widget');

var QWeb = core.qweb;

var GanttRow = Widget.extend({
    template: 'GanttView.Row',
    events: {
        'mouseleave': '_onMouseLeave',
        'mousemove .o_gantt_cell': '_onMouseMove',
        'mouseenter .o_gantt_pill': '_onPillEntered',
        'mouseup .o_gantt_pill': '_onPillClicked', // jQuery UI uses mouseup
        'click .o_gantt_row_sidebar': '_onRowSidebarClicked',
        'mouseup .o_gantt_cell_buttons > .o_gantt_cell_add': '_onButtonAddClicked', // jQuery UI uses mouseup
        'mouseup .o_gantt_cell_buttons > .o_gantt_cell_plan': '_onButtonPlanClicked', // jQuery UI uses mouseup
    },
    NB_GANTT_RECORD_COLORS: 10,
    LEVEL_LEFT_OFFSET: 15, // 15 px per level
    LEVEL_TOP_OFFSET: 36, // 36 px per level
    POPOVER_DELAY: 500,
    /**
     * @override
     * @param {Object} pillsInfo
     * @param {Object} viewInfo
     * @param {Object} options
     * @param {boolean} options.canCreate
     * @param {boolean} options.canEdit
     * @param {boolean} options.disableResize Disable resize for pills
     * @param {boolean} options.hideSidebar Hide sidebar
     * @param {boolean} options.isGroup If is group, It will display all its
     *                  pills on one row, disable resize, don't allow to create
     *                  new record when clicked on cell
     */
    init: function (parent, pillsInfo, viewInfo, options) {
        this._super.apply(this, arguments);

        this.name = pillsInfo.groupName;
        this.groupId = pillsInfo.groupId;
        this.groupLevel = pillsInfo.groupLevel;
        this.pills = _.map(pillsInfo.pills, _.clone);

        this.viewInfo = viewInfo;
        this.state = viewInfo.state;
        this.colorField = viewInfo.colorField;

        this.options = options;
        this.SCALES = options.scales;
        this.isGroup = options.isGroup;
        this.isOpen = options.isOpen;
        this.rowId = options.rowId;

        this.consolidate = options.consolidate;
        this.consolidationParams = viewInfo.consolidationParams;

        // the total row has some special behaviour
        this.isTotal = this.groupId === 'groupTotal';

        this._adaptPills();
        this._snapDates();
        this._calculateLevel();
        if (this.isGroup && this.pills.length) {
            this._aggregateGroupedPills();
        } else {
            this.progressField = viewInfo.progressField;
            this._evaluateDecoration();
        }
        this._calculateMarginAndWidth();
        this._insertIntoSlot();

        this.leftPadding = this.groupLevel * this.LEVEL_LEFT_OFFSET;
        this.cellHeight = this.level * this.LEVEL_TOP_OFFSET;

        this.MIN_WIDTHS = { full: 100, half: 50, quarter: 25 };
        this.PARTS = { full: 1, half: 2, quarter: 4 };

        this.cellMinWidth = this.MIN_WIDTHS[this.viewInfo.activeScaleInfo.precision];
        this.cellPart = this.PARTS[this.viewInfo.activeScaleInfo.precision];

        this.childrenRows = [];

        this._onButtonAddClicked = _.debounce(this._onButtonAddClicked, 500, true);
        this._onButtonPlanClicked = _.debounce(this._onButtonPlanClicked, 500, true);
        this._onPillClicked = _.debounce(this._onPillClicked, 500, true);
    },
    /**
     * @override
     */
    start: function () {
        if (!this.isGroup) {
            this._bindPopover();
        }
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Set the current $el (the whole row) as droppable for the pills.
     * See @_setDraggable
     */
    setDroppable: function (cellWidth) {
        var self = this;
        this.resizeSnappingWidth = cellWidth / this.cellPart;
        this.$el.droppable({
            drop: function (event, ui) {
                var diff = Math.round(ui.position.left / self.resizeSnappingWidth * self.viewInfo.activeScaleInfo.interval);
                var $pill = ui.draggable;
                var oldGroupId = $pill.closest('.o_gantt_row').data('group-id');
                if (diff || (self.groupId !== oldGroupId)) { // do not perform write if nothing change
                    self._saveDragChanges($pill.data('id'), diff, oldGroupId, self.groupId);
                } else {
                    $pill.animate({
                        left: 0,
                        top: 0,
                    });
                }
            },
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Bind popover on pills
     *
     * @private
     */
    _bindPopover: function () {
        var self = this;
        this.$('.o_gantt_pill').popover({
            container: this.$el,
            trigger: 'hover',
            delay: {show: this.POPOVER_DELAY},
            html: true,
            placement: 'top',
            content: function () {
                return self.viewInfo.popoverQWeb.render('gantt-popover', self._getPopoverContext($(this).data('id')));
            },
        });
    },
    /**
     * Compute minimal levels required to display all pills without overlapping
     *
     * @private
     */
    _calculateLevel: function () {
        if (this.isGroup || !this.pills.length) {
            // We want shadow pills to overlap each other
            this.level = 0;
            this.pills.forEach(function (pill) {
                pill.level = 0;
            });
        } else {
            // Sort pills according to start date
            this.pills = _.sortBy(this.pills, 'startDate');
            this.pills[0].level = 0;
            var levels = [{
                pills: [this.pills[0]],
                maxStopDate: this.pills[0].stopDate,
            }];
            for (var i = 1; i < this.pills.length; i++) {
                var currentPill = this.pills[i];
                for (var l = 0; l < levels.length; l++) {
                    if (currentPill.startDate >= levels[l].maxStopDate) {
                        currentPill.level = l;
                        levels[l].pills.push(currentPill);
                        if (currentPill.stopDate > levels[l].maxStopDate) {
                            levels[l].maxStopDate = currentPill.stopDate;
                        }
                        break;
                    }
                }
                if (!currentPill.level && currentPill.level != 0) {
                    currentPill.level = levels.length;
                    levels.push({
                        pills: [currentPill],
                        maxStopDate: currentPill.stopDate,
                    });
                }
            }
            this.level = levels.length;
        }
    },
    /**
     * Adapt pills to the range of current gantt view
     * Disable resize feature if date is before the start of the gantt scope
     * Disable resize feature for group rows
     *
     * @private
     */
    _adaptPills: function () {
        var self = this;
        var dateStartField = this.state.dateStartField;
        var dateStopField = this.state.dateStopField;
        var ganttStartDate = this.state.startDate;
        var ganttStopDate = this.state.stopDate;
        this.pills.forEach(function (pill) {
            var pillStartDate = self._convertToUserTime(pill[dateStartField]);
            var pillStopDate = self._convertToUserTime(pill[dateStopField]);
            if (pillStartDate < ganttStartDate) {
                pill.startDate = ganttStartDate;
                pill.disableStartResize = true;
            } else {
                pill.startDate = pillStartDate;
            }
            if (pillStopDate > ganttStopDate) {
                pill.stopDate = ganttStopDate;
                pill.disableStopResize = true;
            } else {
                pill.stopDate = pillStopDate;
            }
            // Disable resize feature for groups
            if (self.isGroup) {
                pill.disableStartResize = true;
                pill.disableStopResize = true;
            }
        });
    },
    /**
     * Aggregate overlapping pills in group rows
     *
     * @private
     */
    _aggregateGroupedPills: function () {
        var self = this;
        var sortedPills = _.sortBy(_.map(this.pills, _.clone), 'startDate');
        var firstPill = sortedPills[0];
        firstPill.count = 1;

        var timeToken = this.SCALES[this.state.scale].time;
        var cellTime = this.SCALES[this.state.scale].cellPrecisions[this.viewInfo.activeScaleInfo.precision];
        var intervals = _.reduce(this.viewInfo.slots, function (intervals, slotStart) {
            intervals.push(slotStart);
            intervals.push(slotStart.clone().add(cellTime, timeToken));
            return intervals;
        }, []);

        this.pills = _.reduce(intervals, function (pills, slotStart) {
            var slotStop = slotStart.clone().add(cellTime, timeToken);
            var pillsInThisSlot = _.filter(self.pills, function (pill) {
                return pill.startDate < slotStop && pill.stopDate > slotStart;
            });
            if (pillsInThisSlot.length) {
                var previousPill = pills[pills.length - 1];
                var isContinuous = previousPill &&
                    _.intersection(previousPill.aggregatedPills, pillsInThisSlot).length;

                if (isContinuous && previousPill.count === pillsInThisSlot.length) {
                    // Enlarge previous pill so that it spans the current slot
                    previousPill.stopDate = slotStop;
                    previousPill.aggregatedPills = previousPill.aggregatedPills.concat(pillsInThisSlot);
                } else {
                    var newPill = {
                        id: 0,
                        count: pillsInThisSlot.length,
                        aggregatedPills: pillsInThisSlot,
                        startDate: moment.max(_.min(pillsInThisSlot, 'startDate').startDate, slotStart),
                        stopDate: moment.min(_.max(pillsInThisSlot, 'stopDate').stopDate, slotStop),
                    };
                    if (isContinuous) {
                        // Pills are continuous but different count: display them together
                        previousPill.continuousRight = true;
                        newPill.continuousLeft = true;
                    }

                    // Enrich the aggregates with consolidation data
                    if (self.consolidate && self.consolidationParams.field) {
                        newPill.consolidationValue = pillsInThisSlot.reduce(
                            function (sum, pill) {
                                if (!pill[self.consolidationParams.excludeField]) {
                                    return sum + pill[self.consolidationParams.field];
                                }
                                return sum; // Don't sum this pill if it is excluded
                            },
                            0
                        );
                        newPill.consolidationMaxValue = self.consolidationParams.maxValue;
                        newPill.consolidationExceeded = newPill.consolidationValue > newPill.consolidationMaxValue;
                    }

                    pills.push(newPill);
                }
            }
            return pills;
        }, []);

        var maxCount = _.max(this.pills, function (pill) {
            return pill.count;
        }).count;
        var minColor = 215;
        var maxColor = 100;
        this.pills.forEach(function (pill) {
            if (self.consolidate && self.consolidationParams.maxValue) {
                pill.style = pill.consolidationExceeded ? 'background-color: #DC6965;' : 'background-color: #00A04A;';
                pill.display_name = pill.consolidationValue;
            } else {
                var color = minColor - ((pill.count - 1) / maxCount) * (minColor - maxColor);
                pill.style = _.str.sprintf("background-color: rgba(%s, %s, %s, 0.6)", color, color, color);
                pill.display_name = pill.count;
            }
        });
    },
    /**
     * Calculate left margin and width for pills
     *
     * @private
     */
    _calculateMarginAndWidth: function () {
        var self = this;
        var left;
        var diff;
        this.pills.forEach(function (pill) {
            switch (self.state.scale) {
                case 'day':
                    left = pill.startDate.diff(pill.startDate.clone().startOf('hour'), 'minutes');
                    pill.leftMargin = (left / 60) * 100;
                    diff = pill.stopDate.diff(pill.startDate, 'minutes');
                    pill.width = (diff / 60) * 100;
                    break;
                case 'week':
                case 'month':
                    left = pill.startDate.diff(pill.startDate.clone().startOf('day'), 'hours');
                    pill.leftMargin = (left / 24) * 100;
                    diff = pill.stopDate.diff(pill.startDate, 'hours');
                    pill.width = (diff / 24) * 100;
                    break;
                case 'year':
                    var startDateMonthStart = pill.startDate.clone().startOf('month');
                    var stopDateMonthEnd = pill.stopDate.clone().endOf('month');
                    left = pill.startDate.diff(startDateMonthStart, 'days');
                    pill.leftMargin = (left / 30) * 100;

                    var monthsDiff = stopDateMonthEnd.diff(startDateMonthStart, 'months', true);
                    if (monthsDiff < 1) {
                        // A 30th of a month slot is too small to display
                        // 1-day events are displayed as if they were 2-days events
                        diff = Math.max(Math.ceil(pill.stopDate.diff(pill.startDate, 'days', true)), 2);
                        pill.width = (diff / pill.startDate.daysInMonth()) * 100;
                    } else {
                        // The pill spans more than one month, so counting its
                        // number of days is not enough as some months have more
                        // days than others. We need to compute the proportion
                        // of each month that the pill is actually taking.
                        var startDateMonthEnd = pill.startDate.clone().endOf('month');
                        var diffMonthStart = Math.ceil(startDateMonthEnd.diff(pill.startDate, 'days', true));
                        var widthMonthStart = (diffMonthStart / pill.startDate.daysInMonth());

                        var stopDateMonthStart = pill.stopDate.clone().startOf('month');
                        var diffMonthStop = Math.ceil(pill.stopDate.diff(stopDateMonthStart, 'days', true));
                        var widthMonthStop = (diffMonthStop / pill.stopDate.daysInMonth());

                        var width = Math.max((widthMonthStart + widthMonthStop), (2 / 30)) * 100;
                        if (monthsDiff > 2) { // start and end months are already covered
                            // If the pill spans more than 2 months, we know
                            // that the middle months are fully covered
                            width += (monthsDiff - 2) * 100;
                        }
                        pill.width = width;
                    }
                    break;
                default:
                    break;
            }
            pill.topPadding = pill.level * self.LEVEL_TOP_OFFSET;
        });
    },
    /**
    * Convert date to user timezone
    *
    * @private
    * @param {Moment} date
    * @returns {Moment} date in user timezone
    */
    _convertToUserTime: function (date) {
        // we need to change the original timezone (UTC) to take the user
        // timezone
        return date.clone().local();
    },
    /**
     * Evaluate decoration conditions
     *
     * @private
     */
    _evaluateDecoration: function () {

        var self = this;
        this.pills.forEach(function (pill) {
            var pillDecorations = [];
            _.each(self.viewInfo.pillDecorations, function (expr, decoration) {
                if (py.PY_isTrue(py.evaluate(expr, self._getDecorationEvalContext(pill)))) {
                    pillDecorations.push(decoration);
                }
            });
            pill.decorations = pillDecorations;

            if (self.colorField) {
                pill._color = self.getColor(pill[self.colorField]);
            }

            if (self.progressField) {
                pill._progress = pill[self.progressField] || 0;
            }
        });
    },
    /**
     * @param {integer|Array} value
     * @private
     */
    getColor: function (value) {
        if (_.isNumber(value)) {
            return Math.round(value) % this.NB_GANTT_RECORD_COLORS;
        } else if (_.isArray(value)) {
            return value[0] % this.NB_GANTT_RECORD_COLORS;
        }
        return 0;
    },
    /**
     * Get context to evaluate decoration
     *
     * @private
     * @param {Object} pillData
     * @returns {Object} context contains pill data, current date, user session
     */
    _getDecorationEvalContext: function (pillData) {
        return _.extend(
            pillData,
            session.user_context,
            {current_date: moment().format('YYYY-MM-DD')}
        );
    },
    /**
     * Get context to display in popover template
     *
     * @private
     * @param {integer} pillID
     * @returns {Object}
     */
    _getPopoverContext: function (pillID) {
        var data = _.clone(_.findWhere(this.pills, {id: pillID}));
        data.userTimezoneStartDate = this._convertToUserTime(data[this.state.dateStartField]);
        data.userTimezoneStopDate = this._convertToUserTime(data[this.state.dateStopField]);
        return data;
    },
    /**
     * Insert pill into gantt row slot according to its start date
     *
     * @private
     */
    _insertIntoSlot: function () {
        var self = this;
        var slotCompareFormats = {
            day: 'HH',
            week: 'e',
            month: 'DD',
            year: 'MM',
        };
        // Hours (HH) and day of the week (e) are indexed starting at 0, but
        // day (DD) and month (MM) are indexed starting at 1. We offset that.
        var delta = _.contains(['month', 'year'], this.state.scale) ? 1 : 0;
        var slotFormat = slotCompareFormats[this.state.scale];
        this.slots = _.map(this.viewInfo.slots, function (date, key) {
            return {
                isToday: date.isSame(new Date(), 'day') && self.state.scale !== 'day',
                unavailable: self.state.unavailability && self.state.unavailability[key],
                date: date,
                pills: [],
            };
        });
        this.pills.forEach(function (pill) {
            var index = parseInt(pill.startDate.format(slotFormat), 10);
            self.slots[index - delta].pills.push(pill);
        });
        this.slots.forEach(function (slot) {
            slot.hasButtons = !self.isGroup && !self.isTotal;
        });
    },
    /**
     * Save drag changes
     *
     * @private
     * @param {integer} pillID
     * @param {integer} diff
     */
    _saveDragChanges: function (pillId, diff, oldGroupId, newGroupId) {
        this.trigger_up('pill_dropped', {
            pillId: pillId,
            diff: diff,
            oldGroupId: oldGroupId,
            newGroupId: newGroupId,
            groupLevel: this.groupLevel,
        });
    },
    /**
     * Save resize changes
     *
     * @private
     * @param {integer} pillID
     * @param {integer} resizeDiff
     * @param {string} direction
     */
    _saveResizeChanges: function (pillID, resizeDiff, direction) {
        var pill = _.findWhere(this.pills, {id: pillID});
        var data = { id: pillID };
        if (direction === 'left') {
            data.field = this.state.dateStartField;
            data.date = pill[this.state.dateStartField].clone().subtract(resizeDiff, this.viewInfo.activeScaleInfo.time);
        } else {
            data.field = this.state.dateStopField;
            data.date = pill[this.state.dateStopField].clone().add(resizeDiff, this.viewInfo.activeScaleInfo.time);
        }
        this.trigger_up('pill_resized', data);
    },
    /**
     * Set the draggable jQuery property on a $pill.
     * @private
     * @param {jQuery} $pill
     */
    _setDraggable: function ($pill) {
        if ($pill.hasClass('ui-draggable')) {
            return;
        }
        var self = this;
        var pill = _.findWhere(this.pills, { id: $pill.data('id') });

        // DRAGGABLE
        if (this.options.canEdit && !pill.disableStartResize && !pill.disableStopResize && !this.isGroup) {
            $pill.draggable({
                containment: '.o_gantt_row_container',
                grid: [this.resizeSnappingWidth, this.LEVEL_TOP_OFFSET],
                start: function () {
                    self.trigger_up('updating_pill_started');
                    self.$el.addClass('o_gantt_dragging');
                    $pill.popover('hide');
                    self.$('.o_gantt_pill').popover('disable');
                },
                drag: function (event, ui) {
                    if ($(event.target).hasClass('o_gantt_pill_editing')) {
                        // Kill draggable if pill opened its dialog
                        return false;
                    }
                    var diff = Math.round((ui.position.left - ui.originalPosition.left) / self.resizeSnappingWidth * self.viewInfo.activeScaleInfo.interval);
                    self._updateResizeBadge($pill, diff, ui);
                },
                stop: function () {
                    self.trigger_up('updating_pill_stopped');
                    self.$el.removeClass('o_gantt_dragging');
                    self.$('.o_gantt_pill').popover('enable');
                },
            });
        }
    },
    /**
     * Set the resizable jQuery property on a $pill.
     * @private
     * @param {jQuery} $pill
     */
    _setResizable: function ($pill) {
        if ($pill.hasClass('ui-resizable')) {
            return;
        }
        var self = this;
        var pillHeight = this.$('.o_gantt_pill:first').height();

        var pill = _.findWhere(self.pills, { id: $pill.data('id') });

        // RESIZABLE
        var handles = [];
        if (!pill.disableStartResize) {
            handles.push('w');
        }
        if (!pill.disableStopResize) {
            handles.push('e');
        }
        if (handles.length && !self.options.disableResize && !self.isGroup && self.options.canEdit) {
            $pill.resizable({
                handles: handles.join(', '),
                grid: [this.resizeSnappingWidth, pillHeight],
                start: function () {
                    self.$('.o_gantt_pill').popover('disable');
                    self.trigger_up('updating_pill_started');
                    self.$el.addClass('o_gantt_dragging');
                },
                resize: function (event, ui) {
                    var diff = Math.round((ui.size.width - ui.originalSize.width) / self.resizeSnappingWidth * self.viewInfo.activeScaleInfo.interval);
                    self._updateResizeBadge($pill, diff, ui);
                },
                stop: function (event, ui) {
                    self.trigger_up('updating_pill_stopped');
                    self.$el.removeClass('o_gantt_dragging');
                    self.$('.o_gantt_pill').popover('enable');
                    var diff = Math.round((ui.size.width - ui.originalSize.width) / self.resizeSnappingWidth * self.viewInfo.activeScaleInfo.interval);
                    var direction = ui.position.left ? 'left' : 'right';
                    if (diff) { // do not perform write if nothing change
                        self._saveResizeChanges(pill.id, diff, direction);
                    }
                },
            });
        }
    },
    /**
     * Snap dates based on scale precision
     *
     * @private
     */
    _snapDates: function () {
        var self = this;
        var interval = this.viewInfo.activeScaleInfo.interval;
        switch (this.state.scale) {
            case 'day':
                this.pills.forEach(function (pill) {
                    var snappedStartDate = self._snapMinutes(pill.startDate, interval);
                    var snappedStopDate = self._snapMinutes(pill.stopDate, interval);
                    // Set min width
                    var minuteDiff = snappedStartDate.diff(snappedStopDate, 'minute');
                    if (minuteDiff === 0) {
                        if (snappedStartDate > pill.startDate) {
                            pill.startDate = snappedStartDate.subtract(interval, 'minute');
                            pill.stopDate = snappedStopDate;
                        } else {
                            pill.startDate = snappedStartDate;
                            pill.stopDate = snappedStopDate.add(interval, 'minute');
                        }
                    } else {
                        pill.startDate = snappedStartDate;
                        pill.stopDate = snappedStopDate;
                    }
                });
                break;
            case 'week':
            case 'month':
                this.pills.forEach(function (pill) {
                    var snappedStartDate = self._snapHours(pill.startDate, interval);
                    var snappedStopDate = self._snapHours(pill.stopDate, interval);
                    // Set min width
                    var hourDiff = snappedStartDate.diff(snappedStopDate, 'hour');
                    if (hourDiff === 0) {
                        if (snappedStartDate > pill.startDate) {
                            pill.startDate = snappedStartDate.subtract(interval, 'hour');
                            pill.stopDate = snappedStopDate;
                        } else {
                            pill.startDate = snappedStartDate;
                            pill.stopDate = snappedStopDate.add(interval, 'hour');
                        }
                    } else {
                        pill.startDate = snappedStartDate;
                        pill.stopDate = snappedStopDate;
                    }
                });
                break;
            case 'year':
                this.pills.forEach(function (pill) {
                    pill.startDate = pill.startDate.clone().startOf('month');
                    pill.stopDate = pill.stopDate.clone().endOf('month');
                });
                break;
            default:
                break;
        }
    },
    /**
     * Snap a day to given interval
     *
     * @private
     * @param {Moment} date
     * @param {integer} interval
     * @returns {Moment} snapped date
     */
    _snapHours: function (date, interval) {
        var snappedHours = Math.round(date.clone().hour() / interval) * interval;
        return date.clone().hour(snappedHours).minute(0).second(0);
    },
    /**
     * Snap a hour to given interval
     *
     * @private
     * @param {Moment} date
     * @param {integer} interval
     * @returns {Moment} snapped hour date
     */
    _snapMinutes: function (date, interval) {
        var snappedMinutes = Math.round(date.clone().minute() / interval) * interval;
        return date.clone().minute(snappedMinutes).second(0);
    },
    /**
     * @private
     * @param {jQuert} $pill
     * @param {integer} resizeSnappingWidth
     * @param {Object} ui
     */
    _updateResizeBadge: function ($pill, diff, ui) {
        $pill.find('.o_gantt_pill_resize_badge').remove();
        if (diff) {
            var direction = ui.position.left ? 'left' : 'right';
            $(QWeb.render('GanttView.ResizeBadge', {
                diff: diff,
                direction: direction,
                time: this.viewInfo.activeScaleInfo.time,
            })).appendTo($pill);
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * When click on cell open dialog to create new record with prefilled fields
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onButtonAddClicked: function (ev) {
        var date = moment($(ev.currentTarget).closest('.o_gantt_cell').data('date'));
        this.trigger_up('add_button_clicked', {
            date: date,
            groupId: this.groupId,
        });
    },
    /**
     * When click on cell open dialog to create new record with prefilled fields
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onButtonPlanClicked: function (ev) {
        var date = moment($(ev.currentTarget).closest('.o_gantt_cell').data('date'));
        this.trigger_up('plan_button_clicked', {
            date: date,
            groupId: this.groupId,
        });
    },
    /**
     * When entering a cell, it displays some buttons (but not when resizing
     * another pill, we thus can't use css rules).
     *
     * Note that we cannot do that on the cell mouseenter because we don't enter
     * the cell we moving the mouse on a pill that spans on multiple cells.
     *
     * Also note that we try to *avoid using jQuery* here to reduce the time
     * spent in this function so the whole view doesn't feel sluggish when there
     * are a lot of records.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onMouseMove: function (ev) {
        if (this.options.canCreate && !this.$el[0].classList.contains('o_gantt_dragging')) {
            // Pills are part of the cell in which they start. If a pill is
            // longer than one cell, and the user is hovering on the right
            // side of the pill, the browser will say that the left cell is
            // hovered, since the hover event will bubble up from the pill to
            // the cell which contains it, hence, the left one. The only way we
            // found to target the real cell on which the user is currently
            // hovering is calling the costly elementsFromPoint function.
            // Besides, this function will not work in the test environment.
            var hoveredCell;
            if (ev.target.classList.contains('o_gantt_pill') || ev.target.parentNode.classList.contains('o_gantt_pill')) {
                document.elementsFromPoint(ev.pageX, ev.pageY).some(function (element) {
                    return element.classList.contains('o_gantt_cell') ? ((hoveredCell = element), true) : false;
                });
            } else {
                hoveredCell = ev.currentTarget;
            }

            if (hoveredCell && hoveredCell != this.lastHoveredCell) {
                if (this.lastHoveredCell) {
                    this.lastHoveredCell.classList.remove('o_hovered');
                }
                hoveredCell.classList.add('o_hovered');
                this.lastHoveredCell = hoveredCell;
            }
        }
    },
    /**
     * @private
     */
    _onMouseLeave: function () {
        // User leaves this row to enter another one
        this.$(".o_gantt_cell.o_hovered").removeClass('o_hovered');
        this.lastHoveredCell = undefined;
    },
    /**
     * When click on pill open dialog to view record
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onPillClicked: function (ev) {
        if (!this.isGroup) {
            this.trigger_up('pill_clicked', {
                target: $(ev.currentTarget),
            });
        }
    },
    /**
     * Set the draggable and resizable jQuery properties on a pill when the user
     * enters the pill.
     *
     * This is only done at this time and not in `on_attach_callback` to
     * optimize the rendering (creating jQuery draggable and resizable for
     * potentially thousands of pills is the heaviest task).
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onPillEntered: function (ev) {
        var $pill = $(ev.currentTarget);

        this._setResizable($pill);
        this._setDraggable($pill);
    },
    /**
     * Toggle Collapse/Expand rows when user click in gantt row sidebar
     *
     * @private
     */
    _onRowSidebarClicked: function () {
        if (this.isGroup) {
            if (this.isOpen) {
                this.trigger_up('collapse_row', {rowId: this.rowId});
            } else {
                this.trigger_up('expand_row', {rowId: this.rowId});
            }
        }
    },
});

return GanttRow;

});
