odoo.define('timesheet_grid.TimerComponent', function (require) {
    "use strict";

    const Timer = require('timer.Timer');
    const utils = require('web.utils');

    const { useState } = owl.hooks;


    class TimerComponent extends owl.Component {
        constructor() {
            super(...arguments);
            this._createTimerData(this.path);
            this.state = useState({time: null});
            this.timerStarted = false;
            if (this.timesheet && this.timesheet.timer_start) {
                this.timerStarted = true;
                this.state.time = Timer.createTimer(this.timesheet.unit_amount, this.timesheet.timer_start, this.props.serverTime);
                this._startTimerCounter();
            }
        }
        patched() {
            if (this.timesheet && this.timesheet.timer_start && !this.timerStarted) {
                this.state.time = Timer.createTimer(this.timesheet.unit_amount, this.timesheet.timer_start, this.props.serverTime);
                this._startTimerCounter();
            } else if (this.timesheet && !this.timesheet.timer_start) {
                this.timerStarted = false;
                clearInterval(this.timer);
            }
        }

        //----------------------------------------------------------------------
        // Getters
        //----------------------------------------------------------------------

        get path() {
            return this.props.path;
        }
        get propsButton() {
            const propsButton = {
                value: 'false',
                class: 'o_icon_button timer_task o-timer-button',
                title: 'play',
                arialabel: 'start',
                ariapressed: 'false',
            };
            if (this.timesheet && this.timesheet.timer_start) {
                propsButton.name = 'action_timer_stop';
                propsButton.value = 'true';
                propsButton['aria-pressed'] = 'true';
                propsButton.title = 'stop';
                propsButton['aria-label'] = 'stop';
            } else {
                propsButton.name = 'action_timer_start';
                propsButton['aria-label'] = 'start';
            }
            return propsButton;
        }
        get propsIcon() {
            const propsIcon = {
                class: 'fa fa-circle'
            };
            if (this.timesheet && this.timesheet.timer_start) {
                propsIcon.class += ' fa-stop-circle o-timer-stop-button';
            } else {
                propsIcon.class += ' fa-play-circle o-timer-play-button';
            }
            return propsIcon;
        }
        get timerString() {
            if (this.state.time) {
                return this.state.time.toString();
            }
            return "00:00";
        }
        get timesheet() {
            return this.props.timesheet;
        }

        //----------------------------------------------------------------------
        // private
        //----------------------------------------------------------------------

        /**
         * Initializes this.data
         *
         * @private
         */
        _createTimerData(path) {
            const cell_path = path.split('.');
            const grid_path = cell_path.slice(0, -2);
            const row_path = grid_path.concat(['rows'], cell_path.slice(-1));
            const grid = utils.into(this.props.grid, grid_path);
            const row = utils.into(this.props.grid, row_path);
            this.data = Object.assign(row.values, { project_id: grid.__label });
        }
        /**
         * Launch the timer
         *
         * @private
         */
        _startTimerCounter() {
            if (this.state.time) {
                this.timerStarted = true;
                this.timer = setInterval(() => {
                    this.state.time.addSecond(); // add one second to timer
                }, 1000);
            } else {
                clearInterval(this.timer);
            }
        }

        //----------------------------------------------------------------------
        // Handlers
        //----------------------------------------------------------------------

        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onClickTimer(ev) {
            ev.stopPropagation();
            clearInterval(this.timer);
            this.timerStarted = false;
            this.trigger('click_timer_button', {
                action: ev.currentTarget.name,
                timesheet: this.timesheet,
                data: this.data,
            });
        }
    }
    TimerComponent.template = 'timesheet_grid.timer';
    TimerComponent.props = {
        grid: [{
            cols: [{
                values: Object,
                domain: Array,
                is_current: Boolean
            }],
            grid: [{
                size: Number,
                domain: Array,
                value: Number,
                readonly: {
                    type: Boolean,
                    optional: true
                },
                is_current: Boolean
            }],
            initial: Object,
            next: Object,
            prev: Object,
            rows: [{
                values: Object,
                domain: Array,
                project: Object,
                label: Array
            }],
            totals: {
                columns: Object,
                rows: Object,
                super: Number
            },
            __label: Array
        }],
        path: String,
        timesheet: {
            type: Object,
            optional: true
        },
        serverTime: {
            type: String,
            optional: true
        },
    };
    return TimerComponent;
});
