odoo.define('timesheet_grid.GridModel', function (require) {
"use strict";

    const { _t } = require('web.core');
    const fieldUtils = require('web.field_utils');

    const WebGridModel = require('web_grid.GridModel');

    var TimerWebGridModel = WebGridModel.extend({
        /**
         * @override
         */
        load: async function () {
            await this._super.apply(this, arguments);

            return this._loadTimesheetByTask();
        },
        /**
         * @override
         */
        reload: async function (handle, params) {
            if (params && 'groupBy' in params) {
                // With timesheet grid, it makes nonsense to manage group_by with a field date (as the dates are already in the rows).
                // Detection of groupby date with ':' (date:day). Ignore grouped by date, and display warning.
                var GroupBy = params.groupBy.filter(filter => {
                    return filter.split(':').length === 1;
                });
                if (GroupBy.length !== params.groupBy.length) {
                    this.do_warn(_t('Invalid group by'), _t('Grouping by date is not supported, ignoring it'));
                }
                params.groupBy = GroupBy;
            }
            await this._super.apply(this, arguments);

            return this._loadTimesheetByTask();
        },
        getServerTime: async function () {
            const time = await this._rpc({
                model: 'timer.timer',
                method: 'get_server_time',
                args: [],
            });

            this._gridData.serverTime = time;
        },
        /**
         * Update state
         *
         * When the user click on a timer button, we need to update the state without reordered the data.
         */
        actionTimer: async function (state) {
            await this.reload();

            let i = 0;

            const array = [];

            while (state.hasOwnProperty(i)) {
                array.push(state[i]);
                i += 1;
            }

            i = 0;

            // Get fields containing in rowFields without the sectionField
            const fields = _.difference(this.rowFields, [this.sectionField]);

            while (this._gridData.hasOwnProperty(i)) {
                array.some((el, index) => {
                    if (_.isEqual(el.__label, this._gridData[i].__label)) {
                        state[index].cols = this._gridData[i].cols;
                        if (this._checkRowsSameOrder(state[index].rows, this._gridData[i].rows, fields)) {
                            // Then same order
                            state[index].grid = this._gridData[i].grid;
                            state[index].rows = this._gridData[i].rows;
                        } else {
                            // Update state with the same order than the old state
                            const {rows, grid} = this._updateGrid(
                                {rows: state[index].rows, grid: state[index].grid},
                                {rows: this._gridData[i].rows, grid: this._gridData[i].grid},
                                fields
                            );

                            state[index].rows = rows;
                            state[index].grid = grid;
                        }

                        return true;
                    }
                });

                i += 1;
            }
            if (this._gridData.serverTime) {
                state.serverTime = this._gridData.serverTime;
            }
            this._gridData = state;
            return this._gridData;
        },
        /**
         * Check if the "rows" of 2 states (old and new) contains theirs elements in the same order
         * @param {Array} a contains rows of oldState
         * @param {Array} b contains rows of newState
         * @param {Array} fields contains rowFields of grid view without the sectionField
         */
        _checkRowsSameOrder: function (a, b, fields) {
            if (a.length !== b.length) {
                return false;
            }

            for (let i = 0; i < a.length; i++) {
                for (const field of fields) {
                    if (a[i].values[field] === false && b[i].values[field] !== false) {
                        return false;
                    }
                    if (_.difference(a[i].values[field], b[i].values[field]).length !== 0) {
                        return false;
                    }
                }
            }

            return true;
        },
        /**
         * We want to update the state when the user clicks on the timer button, but we want to keep
         * the same order that the oldState.
         *
         * @param {Array} a contains rows and grid of oldState
         * @param {Array} b contains rows and grid of newState
         * @param {Array} fields contains rowFields of grid view without the sectionField
         */
        _updateGrid: function (a, b, fields) {
            const result = {rows: [], grid: []};

            let i = 0;
            for (i = 0; i < a.rows.length; i++) {
                b.rows.some((row, index) => {
                    for (const field of fields) {
                        if (a.rows[i].values[field] === false && row.values[field] !== false) {
                            return false;
                        }
                        if (_.difference(a.rows[i].values[field], row.values[field]).length !== 0) {
                            return false;
                        }
                    }
                    result.rows.push(row);
                    result.grid.push(b.grid[index]);
                    return true;
                });
            }

            if (i < b.rows.length) {
                for (i; i < b.rows.length; i++) {
                    result.rows.push(b.rows[i]);
                    result.grid.push(b.grid[i]);
                }
            }

            return result;
        },
        /**
         * Load timesheets by task.
         *
         * _gridData is an Object containing the data of each row
         * we need to retrieve and add the timesheet data for today (useful for timer)
         * in every row.
         */
        _loadTimesheetByTask: async function () {
            let i = 0;
            const promises = [];

            while (this._gridData.hasOwnProperty(i)) {
                const { rows } = this._gridData[i];

                if (rows.length > 0) {
                    for (const [index, row] of rows.entries()) {
                        promises.push(this._searchTimesheet(row.domain, index, i));
                    }
                }

                i += 1;
            }

            if (promises.length > 0) {
                const timesheets = await Promise.all(promises);
                for (const data of timesheets) {
                    if (data) {
                        const {rowIndex, gridIndex, timesheet, project} = data;
                        const { rows, grid } = this._gridData[gridIndex];
                        if (project) {
                            rows[rowIndex].project = project;
                        }
                        if (timesheet) {
                            rows[rowIndex].timesheet = timesheet;
                            if (timesheet.timer_start) {
                                grid[rowIndex].map((column) => column.readonly = column.is_current);
                                await this.getServerTime();
                            }
                        }
                    }
                }
            }
        },
        /**
         * Search timesheet from the information of the the domain given in parameter
         *
         * @param {Number} rowIndex the index of the row to add the timesheet found
         * @param {Number} gridIndex the index of the gridData
         * @param {Array} domain domain to find the timesheet
         */
        _searchTimesheet: async function (domain, rowIndex, gridIndex) {
            const timesheets = await this._rpc({
                model: this.modelName,
                method: 'search_read',
                args: [domain],
                fields: ['id', 'name', 'task_id', 'project_id', 'date', 'unit_amount', 'timer_start']
            });

            this._parseServerData(timesheets);

            
            if (timesheets.length === 0) {
                return null;
            } else {
                const today = moment().utc().get('date');
                
                for (const record of timesheets) {
                    const date = record.date.get('date');

                    // Get the project then return it in any case
                    const project = await this._searchProject(record.project_id[0]);

                    if (record.name === _t('Timesheet Adjustment') && date === today) {
                        return {rowIndex, gridIndex, timesheet: record, project};
                    }
                    return {rowIndex, gridIndex, project}
                }

                return null;
            }
        },
        /**
         * Search project project id given in parameter
         *
         * @param {Number} projectId the id of the project
         */
        _searchProject: async function(projectId){
            const project = await this._rpc({
                model: 'project.project',
                method: 'search_read',
                fields: ['id', 'name', 'allow_timesheet_timer'],
                domain: [['id', '=', projectId]]
            });
            if (project.length > 0) {
                return project[0]
            }
            return null;
        },
        /**
         * Request to create a timesheet when we click to start a timer for a task.
         *
         * @param {*} data
         */
        _createTimesheet: async function (data) {
            const result = await this._rpc({
                model: this.modelName,
                method: 'create_timesheet_with_timer',
                args: [data] || []
            });

            this._parseServerValue(result);

            return result;
        },
        /**
         * Parse the server values to javascript framework
         *
         * @private
         * @param {Array} data the server data to parse
         */
        _parseServerData: function (data) {
            data.forEach((record) => {
                this._parseServerValue(record);
            });
        },
        _parseServerValue: function (record) {
            record.date = fieldUtils.parse.date(record.date, null, {isUTC: true});
        }
    });

    var NoGroupByDateWebGridModel = WebGridModel.extend({
        /**
         * @override
         */
        reload: async function (handle, params) {
            if (params && 'groupBy' in params) {
                // With timesheet grid, it makes nonsense to manage group_by with a field date (as the dates are already in the rows).
                // Detection of groupby date with ':' (date:day). Ignore grouped by date, and display warning.
                var GroupBy = params.groupBy.filter(filter => {
                    return filter.split(':').length === 1;
                });
                if (GroupBy.length !== params.groupBy.length) {
                    this.do_warn(_t('Invalid group by'), _t('Grouping by date is not supported, ignoring it'));
                }
                params.groupBy = GroupBy;
            }
            return this._super.apply(this, arguments);
        },
    });

    return {
        timer: TimerWebGridModel,
        no_group_by_date: NoGroupByDateWebGridModel
    };

});
