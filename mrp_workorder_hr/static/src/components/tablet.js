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
        this.employees_connected = useState({logged:[]});
        this.actionRedirect = false;
        useBus(this.workorderBus, "popupEmployeeManagement", this.popupEmployeeManagement);
        onMounted(() => this.checkEmployeeLogged());
    },

    checkEmployeeLogged() {
        if (this.data.employee_list.length && !this.data.employee && this.employees_connected.logged.length==0) {
            this.popupAddEmployee();
        }
    },
    // Popup Menu Actions

    popupEmployeeManagement() {
        this.showPopup({ workorderId: this.workorderId }, 'WorkingEmployeePopup');
    },

    popupAddEmployee() {
        const list = this.data.employee_list.filter(e => ! this.data.employee_ids.includes(e.id)).map((employee) => {
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

    async lockEmployee(employeeId, pin) {
        const pinValid = await this._checkPin(employeeId, pin);
        if (! pinValid) {
            this.actionRedirect = this.lockEmployee;
            return;
        }
        this.render();
    },

    async startEmployee(employeeId, pin) {
        const pinValid = await this._checkPin(employeeId, pin);
        if (! pinValid) {
            this.popup["WorkingEmployeePopup"].isShown = false;
            this.actionRedirect = this.startEmployee;
            return false;
        }
        this.state.tabletEmployeeIds.push(employeeId);
        await this.orm.call(
            'mrp.workorder',
            'start_employee',
            [this.workorderId, employeeId],
        );
        await this.getState();
        this.render();
        this.popup["SelectionPopup"].isShown = false;
        return true;
    },

    async stopEmployee(employeeId, pin) {
        const index = this.state.tabletEmployeeIds.indexOf(employeeId);
        this.state.tabletEmployeeIds.slice(index, 1);
        await this.orm.call(
            'mrp.workorder',
            'stop_employee',
            [this.workorderId, employeeId],
        );
        await this.getState();
        this.render();
        this.popup["SelectionPopup"].isShown = false;
        return true;
    },

    redirectToAction(employeeId, pin) {
        let returnValue = this.actionRedirect(employeeId, pin);
        this.actionRedirect = false;
        return returnValue;
    },

    get isBlocked() {
        let isBlocked = this._super();
        if (this.employees_connected.length !== 0) {
            isBlocked = false;
        }
        return isBlocked;
    },

    // Private

    async _checkPin(employeeId, pin, logout=false, sessionSave = true) {
        let method = logout ? 'logout' : 'login';
        const pinValid = await this.orm.call('hr.employee', method, [employeeId, pin, sessionSave]);
        if (!pinValid) {
            this.popupEmployeePin(employeeId);
            return;
        }
        return true;
    },

    async _onBarcodeScanned(barcode) {
        const employee = await this.orm.call("mrp.workcenter", "get_employee_barcode", [this.workcenterId, barcode])
        if (employee) {
            this.startEmployee(employee);
        } else {
            return this._super(barcode);
        }
    },

    async _onWillStart() {
        const superMethod = this._super;
        this.employees_connected.logged = await this.orm.call("hr.employee", "get_employees_connected",[null])
        if (this.employees_connected.logged) {
            await this.employees_connected.logged.forEach(async (emp)=>{
                if(emp && emp.id) await this.startEmployee(emp.id);
            })
        }
        await superMethod();
        if (this.employees_connected.logged) {
            await this.getState();
        }
    },
});

Tablet.components.SelectionPopup = SelectionPopup;
Tablet.components.PinPopup = PinPopup;
Tablet.components.WorkingEmployeePopup = WorkingEmployeePopup;
