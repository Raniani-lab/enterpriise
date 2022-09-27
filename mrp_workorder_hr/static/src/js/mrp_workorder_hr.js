odoo.define('mrp_workorder_hr.control_panel', function (require) {
"use strict";

const { TabletKanbanController } = require('mrp_workorder.update_kanban');
const { SelectionPopup } = require('@mrp_workorder_hr/components/popup');
const { ComponentWrapper } = require('web.OwlCompatibility');
const { PinPopup } = require('@mrp_workorder_hr/components/pin_popup');

const core = require('web.core');
const qweb = core.qweb;
const _t = core._t;

TabletKanbanController.include({

    init: function (parent, model, renderer, params) {
        this._super(...arguments);
        this.workcenterId = this.initialState.context.default_workcenter_id;
        this.workcenter = false;
        this.employeeId = this.initialState.context.employee_id;
        this.popup = {};
        this.context = {};
    },

    willStart: async function () {
        await this._super(...arguments);
        if (!this.workcenterId) {
            return;
        }
        const workcenter = await this._rpc({
            model: 'mrp.workcenter',
            method: "read",
            args: [[this.workcenterId], ['allow_employee', 'employee_ids']],
        });
        this.workcenter = workcenter[0];
        if (!this.workcenter.allow_employee) {
            return;
        }
        const fieldsToRead = ['id', 'name', 'barcode'];
        const employees_domain = [];
        if (this.workcenter.employee_ids.length) {
            employees_domain.push(['id', 'in', this.workcenter.employee_ids]);
        }
        this.employees = await this._rpc({
            model: 'hr.employee',
            method: "search_read",
            args: [employees_domain, fieldsToRead],
        });
    },

    start: function () {
        this._super(...arguments);
        if (this.employeeId) {
            this.selectEmployee(this.employeeId);
        }
        this.el.classList.add('o_tablet_popups');
        core.bus.on('barcode_scanned', this, this._onBarcodeScanned);
    },

    destroy: function () {
        core.bus.off('barcode_scanned', this, this._onBarcodeScanned);
        this._super();
    },

    async selectEmployee(employeeId, pin) {
        const employee = this.employees.find(e => e.id === employeeId);
        const employee_function = this.employee && this.employee.id === employeeId ? 'logout' : 'login';
        const pinValid = await this._rpc({
            model: 'hr.employee',
            method: employee_function,
            args: [employeeId, pin],
        });
        if (!pinValid && this.popup.PinPopup) {
            this.displayNotification({
                type: 'danger',
                message: _t('Wrong password !'),
            });
            return;
        }
        if (!pinValid) {
            this._askPin(employee);
            return;
        }

        if (employee_function === 'login') {
            this.displayNotification({
                type: 'success',
                message: _t('Logged in!'),
            });
            this.employee = employee;
            this.$buttons.find('.o_employee_name').text(this.employee.name);
            if (this.context.openRecord) {
                this._onOpenRecord(this.context.openRecord);
            }
        } else {
            this.employee = false;
            this.$buttons.find('.o_employee_name').empty();
        }
    },

    closePopup(popupName, cancel) {
        this.popup[popupName].unmount();
        this.popup[popupName].destroy();
        this.popup[popupName] = false;
        if (cancel) {
            this.context.openRecord = false;
        }
    },

    renderButtons: function ($node) {
        this._super(...arguments);
        if (!this.workcenter || !this.workcenter.allow_employee) {
            return;
        }
        const $hr_layout = $(qweb.render(('mrp_workorder_hr.overviewButtons'), { widget: this }));
        $hr_layout.filter('.o_lock_employee').on('click', () => {
            this._selectEmployee();
        });
        if (this.$buttons) {
            $hr_layout.appendTo(this.$buttons);
        }
    },

    _askPin: function (employee) {
        this.popup.PinPopup = new ComponentWrapper(this, PinPopup, {
            popupData: {employee: employee },
            onClosePopup: this.closePopup.bind(this),
            onPinValidate: this.selectEmployee.bind(this),
        });
        this.popup.PinPopup.mount(this.el);
    },

    _onBarcodeScanned: function (barcode) {
        if (!this.employees) {
            return;
        }
        const employee = this.employees.find(e => e.barcode == barcode);
        if (employee) {
            this.selectEmployee(employee.id);
        } else {
            this.displayNotification({
                type: 'danger',
                message: _t('This employee is not allowed on this workcenter'),
            });
        }
    },

    _onOpenRecord: function (ev) {
        if (this.employees && ! this.employee) {
            ev.stopPropagation();
            this.context.openRecord = ev;
            this._selectEmployee();
            return;
        }
        if (this.employee) {
            ev.data.context = { 'employee_id': this.employee.id };
        }
        this.context.openRecord = false;
        this._super.apply(this, arguments);
    },

    _selectEmployee: function () {
        const employeeList = this.employees.map(employee => Object.create({
            id: employee.id,
            item: employee,
            label: employee.name,
            isSelected: employee === this.employee,
        }));
        this.popup.SelectionPopup = new ComponentWrapper(this, SelectionPopup, {
            popupData: { title: _t('Select Employee'), list: employeeList },
            onClosePopup: this.closePopup.bind(this),
            onSelectEmployee: this.selectEmployee.bind(this),
        });
        this.popup.SelectionPopup.mount(this.el);
    },
});
});
