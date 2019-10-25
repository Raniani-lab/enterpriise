odoo.define('timesheet_grid.GridModel', function (require) {
"use strict";

    const { _t } = require('web.core');
    const fieldUtils = require('web.field_utils');

    const WebGridModel = require('web_grid.GridModel');

    return WebGridModel.extend({
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
        reload: async function () {
            await this._super.apply(this, arguments);

            return this._loadTimesheetByTask();
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
                        const {rowIndex, gridIndex, timesheet} = data;
                        const { rows, grid } = this._gridData[gridIndex];

                        rows[rowIndex].timesheet = timesheet;
                        if (timesheet && timesheet.timer_start) {
                            grid[rowIndex].map((column) => column.readonly = column.is_current);
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

                    if (record.name === _t('Timesheet Adjustment') && date === today) {
                        return {rowIndex, gridIndex, timesheet: record};
                    }
                }

                return null;
            }
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
            const fieldNames = ['date', 'timer_start'];

            fieldNames.forEach((field) => {
                if (record) {
                    record[field] = fieldUtils.parse.datetime(record[field], null, {_isUTC: true});
                }
            });
        }
    });

});
