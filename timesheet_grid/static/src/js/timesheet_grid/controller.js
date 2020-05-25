odoo.define('timesheet_grid.GridController', function (require) {
    "use strict";

    const core = require('web.core');
    const _t = core._t;
    const utils = require('web.utils');

    const GridController = require('web_grid.GridController');

    const TimesheetGridController = GridController.extend({
        custom_events: Object.assign({}, GridController.prototype.custom_events, {
            update_timer: '_onUpdateTimer',
            update_timer_description: '_onUpdateTimerDescription',
            add_time_timer: '_onAddTimeTimer',
            stop_timer: '_onStopTimer',
            unlink_timer: '_onUnlinkTimer',
        }),

        //----------------------------------------------------------------------
        // Handlers
        //----------------------------------------------------------------------

        /**
         * If we update an existing line, we update the view.
         *
         * @private
         */
        _onUpdateTimer: async function () {
            const state = await this.model.actionTimer(this.model.get());
            await this.renderer.update(state);
            this.updateButtons(state);
        },
        _onUpdateTimerDescription: function (event) {
            const timesheetId = event.data.timesheetId;
            const description = event.data.description;
            this.model._changeTimerDescription(timesheetId, description);
        },
        _onAddTimeTimer: function (event) {
            const timesheetId = event.data.timesheetId;
            const time = event.data.time;
            this.model._addTimeTimer(timesheetId, time);
        },
        _onStopTimer: async function (event) {
            const timesheetId = event.data.timesheetId;
            await this.model._stopTimer(timesheetId);
            await this.reload();
        },
        _onUnlinkTimer: function (event) {
            const timesheetId = event.data.timesheetId;
            this.model._unlinkTimer(timesheetId);
        }
    });

    const TimesheetGridValidateController = TimesheetGridController.extend({
        /**
         * @override
         */
        renderButtons: function ($node) {
            this._super.apply(this, arguments);
            this.$buttons.on('click', '.o_timesheet_validate', this._onValidateButtonClicked.bind(this));
        },

        /**
         * @override
         */
        updateButtons: function () {
            this._super(...arguments);
            this.$buttons.find('.o_timesheet_validate').removeClass('grid_arrow_button');
        },

        _onValidateButtonClicked: function (e) {
            e.stopPropagation();

            return this.mutex.exec(async () => {
                const ids = await this.model.getIds();
                const res = await this._rpc({
                    model: 'account.analytic.line',
                    method: 'action_validate_timesheet',
                    args: [ids],
                });
                this.displayNotification({type: res.status, title: res.message});
                await this.model.reload();
                var state = this.model.get();
                await this.renderer.update(state);
                this.updateButtons(state);
            });
        },
    });


    return {
        TimesheetGridController: TimesheetGridController,
        TimesheetGridValidateController: TimesheetGridValidateController
    };
});
