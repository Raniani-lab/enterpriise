odoo.define('timesheet_grid.GridController', function (require) {
    "use strict";

    const GridController = require('web_grid.GridController');

    const TimesheetGridController = GridController.extend({
        custom_events: Object.assign({}, GridController.prototype.custom_events, {
            click_timer_button: '_onClickTimerButton',
        }),

        init: function () {
            this._super(...arguments);
            this.isWritting = false;
        },

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * @private
         */
        _handleTimer: async function (timerData) {
            if (timerData.timesheet) {
                await this._rpc({
                    model: this.modelName,
                    method: timerData.action,
                    args: [timerData.timesheet.id]
                });
            } else {
                // create the timesheet and render
                // The task can be false.
                if (timerData.data.task_id) {
                    await this.model._createTimesheet({
                        task_id: timerData.data.task_id[0]
                    });
                } else {
                    // if task is false then retrieve the project_id
                    // in the domain to create timesheet
                    // with the project_id
                    await this.model._createTimesheet({
                        project_id: timerData.data.project_id[0]
                    });
                }
            }
        },
        //----------------------------------------------------------------------
        // Handlers
        //----------------------------------------------------------------------

        /**
         * When the user click on a timer button, some actions can be launch:
         *
         *  - if the timesheet exists into this button then 2 actions can be launched :
         *      1. if the button value is false, then we launch the action called 'action_timer_start'
         *          to start the timer.
         *      2. if the button value is true, then we launch the action called 'action_timer_stop'
         *          to stop the timer.
         *  - Otherwise, we create the timesheet for today and after we launch the timesheet.
         *
         * Once the action is done, we reload the view.
         *
         * @private
         * @param {MouseEvent} ev
         */
        _onClickTimerButton: async function (ev) {
            if (this.isWritting) {
                return;
            }
            ev.stopPropagation();
            this.isWritting = true;
            try {
                await this._handleTimer(ev.data);
            } finally {
                this.isWritting = false;
            }
            const state = await this.model.actionTimer(this.model.get());
            await this.renderer.update(state);
            this.updateButtons(state);
        },
    });

    return TimesheetGridController;
});
