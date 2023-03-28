/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useBus, useService } from "@web/core/utils/hooks";
import { View } from "@web/views/view";
import DocumentViewer from '@mrp_workorder/components/viewer';
import StepComponent from '@mrp_workorder/components/step';
import ViewsWidgetAdapter from '@mrp_workorder/components/views_widget_adapter';
import MenuPopup from '@mrp_workorder/components/menuPopup';
import SummaryStep from '@mrp_workorder/components/summary_step';
import { SelectionPopup } from '@mrp_workorder/components/popup';
import { WorkingEmployeePopup } from '@mrp_workorder/components/working_employee_popup';
import { PinPopup } from '@mrp_workorder/components/pin_popup';

const { EventBus, useState, useEffect, onWillStart, Component, markup, onMounted } = owl;

/**
 * Main Component
 * Gather the workorder and its quality check information.
 */

class Tablet extends Component {
    //--------------------------------------------------------------------------
    // Lifecycle
    //--------------------------------------------------------------------------
    setup() {
        this.rpc = useService('rpc');
        this.orm = useService('orm');
        this.notification = useService('notification');
        this.state = useState({
            selectedStepId: 0,
            workingState: "",
            tabletEmployeeIds: []
        });

        this.popup = useState({
            menu: {
                isShown: false,
                data: {},
            },
            SelectionPopup: {
                isShown: false,
                data: {},
            },
            PinPopup: {
                isShown: false,
                data: {},
            },
            WorkingEmployeePopup: {
                isShown: false,
                data: {},
            },
        });
        this.workorderId = this.props.action.context.active_id;
        this.additionalContext = this.props.action.context;
        this.workorderBus = new EventBus();
        useBus(this.workorderBus, "refresh", async () => {
            await this.getState();
            this.render();
        });
        useBus(this.workorderBus, "workorder_event", (ev) => {
            this[ev.detail]();
        });
        this.barcode = useService('barcode');
        useBus(this.barcode.bus, 'barcode_scanned', (event) => this._onBarcodeScanned(event.detail.barcode));
        onWillStart(async () => {
            await this._onWillStart();
        });

        useEffect(() => {
            this._scrollToHighlighted();
        });

        this.employees_connected = useState({ logged: [] });
        useBus(this.workorderBus, "popupEmployeeManagement", this.popupEmployeeManagement);
        onMounted(() => this.checkEmployeeLogged());
    }

    checkEmployeeLogged() {
        if (this.data.employee_list.length && !this.data.employee_id) {
            this.popupAddEmployee();
        } else {
            this.state.tabletEmployeeIds.push(this.data.employee_id);
        }
    }

    _scrollToHighlighted() {
        let selectedLine = document.querySelector('.o_tablet_timeline .o_tablet_step.o_selected');
        if (selectedLine) {
            // If a line is selected, checks if this line is entirely visible
            // and if it's not, scrolls until the line is.
            const headerHeight = document.querySelector('.o_form_view').offsetHeight.height;
            const lineRect = selectedLine.getBoundingClientRect();
            const page = document.querySelector('.o_tablet_timeline');
            // Computes the real header's height (the navbar is present if the page was refreshed).
            let scrollCoordY = false;
            if (lineRect.top < headerHeight) {
                scrollCoordY = lineRect.top - headerHeight + page.scrollTop;
            } else if (lineRect.bottom > window.innerHeight) {
                const pageRect = page.getBoundingClientRect();
                scrollCoordY = page.scrollTop - (pageRect.bottom - lineRect.bottom);
            }
            if (scrollCoordY !== false) { // Scrolls to the line only if it's not entirely visible.
                page.scroll({ left: 0, top: scrollCoordY, behavior: this._scrollBehavior });
                this._scrollBehavior = 'smooth';
            }
        }
    }

