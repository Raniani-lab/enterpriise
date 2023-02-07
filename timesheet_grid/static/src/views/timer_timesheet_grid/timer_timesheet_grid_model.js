/** @odoo-module */

import { serializeDate } from "@web/core/l10n/dates";
import { GridRow } from "@web_grid/views/grid_model";
import { TimesheetGridModel } from "../timesheet_grid/timesheet_grid_model";

export class TimerGridRow extends GridRow {
    constructor(domain, valuePerFieldName, model, section, isAdditionalRow = false) {
        super(domain, valuePerFieldName, model, section, isAdditionalRow);
        this.timerRunning = false;
    }

    async startTimer() {
        const vals = {};
        const getValue =
            (fieldName, value) =>
                this.model.fieldsInfo[fieldName].type === "many2one" ? value[0] : value;
        for (const [key, value] of Object.entries(this.valuePerFieldName)) {
            vals[key] = getValue(key, value);
        }
        if (!this.section.isFake) {
            vals[this.model.sectionField.name] = getValue(this.model.sectionField.name, this.section.value);
        }
        await this.model.startTimer(vals, this);
        this.timerRunning = true;
    }

    async stopTimer() {
        await this.model.stopTimer();
        this.timerRunning = false;
    }

    async addTime() {
        await this.model.addTime(
            this.valuePerFieldName.project_id[0],
            this.valuePerFieldName.task_id && this.valuePerFieldName.task_id[0],
        );
    }
}

export class TimerTimesheetGridModel extends TimesheetGridModel {
    get timesheetWorkingHoursPromises() {
        const promises = super.timesheetWorkingHoursPromises;
        promises.push(this.fetchDailyWorkingHours());
        return promises;
    }

    get showTimer() {
        return !this.sectionField && this.rowFields.length && this.rowFields[0].name === 'project_id';
    }

    async _getRunningTimer() {
        if (!this.showTimer) {
            return;
        }
        const timesheetWithTimerData = await this.orm.call(
            this.resModel,
            'get_running_timer',
        );
        if (timesheetWithTimerData.id !== undefined) {
            this.data.timer = timesheetWithTimerData;
            let rowKey = '';
            if (this.sectionField && this.sectionField.name) {
                rowKey +=`${this.data.timer[this.sectionField.name]}@|@`;
            }
            for (const row of this.rowFields) {
                rowKey += `${this.data.timer[row.name]}\\|/`;
            }
            if (rowKey in this.data.rowsKeyToIdMapping) {
                const row = this.data.rows[this.data.rowsKeyToIdMapping[rowKey]];
                row.timerRunning = true;
                this.data.timer.row = row;
            }
        } else if (this.data.timer) { // remove running timer since there is no longer.
            if ('row' in this.data.timer) {
                this.data.timer.row.timerRunning = false;
            }
            delete this.data.timer;
        }
    }

    async startTimer(vals, row) {
        const timesheetTimer = await this.orm.call(
            this.resModel,
            'action_start_new_timesheet_timer',
            [vals],
        );
        this.data.timer = timesheetTimer;
        this.data.timer.row = row;
    }

    async stopTimer() {
        await this.orm.call(
            this.resModel,
            'action_timer_stop',
            [this.data.timer.id, true],
        );
        this.fetchData();
    }

    async deleteTimer() {
        await this.orm.unlink(
            this.resModel,
            'action_timer_unlink',
            [this.data.timer.id],
        );
        this.data.timer.row.timerRunning = false;
        delete this.data.timer;
    }

    async addTime(projectId, taskId=undefined) {
        const timesheetId = this.data.timer && this.data.timer.id;
        await this.orm.call(
            this.resModel,
            'action_add_time_to_timesheet',
            [timesheetId, projectId, taskId],
        );
        this.fetchData();
    }

    async fetchDailyWorkingHours() {
        const dailyWorkingHours = await this.orm.call(
            'hr.employee',
            'get_daily_working_hours',
            [serializeDate(this.navigationInfo.periodStart), serializeDate(this.navigationInfo.periodEnd)],
        )
        this.data.workingHours.daily = dailyWorkingHours;
    }

    _getAdditionalPromises() {
        const promises = super._getAdditionalPromises();
        promises.push(this._getRunningTimer());
        return promises;
    }

    async _initialiseData() {
        super._initialiseData();
        this.data.rowPerKeyBinding = {};
        this.timerButtonIndex = 0;
    }

    _itemsPostProcess(item) {
        super._itemsPostProcess(item);
        if (this.showTimer) {
            for (const row of this.rowsArray) {
                if (!row.isSection && this.showTimer && this.timerButtonIndex < 26) {
                    const timerButtonKey = String.fromCharCode(65 + this.timerButtonIndex++);
                    this.data.rowPerKeyBinding[timerButtonKey] = row;
                }
            }
        }
    }
}

TimerTimesheetGridModel.Row = TimerGridRow;
