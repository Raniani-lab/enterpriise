odoo.define('timesheet_grid.TimesheetM2OAvatarEmployee', require => {
    'use strict';

    const StandaloneM2OAvatarEmployee = require('hr.StandaloneM2OAvatarEmployee');
    const core = require('web.core');
    const qweb = core.qweb;
    const _lt = core._lt;

    /**
     * Widget that add hours to be performed next to the avatar name.
     * It's displayed in red if all hours for the currently displayed time period have not been timesheeted AND
     * and time period is in the past. Otherwise, it's red.
     */
    const TimesheetM2OAvatarEmployee = StandaloneM2OAvatarEmployee.extend({

        $className: '.o_grid_section_subtext',
        hoursTemplate: 'timesheet_grid.Many2OneAvatarHoursSubfield',
        title: _lt('Time the employee should be working according to his contract.'),

        init(parent, value, rowIndex, rangeContext, timeBoundariesContext, workingHoursData) {
            this._super(...arguments);

            this.elementIndex = rowIndex;
            this.rangeContext = rangeContext;
            this.timeContext = timeBoundariesContext;

            this.hasAllTheRequiredData = true;

            if (workingHoursData) {
                this.cacheHours = workingHoursData['units_to_work'];
                this.cacheUnit = workingHoursData['uom'];
                this.cacheWorkedHours = workingHoursData['worked_hours'];
            } else {
                this.hasAllTheRequiredData = false;
                console.error("For some reason, the working hours of the employee couldn't be loaded...");
            }
        },

        start() {
            if (this.hasAllTheRequiredData) {
                this._updateTemplateFromCacheData();
                this._renderHoursFromCache(true);
            }

            return this._super(...arguments);
        },

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        async update(data) {
            let shouldAttachFreshTemplate = false;

            if (data.value[0] !== this.value[0]) {
                this.value = data.value;
                await this.avatarWidget.reinitialize(data.value);
                shouldAttachFreshTemplate = true;
            }

            this.rangeContext = data.rangeContext;
            this.timeContext = data.timeBoundariesContext;

            if (data.workingHoursData) {
                this.cacheHours = data.workingHoursData['units_to_work'];
                this.cacheUnit = data.workingHoursData['uom'];
                this.cacheWorkedHours = data.workingHoursData['worked_hours'];

                this._updateTemplateFromCacheData();
                this._renderHoursFromCache(shouldAttachFreshTemplate);
            } else {
                console.error("For some reason, the working hours of the employee couldn't be loaded...");
            }
        },

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * Renders the widget.
         *
         * @param {bool} attachNewTemplate should a new template be attached and not replaced ?
         */
        _renderHoursFromCache(attachNewTemplate = false) {
            if (attachNewTemplate) {
                this.$templateHtml.appendTo(this.avatarWidget.$el);
            } else {
                this.avatarWidget.$el.find(this.$className).replaceWith(this.$templateHtml);
            }
        },

        /**
         * @returns boolean should show the hours line in red ?
         */
        _shouldShowHoursInRed() {
            return (this.cacheWorkedHours < this.cacheHours) && (moment(this.timeContext.end) < moment());
        },

        /**
         * Generate (qweb render) the template from the attribute values.
         */
        _updateTemplateFromCacheData() {
            this.$templateHtml = $(qweb._render(this.hoursTemplate, {
                'number': this.cacheHours,
                'unit': this.cacheUnit,
                'range': this.rangeContext,
                'not_enough_hours': this._shouldShowHoursInRed(),
                'title': this.title
            }));
        },

    });

    return TimesheetM2OAvatarEmployee;

});
