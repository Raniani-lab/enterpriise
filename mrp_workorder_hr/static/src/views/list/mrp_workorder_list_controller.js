/** @odoo-module */

import { SelectionPopup } from "@mrp_workorder_hr/components/popup";
import { WorkingEmployeePopupWOList } from "@mrp_workorder_hr/components/working_employee_popup_wo_list";
import { PinPopup } from "@mrp_workorder_hr/components/pin_popup";
import core from "web.core";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import {MrpWorkorderListController} from "@mrp_workorder/views/list/mrp_workorder_list_controller";
import { AvatarList } from "@mrp_workorder_hr/components/avatar_list";
import { browser } from "@web/core/browser/browser";

const {onWillStart, useState, onMounted} = owl;

MrpWorkorderListController.components.SelectionPopup = SelectionPopup;
MrpWorkorderListController.components.WorkingEmployeePopupWOList = WorkingEmployeePopupWOList;
MrpWorkorderListController.components.PinPopup = PinPopup;
MrpWorkorderListController.components.AvatarList = AvatarList;

patch(MrpWorkorderListController.prototype, "mrp_workorder_hr", {
    setup() {
        this._super();

        this.employees_connected = useState({
            logged: []
        });
        this.employees = useState([]);
        this.popup = useState({
            PinPopup: {
                isShown: false,
                data: {},
            },
            SelectionPopup: {
                isShown: false,
                data: {},
            },
            WorkingEmployeePopupWOList: {
                isShown: false,
                data: {},
            }
        });

        this.notification = useService("notification");
        this.orm = useService("orm");

        //TODO: This is used because att-f load images to slowly : weird?
        const { origin }  = browser.location;
        this.imageBaseURL = `${ origin }/web/image?model=hr.employee&field=avatar_128&id=`;
        onWillStart(async () => {
            await this.onWillStart();
        });
        onMounted(() => {
            core.bus.on("barcode_scanned", this, this._onBarcodeScanned);
        });
    },

    async onWillStart() {
        const fieldsToRead = ["id", "name"];
        this.employees = await this.orm.searchRead(
             "hr.employee", [], fieldsToRead,
        );
        await this.getConnectedEmployees()
    },

    async openEmployeeSelection() {
        const connectedEmployees = await this.orm.call(
            "hr.employee",
            "get_employees_wo_by_employees",
            [null, this.employees_connected.logged],
        );
        this.popup.WorkingEmployeePopupWOList = {
            data: { employeesConnected: connectedEmployees },
            isShown: true,
        };
    },

    async selectEmployee(employeeId, pin) {
        const employee = this.employees.find(e => e.id === employeeId);
        const is_employee_connected = this.employees_connected.logged.find(e => e.id === employee.id)
        const employee_function = is_employee_connected ? "logout" : "login";

        const pinValid = await this.orm.call(
            "hr.employee", employee_function, [employeeId, pin],
        );

        if (!pinValid && this.popup.PinPopup.isShown) {
            return this.notification.add(this.env._t("Wrong password !"), {type: "danger"});
        }
        if (!pinValid) {
            return this._askPin(employee);
        }

        if (employee_function === 'login') {
            this.notification.add(this.env._t('Logged in!'), {type: 'success'});
            await this.getConnectedEmployees(this.employees)
        } 
        else {
            await this.stopAllWorkorderFromEmployee(employeeId)
            this.notification.add(this.env._t('Logged out!'), {type: 'success'});  
        }
        this.closePopup('SelectionPopup')
        await this.getConnectedEmployees();
        await this._reload();
        return true;
    },

    async _reload() {
        await this.model.root.load();
        this.model.notify();
    },

    _askPin(employee) {
        this.popup.PinPopup = {
            data: {employee: employee},
            isShown: true,
        };
    },

    async _onBarcodeScanned(barcode) {
        const employee = await this.orm.call("mrp.workcenter", "get_employee_barcode", [this.workcenterId, barcode])
        if (employee) {
            this.selectEmployee(employee);
        } else {
            this.notification.add(this.env._t("This employee is not allowed on this workcenter"), {type: "danger"});
        }
    },

    async _validatePin(employeeId, pin) {
        return await this.orm.call(
            "hr.employee", "pin_validation", [employeeId, pin],
        );
    },

    async openRecord(record, mode) {
        if (this.employees && !this.employees_connected.logged) {
            this.context.openRecord = [record, mode];
            return this.openEmployeeSelection();
        }
        delete this.context.openRecord;
        Object.assign(this.context, {employees_connected: this.employees_connected.logged});
        this._super(...arguments);
    },

    async getWorkOrders(employees) {
        this.employees = await this.orm.call(
            "hr.employee",
            "get_employees_wo_by_employees",
            [null, employees],
        );
    },

    popupAddEmployee() {
        const list = this.employees.map(employee => Object.create({
            id: employee.id,
            item: employee,
            label: employee.name,
            isSelected: this.employees_connected.logged.find(e => e.id === employee.id)!= undefined ? true : false
        }))
        this.popup.SelectionPopup = {
            data: { title: this.env._t("Select Employee"), list: list},
            isShown: true,
        };
    },

    async stopEmployee(employeeId, workorderId) {
        await this.orm.call(
            'mrp.workorder',
            'stop_employee',
            [workorderId, employeeId],
        );
        await this._reload();
    },

    async stopAllWorkorderFromEmployee(employeeId) { 
        await this.orm.call('hr.employee',
            'stop_all_workorder_from_employee',
            [employeeId]);
    },

    async startEmployee(employeeId, workorderId) {
        await this.orm.call(
            'mrp.workorder',
            'start_employee',
            [workorderId, employeeId],
        );
        await this._reload();
    },

    async setSessionOwner(employee_id, pin) {
        if (this.sessionAdmin.id == employee_id && employee_id == this.employees_connected.logged[0].id) {
            return
        }
        let pinValid = await this.orm.call(
            "hr.employee", "login", [employee_id, pin],
        );
        if (!pinValid && this.popup.PinPopup.isShown) {
            this.notification.add(this.env._t("Wrong password !"), {type: "danger"});
            return;
        }
        if (!pinValid) {
            this._askPin({id: employee_id});
            return;
        }
        await this.getConnectedEmployees()
    },

    closePopup(popupId) {
        this.popup[popupId].isShown = false;
    },

    async getAllEmployees() {
        const fieldsToRead = ["id", "name", "barcode"];
        this.employees = await this.orm.searchRead(
             "hr.employee",
             [],
             fieldsToRead,
        );
    },

    async getConnectedEmployees() {
        const adminIdPromise = this.orm.call("hr.employee", "get_session_owner", [null]);
        const connectedEmployeeIdsPromise = this.orm.call("hr.employee", "get_employees_connected", [null]);
        const promisesResults = await Promise.all([adminIdPromise, connectedEmployeeIdsPromise, this.getAllEmployees()]);
        const adminId = promisesResults[0];
        const connectedEmployeeIds = promisesResults[1];
        let connectedEmployees = [];

        connectedEmployeeIds.forEach((id) => {
            const emp = this.employees.find(e => e.id === id);
            if(emp) connectedEmployees.push({name: emp.name, id: emp.id});
        })
        this.employees_connected.logged = connectedEmployees

        const admin = this.employees.find(e=> e.id === adminId)
        if(admin){this.sessionAdmin = {
                name: admin.name,
                id: admin.id,
                path: this.imageBaseURL + `${admin.id}`
            }
        } 
        else {
            this.sessionAdmin = {};
        }
    },

    async disconnectAdmin() {
        let employeeId = this.sessionAdmin.id;
        var promises = [];

        const success = await this.orm.call(
            "hr.employee", "logout" , [employeeId, false, true],
        );
        if (success) {
            this.notification.add(this.env._t('Logged out!'), {type: 'success'});
            promises.push(this.getConnectedEmployees())
            promises.push(this.stopAllWorkorderFromEmployee(employeeId))
            await Promise.all(promises);
            await this._reload();
        }
        else {
            this.notification.add(this.env._t('Error during log out!'), {type: 'error'});
        }
    },
});
