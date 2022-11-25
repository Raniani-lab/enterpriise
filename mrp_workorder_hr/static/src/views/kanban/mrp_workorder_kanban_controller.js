/** @odoo-module */

import { SelectionPopup } from '@mrp_workorder_hr/components/popup';
import { PinPopup } from '@mrp_workorder_hr/components/pin_popup';
import { useBus, useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import {MrpWorkorderKanbanController} from '@mrp_workorder/views/kanban/mrp_workorder_kanban_controller';
import { AvatarList } from "@mrp_workorder_hr/components/avatar_list";

const {onWillStart, useState, onMounted} = owl;

MrpWorkorderKanbanController.components = {
    ...MrpWorkorderKanbanController.components,
    SelectionPopup,
    PinPopup,
    AvatarList
}

patch(MrpWorkorderKanbanController.prototype, 'mrp_workorder_hr', {
    setup() {
        this._super();
        this.popup = useState({
            PinPopup: {
                isShown: false,
                data: {},
            },
            SelectionPopup: {
                isShown: false,
                data: {},
            }
        });
        this.notification = useService('notification');
        this.barcode = useService("barcode");
        useBus(this.barcode.bus, 'barcode_scanned', (event) => this._onBarcodeScanned(event.detail.barcode));
        this.workcenterId = this.props.context.default_workcenter_id;
        this.workcenter = false;
        this.employees_connected = useState({logged:[]});
        onWillStart(async () => {
            await this.onWillStart();
        });
        onMounted(() => {
             this.onMount();
        });
    },

    async onWillStart() {
        if (!this.workcenterId) return;

        const workcenter = await this.orm.read(
            "mrp.workcenter", [this.workcenterId], ['allow_employee', 'employee_ids']
        );
        this.workcenter = workcenter[0];
        if (!this.workcenter.allow_employee) {
            return;
        }
        const fieldsToRead = ['id', 'name'];
        const employees_domain = [];
        if (this.workcenter.employee_ids.length) {
            employees_domain.push(['id', 'in', this.workcenter.employee_ids]);
        }
        this.employees = await this.orm.searchRead(
             "hr.employee", employees_domain, fieldsToRead,
        );
        const ids = await this.orm.call("hr.employee", "get_employees_connected",[null])

        ids.forEach((id)=>{
            let emp = this.employees.find(e => e.id === id);
            if(emp)this.employees_connected.logged.push({name:emp.name, id:emp.id});
        })
    },

    onMount() {
        if (this.employeeId) {
            this.selectEmployee(this.employeeId);
        }
    },

    // destroy: function () {
    //     core.bus.off('barcode_scanned', this, this._onBarcodeScanned);
    //     this._super();
    // },

    openEmployeeSelection() {
        const employeeList = this.employees.map(employee => Object.create({
            id: employee.id,
            item: employee,
            label: employee.name,
            isSelected: this.employees_connected.logged.find(e=>e.id===employee)?true:false
        }));
        this.popup.SelectionPopup = {
            data: { title: this.env._t('Select Employee'), list: employeeList },
            isShown: true,
        };
    },

    async selectEmployee(employeeId, pin) {
        const employee = this.employees.find(e => e.id === employeeId);
        const employee_connected = this.employees_connected.logged.find(e=> e.name && e.id===employee.id)
        const employee_function = employee_connected ? "logout" : "login";
        const pinValid = await this.orm.call(
            "hr.employee", employee_function, [employeeId, pin],
        );
        if (!pinValid && this.popup.PinPopup.isShown) {
            this.notification.add(this.env._t('Wrong password !'), {type: 'danger'});
            return;
        }
        if (!pinValid) {
            this._askPin(employee);
            return;
        }

        if (employee_function === 'login') {
            this.notification.add(this.env._t('Logged in!'), {type: 'success'});
            if (!this.employees_connected.logged.find(e => e.id === employee.id))
                this.employees_connected.logged.push({name: employee.name, id: employee.id})
            if (this.context.openRecord) {
                await this.openRecord(...this.context.openRecord);
            }
        } else {
            //remove the employee from the list
            this.notification.add(this.env._t('Logged out!'), {type: 'success'});
            this.employees_connected.logged = this.employees_connected.logged.filter(function(value,index,arr){
                return value.id != employee.id
            })
        }
        this.closePopup('SelectionPopup')
        //refresh the page when logged to update
        await this.model.root.load();
        this.model.notify();
    },

    closePopup(popupName) {
        this.popup[popupName].isShown = false;
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
            this.notification.add(this.env._t('This employee is not allowed on this workcenter'), {type: 'danger'});
        }
    },

    async openRecord(record, mode) {
        const superOpenRecord = this._super
        const id = await this.orm.call("hr.employee", "get_session_owner",[null]);
        if (id.length==0) {
            this.context.openRecord = [record, mode];
            this.openEmployeeSelection();
            return;
        }
        delete this.context.openRecord;
        Object.assign(this.context, {employees_connected: id});

        // TODO : Cleanup that mess
        // Why is the this._super undefined after the asynchronous function?

        superOpenRecord(...arguments);
    },
});