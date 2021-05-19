/** @odoo-module **/

import core from 'web.core';

import { registry } from '@web/core/registry';
import { useService } from "@web/core/utils/hooks";

import { getMessagingComponent } from '@mail/utils/messaging_component';

import { PayrollDashboardActionBox } from '@hr_payroll/components/dashboard/action_box/action_box';
import { PayrollDashboardPayslipBatch } from '@hr_payroll/components/dashboard/payslip_batch/payslip_batch';
import { PayrollDashboardTodo } from '@hr_payroll/components/dashboard/todo_list/todo_list';
import { PayrollDashboardStats } from '@hr_payroll/components/dashboard/payroll_stats/payroll_stats';

const _t = core._t;
const qweb = core.qweb;

const { Component } = owl;
const { useDispatch } = owl.hooks;

const dashboardStoreActions = {
    /**
     * Called upon initial loading and after every update to notes
     */
    updateAllNotes({state}, noteData) {
        state.notes = noteData;
    },

    /**
     * Called upon saving a note
     */
    updateNote({state}, id, noteData) {
        const idx = state.notes.findIndex((note) => note.id === id);
        state.notes[idx] = noteData;
    },
};

const dashboardStoreGetters = {
    getNote({state}, id) {
        return state.notes.find((note) => note.id === id);
    },
};

const dashboardStoreInitialState = {
    notes: [],
};

class PayrollDashboardComponent extends Component {

    // Lifecycle

    /**
     * @override
     */
    setup() {
        this.orm = useService('orm');
        const store = new owl.Store({
            state: dashboardStoreInitialState,
            actions: dashboardStoreActions,
            getters: dashboardStoreGetters,
        });
        this.env.store = store;
        this.dispatch = useDispatch();
        this.PayrollDashboardTodo = PayrollDashboardTodo;
    }

    /**
     * @override
     */
    async willStart() {
        this.dashboardData = await this.orm.call(
            'hr.payslip', 'get_payroll_dashboard_data', []
        );
        this.dispatch('updateAllNotes', this.dashboardData['notes']['notes']);
    }

    // Public

    /**
     * @return {object} Complete data provided by `get_payroll_dashboard_data` (See hr_payslip.py)
     */
    get data() {
        return this.dashboardData;
    }

    // Different sections of the dashboard's data

    /**
     * @return {object} Actions section of data
     */
    get actionData() {
        return this.dashboardData['actions'];
    }

    /**
     * @return {object} Notes section of data
     */
    get notes() {
        return this.dashboardData['notes'];
    }

    /**
     * @return {object} Batches section of data
     */
    get batches() {
        return this.dashboardData['batches'];
    }

    /**
     * @return {object} Stats section of data
     */
    get stats() {
        return this.dashboardData['stats'];
    }

    // Private

    /**
     * Updates the note in database and reload notes data right after.
     *
     * @private
     * @param {*} ev
     */
    async _updateMemo(ev) {
        ev.preventDefault();
        await this.orm.write(
            'note.note', [ev.detail.id], {memo: ev.detail.memo},
        );
        this._reloadMemos(ev);
    }

    /**
     * Call to reload memo data in the store.
     *
     * @private
     * @param {*} ev
     */
    async _reloadMemos(ev) {
        const newData = await this.orm.call(
            'hr.payslip', 'get_payroll_dashboard_data', [], {
                sections: ['notes'],
            },
        );
        this.dispatch('updateAllNotes', newData['notes']['notes']);
        Object.assign(this.notes, newData['notes']);
    }

}

PayrollDashboardComponent.template = 'hr_payroll.Dashboard';
PayrollDashboardComponent.components = {
    PayrollDashboardActionBox,
    PayrollDashboardPayslipBatch,
    PayrollDashboardTodo,
    PayrollDashboardStats,
};

registry.category('actions').add('hr_payroll_dashboard', PayrollDashboardComponent);

export default PayrollDashboardComponent;