    async getState() {
        this.data = await this.orm.call(
            'mrp.workorder',
            'get_workorder_data',
            [this.workorderId],
        );
        this.viewsId = this.data['views'];
        this.steps = this.data['quality.check'];
        this.state.workingState = this.data.working_state;
        if (this.steps.length && this.steps.every(step => step.quality_state !== 'none') && !this.data['mrp.workorder'].current_quality_check_id) {
            this.createSummaryStep();
        } else {
            this.state.selectedStepId = this.data['mrp.workorder'].current_quality_check_id;
        }
    }

    createSummaryStep() {
        this.steps.push({
            id: 0,
            title: 'Summary',
            test_type: '',
        });
        this.state.selectedStepId = 0;
    }

    async selectStep(id) {
        await this.saveCurrentStep(id);
    }

    async saveCurrentStep(newId) {
        await new Promise((resolve) =>
            this.workorderBus.trigger("force_save_workorder", { resolve })
        );
        if (this.state.selectedStepId) {
            await new Promise((resolve) =>
                this.workorderBus.trigger("force_save_check", { resolve })
            );
        }
        await this.orm.write("mrp.workorder", [this.workorderId], {
            current_quality_check_id: newId,
        });
        this.state.selectedStepId = newId;
    }

    get worksheetData() {
        if (this.selectedStep) {
            if (this.selectedStep.source_document !== "operation" && this.selectedStep.worksheet_document) {
                return {
                    resModel: 'quality.check',
                    resId: this.state.selectedStepId,
                    resField: 'worksheet_document',
                    value: this.selectedStep.worksheet_document,
                    page: 1,
                };
            } else if (this.selectedStep.source_document === "step" && this.selectedStep.worksheet_url) {
                return {
                    resModel: "quality.point",
                    resId: this.selectedStep.point_id,
                    resField: "worksheet_url",
                    value: this.selectedStep.worksheet_url,
                    page: 1,
                };
            } else if (this.selectedStep.source_document !== "step" && this.data.operation !== undefined) {
                if (this.data.operation.worksheet) {
                    return {
                        resModel: "mrp.routing.workcenter",
                        resId: this.data.operation.id,
                        resField: "worksheet",
                        value: this.data.operation.worksheet,
                        page: this.selectedStep.worksheet_page,
                    };
                } else if (this.data.operation.worksheet_google_slide) {
                    return {
                        resModel: "mrp.routing.workcenter",
                        resId: this.data.operation.id,
                        resField: "worksheet_google_slide",
                        value: this.data.operation.worksheet_google_slide,
                        page: this.selectedStep.worksheet_page,
                    };
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else if (this.data.operation.worksheet) {
            return {
                resModel: 'mrp.routing.workcenter',
                resId: this.data.operation.id,
                resField: 'worksheet',
                value: this.data.operation.worksheet,
                page: 1,
            };
        } else if (this.data.operation.worksheet_google_slide) {
            return {
                resModel: "mrp.routing.workcenter",
                resId: this.data.operation.id,
                resField: "worksheet_google_slide",
                value: this.data.operation.worksheet_google_slide,
                page: 1,
            };
        } else {
            return false;
        }
    }

    get selectedStep() {
        return this.state.selectedStepId && this.steps.find(
            l => l.id === this.state.selectedStepId
        );
    }

    get views() {
        const workorder = {
            type: 'workorder_form',
            mode: 'edit',
            resModel: 'mrp.workorder',
            viewId: this.viewsId.workorder,
            resId: this.workorderId,
            display: { controlPanel: false },
            workorderBus: this.workorderBus,
            context: this.props.action.context,
        };
        if (this.state.selectedStepId) {
            workorder.onRecordChanged = async (rootRecord) => {
                await rootRecord.save();
                this.render(true);
            }
        }
        const check = {
            type: 'workorder_form',
            mode: 'edit',
            resModel: 'quality.check',
            viewId: this.viewsId.check,
            resId: this.state.selectedStepId,
            display: { controlPanel: false },
            workorderBus: this.workorderBus,
        };
        check.onRecordChanged = async (rootRecord) => {
            await rootRecord.save();
            this.render(true);
        }
        return { workorder, check };
    }

    get checkInstruction() {
        let note = this.data['mrp.workorder'].operation_note;
        if (note && note !== '<p><br></p>') {
            return markup(note);
        } else {
            return undefined;
        }
    }

    get isBlocked() {
        if (this.data.employee_list.length && (this.data.employee_ids.length === 0 || !this.data.employee_id)) {
            return true;
        }
        return this.state.workingState === 'blocked';
    }

    showPopup(props, popupId) {
        this.popup[popupId].isShown = true;
        this.popup[popupId].data = props;
    }

    async closePopup(popupId) {
        await this.getState();
        this.popup[popupId].isShown = false;
        this.render();
    }

    async onCloseRerender() {
        await this.getState();
        this.render();
    }

    openMenuPopup() {
        this.showPopup({
            title: 'Menu',
            workcenterId: this.data['mrp.workorder'].workcenter_id,
            selectedStepId: this.state.selectedStepId,
            workorderId: this.workorderId,
            has_bom: this.data['has_bom'],
        }, 'menu');
    }

    async _onWillStart() {
        this.employees_connected.logged = await this.orm.call("hr.employee", "get_employees_connected", [null]);
        for (const emp of this.employees_connected.logged) {
            if (emp.id) {
                await this.startEmployee(emp.id);
            }
        }
        await this.getState();
    }

    async _onBarcodeScanned(barcode) {
        const employee = await this.orm.call("mrp.workcenter", "get_employee_barcode", [this.workcenterId, barcode]);
        if (employee) {
            this.connectEmployee(employee);
        }
        if (barcode.startsWith('O-BTN.') || barcode.startsWith('O-CMD.')) {
            // Do nothing. It's already handled by the barcode service.
            return;
        }
    }

    popupEmployeeManagement() {
        this.showPopup({ workorderId: this.workorderId }, "WorkingEmployeePopup");
    }

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
        const title = this.env._t("Change Worker");
        this.showPopup({ title, list }, "SelectionPopup");
    }

    popupEmployeePin(employeeId) {
        const employee = this.data.employee_list.find(e => e.id === employeeId);
        this.showPopup({ employee }, "PinPopup");
    }

    async startEmployee(employeeId) {
        this.state.tabletEmployeeIds.push(employeeId);
        await this.orm.call(
            "mrp.workorder",
            "start_employee",
            [this.workorderId, employeeId],
        );
        await this.getState();
        this.render();
        this.popup.SelectionPopup.isShown = false;
        return true;
    }

    async stopEmployee(employeeId) {
        const index = this.state.tabletEmployeeIds.indexOf(employeeId);
        this.state.tabletEmployeeIds.splice(index, 1);
        await this.orm.call(
            "mrp.workorder",
            "stop_employee",
            [this.workorderId, [employeeId]],
        );
        await this.getState();
        this.popup.SelectionPopup.isShown = false;
        this.render();
        return true;
    }

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
                this.notification.add(this.env._t("Wrong password!"), { type: "danger" });
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
    }

    // Private

    async _pinValidation(employeeId, pin = "") {
        return await this.orm.call(
            "hr.employee",
            "pin_validation",
            [employeeId, pin]
        );
    }

    async _setSessionOwner(employeeId, pin) {
        if (this.data.employee_id != employeeId) {
            await this.orm.call(
                "hr.employee",
                "login",
                [employeeId, pin],
            );
            await this.getState();
        }
    }
}

Tablet.props = ['action', '*'];
Tablet.template = 'mrp_workorder.Tablet';
Tablet.components = {
    StepComponent,
    DocumentViewer,
    ViewsWidgetAdapter,
    MenuPopup,
    PinPopup,
    SelectionPopup,
    SummaryStep,
    View,
    WorkingEmployeePopup,
};

registry.category('actions').add('tablet_client_action', Tablet);

export default Tablet;
