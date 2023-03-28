/** @odoo-module **/
import { useService } from "@web/core/utils/hooks";
import { browser } from "@web/core/browser/browser";
import { useEnv } from "@odoo/owl";
import { SelectionPopup } from "@mrp_workorder/components/popup";
import { WorkingEmployeePopupWOList } from "@mrp_workorder/components/working_employee_popup_wo_list";
import { PinPopup } from "@mrp_workorder/components/pin_popup";
import { DialogWrapper } from "@mrp_workorder/components/dialog_wrapper";

const { useState } = owl;

export function useConnectedEmployee(model, controllerType, context, workcenterId, domain = { workcenterEmployeeDomain: [] }) {
    const orm = useService("orm");
    const notification = useService("notification");
    const dialog = useService("dialog");
    const imageBaseURL = `${browser.location.origin}/web/image?model=hr.employee&field=avatar_128&id=`;
    const env = useEnv();
    let employees = useState({
        connected: [],
        all: [],
        admin: {}
    });
    let popup = useState({
        PinPopup: {
            isShown: false,
        },
        SelectionPopup: {
            isShown: false,
        },
        WorkingEmployeePopupWOList: {
            isShown: false,
        }
    });

    function openDialog(id, component, props) {
        popup[id] = {
            isShown: true,
            close: dialog.add(
                DialogWrapper,
                {
                    Component: component,
                    componentProps: props,
                },
                {
                    onClose: () => {
                        popup[id] = { isShown: false };
                    }
                }
            )
        };
    }

    async function openEmployeeSelection() {
        const connectedEmployees = await orm.call(
            "hr.employee",
            "get_employees_wo_by_employees",
            [null, employees.connected.map((emp) => emp.id)],
        );
        openDialog("WorkingEmployeePopupWOList", WorkingEmployeePopupWOList, {
            popupData: { employees: connectedEmployees },
            onClosePopup: closePopup.bind(this),
            onAddEmployee: popupAddEmployee.bind(this),
            onStopEmployee: stopEmployee.bind(this),
            onStartEmployee: startEmployee.bind(this),
            becomeAdmin: setSessionOwner.bind(this)
        });
    }

    async function startEmployee(employeeId, workorderId) {
        await orm.call(
            'mrp.workorder',
            'start_employee',
            [workorderId, employeeId],
        );
        await reload();
    }

    async function stopEmployee(employeeId, workorderId) {
        await orm.call(
            'mrp.workorder',
            'stop_employee',
            [workorderId, [employeeId]],
        );
        await reload();
    }

    async function reload() {
        const models = controllerType == 'mrp_display' ? model : [model]
        for (let currentModel of models){
            await currentModel.root.load();
            currentModel.notify();
        }
    }

    async function getAllEmployees() {
        const fieldsToRead = ["id", "name"];
        employees.all = await orm.searchRead(
            "hr.employee",
            domain.workcenterEmployeeDomain,
            fieldsToRead,
        );
    }

    async function selectEmployee(employeeId, pin) {
        const employee = employees.all.find(e => e.id === employeeId);
        const employee_connected = employees.connected.find(e => e.name && e.id === employee.id);
        const employee_function = employee_connected ? "logout" : "login";
        const pinValid = await orm.call(
            "hr.employee", employee_function, [employeeId, pin],
        );
        if (!pinValid && popup.PinPopup.isShown) {
            return notification.add(env._t('Wrong password!'), { type: 'danger' });
        }
        if (!pinValid) {
            return askPin(employee);
        }

        if (employee_function === 'login') {
            notification.add(env._t('Logged in!'), { type: 'success' });
            await getConnectedEmployees();
            if (controllerType === "kanban" && context.openRecord) {
                await openRecord(...context.openRecord);
            }
        } else {
            await stopAllWorkorderFromEmployee(employeeId);
            notification.add(env._t('Logged out!'), { type: 'success' });
        }
        closePopup('SelectionPopup');
        await getConnectedEmployees();
        await reload();
    }

    async function getConnectedEmployees(login=false) {
        const res = await orm.call("hr.employee", "get_all_employees", [null, login]);
        if (login){
            this.employees.all = res.all
        }
        res.connected.sort(function (emp1, emp2) {
            if (emp1.workorder.length == 0) return 1;
            if (emp2.workorder.length == 0) return -1;
            return 0;
        });
        employees.connected = res.connected.map((obj) => {
            const emp = employees.all.find(e => e.id === obj.id);
            return { ...obj, name: emp.name };
        })
        const admin = employees.all.find(e => e.id === res.admin);
        if (admin) {
            employees.admin = {
                name: admin.name,
                id: admin.id,
                path: imageBaseURL + `${admin.id}`,
            }
        } else {
            employees.admin = {};
        }
    }

    async function logout(employeeId) {
        const success = await orm.call(
            "hr.employee", "logout", [employeeId, false, true],
        );
        if (success) {
            notification.add(env._t('Logged out!'), { type: 'success' });
            await Promise.all([stopAllWorkorderFromEmployee(employeeId), getConnectedEmployees()]);
            await reload();
        } else {
            notification.add(env._t('Error during log out!'), { type: 'danger' });
        }
    }

    function askPin(employee) {
        openDialog("PinPopup", PinPopup, {
            popupData: { employee },
            onClosePopup: closePopup.bind(this),
            onPinValidate: checkPin.bind(this),
        });
    }

    async function setSessionOwner(employee_id, pin) {
        if (employees.admin.id == employee_id && employee_id == employees.connected[0].id) {
            return;
        }
        let pinValid = await orm.call(
            "hr.employee", "login", [employee_id, pin],
        );

        if (!pinValid) {
            if (pin) {
                notification.add(env._t("Wrong password!"), { type: "danger" });
            }
            if (popup.PinPopup.isShown) {
                return;
            }
            askPin({ id: employee_id });
        }
        await getConnectedEmployees();
    }

    async function stopAllWorkorderFromEmployee(employeeId) {
        await orm.call('hr.employee',
            'stop_all_workorder_from_employee',
            [employeeId]);
    }

    function popupAddEmployee() {
        const list = employees.all.map(employee => Object.create({
            id: employee.id,
            item: employee,
            label: employee.name,
            isSelected: employees.connected.find(e => e.id === employee.id) != undefined ? true : false
        }));
        openDialog("SelectionPopup", SelectionPopup, {
            popupData: { title: env._t("Select Employee"), list: list },
            onClosePopup: closePopup.bind(this),
            onSelectEmployee: selectEmployee.bind(this),
        });
    }

    async function pinValidation(employeeId, pin) {
        return await orm.call('hr.employee',
            'pin_validation',
            [employeeId, pin]);
    }

    async function checkPin(employeeId, pin) {
        if (employees.connected.find(e => e.id === employeeId) && employees.admin?.id != employeeId) {
            setSessionOwner(employeeId, pin);
        } else {
            selectEmployee(employeeId, pin);
        }
        const pinValid = await pinValidation(employeeId, pin);
        return pinValid;
    }

    function closePopup(popupId) {
        const { isShown, close } = popup[popupId];
        if (isShown) {
            close();
        }
    }

    async function onBarcodeScanned(barcode) {
        const employee = await orm.call("mrp.workcenter", "get_employee_barcode", [workcenterId, barcode]);
        if (employee) {
            selectEmployee(employee);
        } else {
            notification.add(env._t('This employee is not allowed on this workcenter'), { type: 'danger' });
        }
    }

    async function openRecord(record, mode) {
        const id = await orm.call("hr.employee", "get_session_owner", [null]);
        if (id.length == 0) {
            context.openRecord = [record, mode];
            openEmployeeSelection();
            return;
        }
        delete context.openRecord;
        Object.assign(context, { employees: id });
    }

    return {
        openEmployeeSelection,
        startEmployee,
        stopEmployee,
        reload,
        getAllEmployees,
        getConnectedEmployees,
        logout,
        askPin,
        setSessionOwner,
        stopAllWorkorderFromEmployee,
        popupAddEmployee,
        checkPin,
        closePopup,
        pinValidation,
        selectEmployee,
        onBarcodeScanned,
        openRecord,
        employees,
        popup
    }
}