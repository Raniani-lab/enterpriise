/** @odoo-module **/

import { useBus, useService } from "@web/core/utils/hooks";
import Tablet from '@mrp_workorder/components/tablet';
import { SelectionPopup } from '@mrp_workorder_hr/components/popup';
import { WorkingEmployeePopup } from '@mrp_workorder_hr/components/working_employee_popup';
import { patch } from 'web.utils';
import { PinPopup } from '@mrp_workorder_hr/components/pin_popup';

const { onMounted, useState } = owl;

patch(Tablet.prototype, 'mrp_workorder_hr', {
    setup() {
        this._super();
        this.notification = useService("notification");
        this.popup.SelectionPopup = {
            isShown: false,
            data: {},
        };
        this.popup.PinPopup = {
            isShown: false,
            data: {},
        };
        this.popup.WorkingEmployeePopup = {
            isShown: false,
            data: {},
        };
        this.state.tabletEmployeeIds = [];
        this.employees_connected = useState({ logged: [] });
        this.orm = useService("orm");
        useBus(this.workorderBus, "popupEmployeeManagement", this.popupEmployeeManagement);
        onMounted(() => this.checkEmployeeLogged());
    },

    checkEmployeeLogged() {
        if (this.data.employee_list.length && !this.data.employee_id) {
            this.popupAddEmployee();
        }
        else {
            this.state.tabletEmployeeIds.push(this.data.employee_id);
        }
    },
    // Popup Menu Actions

    popupEmployeeManagement() {
        this.showPopup({ workorderId: this.workorderId }, 'WorkingEmployeePopup');
    },

    async popupAddEmployee() {
        await this.closePopup("WorkingEmployeePopup");
        const list = this.data.employee_list.filter(e => !this.data.employee_ids.includes(e.id)).map((employee) => {
            return {
                id: employee.id,
                item: employee,
                label: employee.name,
                isSelected: false,
            };
        });
        const title = this.env._t('Change Worker');
        this.showPopup({ title, list }, 'SelectionPopup');
    },

    popupEmployeePin(employeeId) {
        const employee = this.data.employee_list.find(e => e.id === employeeId);
        this.showPopup({ employee }, 'PinPopup');
    },

    // Buisness method

    async startEmployee(employeeId) {
        this.state.tabletEmployeeIds.push(employeeId);
        await this.orm.call(
            'mrp.workorder',
            'start_employee',
            [this.workorderId, employeeId],
        );
        await this.getState();
        this.render();
        this.popup.SelectionPopup.isShown = false;
        return true;
    },

    async stopEmployee(employeeId) {
        const index = this.state.tabletEmployeeIds.indexOf(employeeId);
        this.state.tabletEmployeeIds.splice(index, 1);
        await this.orm.call(
            'mrp.workorder',
            'stop_employee',
            [this.workorderId, [employeeId]],
        );
        await this.getState();
        this.popup.SelectionPopup.isShown = false;
        this.render();
        return true;
    },

    async connectEmployee(employeeId, pin) {
        if (this.data.employee_id == employeeId) {
            if (!this.data.employee_ids.includes(employeeId)) {
                this.startEmployee(employeeId);
            }
            this.render();
            return true;
        }
        const pinValid = await this._pinValidation(employeeId, pin);
        if (!pinValid) {
            if (pin) {
                this.notification.add(this.env._t('Wrong password !'), { type: 'danger' });
            }
            if (!this.popup.PinPopup.isShown) {
                await this.closePopup("WorkingEmployeePopup");
                this.popupEmployeePin(employeeId);
            }
            return pinValid
        }
        this._setSessionOwner(employeeId, pin);
        if (!this.data.employee_ids.includes(employeeId)) {
            this.startEmployee(employeeId);
        }
        this.render();
        return pinValid;
    },

    get isBlocked() {
        let isBlocked = this._super();
        if (this.data.employee_list.length && (this.data.employee_ids.length == 0 || !this.data.employee_id)) {
            isBlocked = true;
        }
        return isBlocked;
    },

    // Private

    async _pinValidation(employeeId, pin = "") {
        return await this.orm.call(
            'hr.employee',
            'pin_validation',
            [employeeId, pin]
        );
    },

    async _onBarcodeScanned(barcode) {
        const employee = await this.orm.call("mrp.workcenter", "get_employee_barcode", [this.workcenterId, barcode]);
        if (employee) {
            this.connectEmployee(employee);
        } else {
            return this._super(barcode);
        }
    },

    async _setSessionOwner(employeeId, pin) {
        if (this.data.employee_id != employeeId) {
            await this.orm.call(
                "hr.employee",
                "login",
                [employeeId, pin],
            );
            await this.getState();
        }
    },

    async _onWillStart() {
        const superMethod = this._super;
        this.employees_connected.logged = await this.orm.call("hr.employee", "get_employees_connected", [null]);
        await this.employees_connected.logged.forEach(async (emp) => {
            if (emp && emp.id) await this.startEmployee(emp.id);
        })
        await superMethod();
        await this.getState();
    },
});

Tablet.components.SelectionPopup = SelectionPopup;
Tablet.components.PinPopup = PinPopup;
Tablet.components.WorkingEmployeePopup = WorkingEmployeePopup;
