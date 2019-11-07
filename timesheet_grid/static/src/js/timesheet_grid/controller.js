odoo.define('timesheet_grid.GridController', function (require) {
    "use strict";

    const WebGridController = require('web_grid.GridController');

    return WebGridController.extend({
        events: _.extend({}, WebGridController.prototype.events, {
            'click button.timer_task': "_onClickTimerButton",
        }),
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
         * @private
         * @param {MouseEvent} ev
         */
        _onClickTimerButton: async function (ev) {
            const button = ev.currentTarget;
            const index = button.id.split(' ')[1];
            const { data, timesheet } = this.renderer.timerButtons[index];

            if (timesheet) {
                const action = button.name;

                await this._rpc({
                    model: this.modelName,
                    method: action,
                    args: [timesheet.id]
                });
            } else {
                // create the timesheet and render
                // The task can be false.
                if (data.task_id) {
                    await this.model._createTimesheet({task_id: data.task_id[0]});
                } else {
                    // if task is false then retrieve the project_id
                    // in the domain to create timesheet
                    // with the project_id
                    await this.model._createTimesheet({project_id: data.project_id[0]});
                }
            }
            ev.stopPropagation();
            await this.model.reload();

            const state = this.model.get();
            await this.renderer.updateState(state, {});
            this._updateButtons(state);
        }
    });

});
