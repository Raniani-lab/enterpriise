odoo.define('timesheet_grid.GridRenderer', function (require) {
"use strict";

    const WebGridRenderer = require('web_grid.GridRenderer');

    const h = require('snabbdom.h');
    const toVNode = require('snabbdom.tovnode');

    const Timer = require('timer.Timer');

    return WebGridRenderer.extend({
        /**
         * @override
         * @param {Widget} parent
         * @param {Object} state
         * @param {Object} params
         */
        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            this.initialGridAnchor = state.context.grid_anchor;
            this.initialGroupBy = state.groupBy;
        },
        /**
         * render the timesheetgrid view
         *
         * @override
         */
        _render: function () {
            clearInterval(this.timer);
            this.time = null;
            this.timerButtons = [];

            if (this.formatType == "float_time") { // if the encoding unit is Hour
                // then we can render button for the timer
                if (
                    this.state.context.grid_anchor === this.initialGridAnchor &&
                    _.difference(this.initialGroupBy, this.state.groupBy).length === 0
                    ) {
                    // if the view shows the date of today then we create the timer button.
                    this._createTimerButtonByTask();
                }
            }

            // render the virtual elements in the DOM
            this._super.apply(this, arguments);

            if (this.time) { // if a timer exists then we launch the timer
                this._startTimerCounter();
            }

            return Promise.resolve();
        },
        /**
         * @override @see grid_renderer.js
         * @private
         * @param {Array<Array>} grid actual grid content
         * @param {Array<String>} groupFields
         * @param {Array} path object path to `grid` from the object's state
         * @param {Array} rows list of row keys
         * @param {Object} totals row-keyed totals
         * @returns {snabbdom[]}
         */
        _renderGridRows: function (grid, groupFields, path, rows, totals) {
            // we need the virtual element created by the parent
            // to continue the process to render timer button and timer
            const result = this._super.apply(this, arguments);

            if (this.timerButtons.length > 0) {
                // if the controller has created some timer buttons
                // then we need to render these.
                const tab = this._searchColToAddButton(result);

                for (let i = 0; i < tab.length; i++) {
                    const {
                        button,
                        timesheet
                    } = rows[i];
                    const element = tab[i];
                    const vButton = toVNode(button);

                    if (element && button.value) {
                        if (timesheet && timesheet.timer_start) {
                            // To create the timer, a method has already been written to make this
                            // into Timer class in the odoo/addons/hr_timesheet/static/src/js/Timer.js file
                            this.time = Timer.createTimer(timesheet.unit_amount, timesheet.timer_start, this.state.serverTime);
                            // add the virtual element contains the display of timer as children
                            // of virtual element that it contains the name of a task as children.
                            element.children.push(this._renderTimer());
                        }
                        // add the virtual timer button into the virtual element found
                        element.children.push(vButton);
                    }
                }
            }

            return result;
        },
        /**
         * Search element contains the name of the task in grid view.
         * In this element, we want to display the button for the timer
         * and display the timer is the timer is activate.
         *
         * @param {Array} array virtual element
         */
        _searchColToAddButton: function (array) {
            const tab = [];

            for (const element of array) {
                if (element.sel === 'tr') {
                    if (element.children.length > 0) {
                        tab.push(this._searchColToAddButton(element.children));
                    }
                }
                if (element.sel === 'th') {
                    if (element.children.length > 0) {
                        return this._searchColToAddButton(element.children);
                    }
                } else if (element.sel === 'div') {
                    if (element.children.length > 0) {
                        return element;
                    }
                }
            }

            return tab.length > 0 ? tab : null;
        },
        /**
         * Render a timer for the current timesheet
         *
         * @param {float} unit_amount the unit_amount of current timesheet
         * @param {Date} start the date when the timer if launch for the current timesheet.
         */
        _renderTimer: function () {
            return h('span.mr-3', {
                attrs: {id: 'display_timer'},
                class: {'font-weight-bold': true, 'text-danger': true}
            }, this.time.toString());
        },
        /**
         * Launch the timer
         */
        _startTimerCounter: function () {
            if (this.time) {
                const timer = this.$el.find('span#display_timer');
                this.timer = setInterval(() => {
                    this.time.addSecond(); // add one second to timer
                    timer.text(this.time.toString());
                }, 1000);
            } else {
                clearInterval(this.timer);
            }
        },
        /**
         * Create timer button by task
         *
         * Explanation about the structure of state in the renderer :
         * In 'My Timesheets' page, the state contains each line with the name of the task by default.
         * For example, if we have 2 differents tasks, the state contains the tasks like this :
         * state = {
         *      0: (data for the first task),
         *      1: (data for the second task),
         *      ...
         * }
         */
        _createTimerButtonByTask: function () {
            let i = 0;

            while (this.state.hasOwnProperty(i)) {
                const { rows } = this.state[i];

                if (rows.length > 0) {
                    for (const row of rows) {
                        const data = row.values;

                        data.project_id = this.state[i].__label;
                        row.button = this._createTimerButtons(row.timesheet, row.project);
                        if(row.button){
                            this.timerButtons.push({
                                button: row.button,
                                data,
                                domain: row.domain,
                                timesheet: row.timesheet
                            });
                        }
                    }
                }

                i += 1;
            }
        },
        /**
         * Create a timer button for a task_id
         *
         * @param {Object} task contains the information about a task_id field, like id and name.
         */
        _createTimerButtons: function (timesheet, project) {
            const propsButton = {
                value: false,
                class: 'o_icon_button timer_task o-timer-button',
                id: `timer_button ${this.timerButtons.length}`,
                title: 'play',
                'aria-label': 'start',
                'aria-pressed': false,
                type: 'button'
            };

            const propsIcon = {
                class: 'fa fa-circle'
            };

            if (timesheet && timesheet.timer_start) {
                propsButton.name = 'action_timer_stop';
                propsButton.value = true;
                propsButton['aria-pressed'] = true;
                propsButton.title = 'stop';
                propsButton['aria-label'] = 'stop';
                propsIcon.class += ' fa-stop-circle o-timer-stop-button';
            } else {
                propsButton.name = 'action_timer_start';
                propsButton['aria-label'] = 'start';
                propsIcon.class += ' fa-play-circle o-timer-play-button';
            }

            if(!project.allow_timesheet_timer){
                propsButton.class += ' d-none';
            }

            const button = document.createElement('button');
            const icon = document.createElement('i');

            for (let key in propsButton) {
                button.setAttribute(key, propsButton[key]);
            }

            for (let key in propsIcon) {
                icon.setAttribute(key, propsIcon[key]);
            }

            button.appendChild(icon);

            return button;
        },
        /**
         * @override
         */
        destroy: function () {
            this.timerButtons = [];
            this._super.apply(this, arguments);
            clearInterval(this.timer);
        }
    });
});
