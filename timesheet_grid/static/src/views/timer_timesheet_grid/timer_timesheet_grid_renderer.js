/** @odoo-module */

import { useService } from "@web/core/utils/hooks";

import { TimesheetGridRenderer } from "../timesheet_grid/timesheet_grid_renderer";
import { GridTimerButtonCell } from "../../components/grid_timer_button_cell/grid_timer_button_cell";

import { useState, onWillUpdateProps, useExternalListener } from '@odoo/owl';

export class TimerTimesheetGridRenderer extends TimesheetGridRenderer {
    setup() {
        super.setup();
        this.timerState = useState({
            timerRunningRowId:
                Boolean(this.props.model.data.timer && this.props.model.data.timer.row)
                && this.props.model.data.timer.row.id,
            addTimeMode: false,
        });
        this.timesheetUOMService = useService('new_timesheet_uom');
        useExternalListener(window, 'keydown', this.onKeyDown);
        useExternalListener(window, 'keyup', this.onKeyUp);
    }

    getDefaultState(data) {
        const res = super.getDefaultState(data);
        for (const rowId in data.rows) {
            res[`timer-${rowId}`] = false;
        }
        return res;
    }

    get columnsGap() {
        return super.columnsGap + (this.showTimer ? 1 : 0);
    }

    get gridTemplateColumns() {
        let gridTemplateColumns = super.gridTemplateColumns;
        if (this.showTimer) {
            gridTemplateColumns = `40px ${gridTemplateColumns}`;
        }
        return gridTemplateColumns;
    }

    /**
     * Show timer feature
     *
     * @returns {boolean} returns true if the timer feature can be displayed and used.
     */
    get showTimer() {
        return this.timesheetUOMService.timesheetWidget === 'float_time';
    }

    /**
     * @returns {boolean} returns true if when we need to display the timer button
     *
     */
    get showTimerButton() {
        return this.showTimer
            && !this.props.model.sectionField
            && this.props.model.rowFields.length
            && this.props.model.rowFields[0].name === "project_id";
    }

    /**
     * format the overtime to display it in the total of the column
     *
     * @param {import("@web_grid/views/grid_model").DateGridColumn} column
     */
    formatDailyOvertime(column) {
        if (this.props.model.workingHoursData.daily.hasOwnProperty(column.value)) {
            const workingHours = this.props.model.workingHoursData.daily[column.value];
            const overtime = column.grandTotal - workingHours;
            if (overtime != 0) {
                return `${overtime > 0 ? '+' : ''}${this.formatValue(overtime)}`;
            }
        }
        return '';
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev) {
        if (ev.key === 'Shift' && !this.timerState.timerRunning && !this.isEditing) {
            this.timerState.addTimeMode = true;
        } else if (!ev.altKey && !ev.ctrlKey && !ev.metaKey && this.showTimerButton && ev.target.tagName.toLowerCase() !== 'input') {
            if (ev.key === 'Escape' && this.timerState.timerRunning) {
                this.props.model.deleteTimer();
                this.timerState.timerRunningRowId = false;
                return;
            }
            if (this.timerState.addTimeMode && this.props.model.data.rowPerKeyBinding && ev.key in this.props.model.data.rowPerKeyBinding) {
                this.props.model.data.rowPerKeyBinding[ev.key].addTime();
            }
        }
    }
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyUp(ev) {
        if (ev.key === 'Shift' && !this.isEditing) {
            this.timerState.addTimeMode = false;
        }
    }

    /**
     *
     * @param {import("@web_grid/views/grid_model").GridRow} row
     */
    onTimerClick(row) {
        const timerRunning = this.timerState.timerRunning;
        this.timerState.timerRunning = !timerRunning;
        if (!timerRunning) {
            row.startTimer();
            this.timerState.timerRunningRowId = row.id;
        } else {
            row.stopTimer();
            this.timerState.timerRunningRowId = false;
        }
    }
}

TimerTimesheetGridRenderer.template = 'timesheet_grid.new_TimerGridRenderer';
TimerTimesheetGridRenderer.components = {
    ...TimesheetGridRenderer.components,
    GridTimerButtonCell,
};
