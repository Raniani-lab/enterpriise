/** @odoo-module */

import { Layout } from "@web/search/layout";
import { useService, useBus } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { useModels } from "@mrp_workorder/mrp_display/model";
import { ControlPanelButtons } from "@mrp_workorder/mrp_display/control_panel";
import { MrpDisplayRecord } from "@mrp_workorder/mrp_display/mrp_display_record";
import { MrpWorkcenterDialog } from "./dialog/mrp_workcenter_dialog";
import { makeActiveField } from "@web/model/relational_model/utils";
import { MrpDisplayEmployeesPanel } from "@mrp_workorder/mrp_display/employees_panel";
import { SelectionPopup } from "@mrp_workorder/components/popup";
import { PinPopup } from "@mrp_workorder/components/pin_popup";
import { useConnectedEmployee } from "@mrp_workorder/views/hooks/employee_hooks";
import { SearchBar } from "@web/search/search_bar/search_bar";
import { getSearchParams, MESRelationalModel } from "./model";

const { Component, onWillDestroy, onWillStart, useState, useSubEnv } = owl;

export class MrpDisplay extends Component {
    static template = "mrp_workorder.MrpDisplay";
    static components = {
        Layout,
        ControlPanelButtons,
        MrpDisplayRecord,
        MrpDisplayEmployeesPanel,
        SelectionPopup,
        PinPopup,
        SearchBar,
    };
    static props = {
        resModel: String,
        action: { type: Object, optional: true },
        comparison: { validate: () => true },
        models: { type: Object },
        domain: { type: Array },
        display: { type: Object, optional: true },
        context: { type: Object, optional: true },
        groupBy: { type: Array, element: String },
        orderBy: { type: Array, element: Object },
    };

    setup() {
        this.homeMenu = useService("home_menu");
        this.viewService = useService("view");
        this.userService = useService("user");
        this.actionService = useService("action");
        this.dialogService = useService("dialog");

        this.display = {
            ...this.props.display,
        };

        this.pickingTypeId = false;
        this.myWorkorders = [];
        this.validationStack = {
            "mrp.production": [],
            "mrp.workorder": [],
        };
        if (
            this.props.context.active_model === "stock.picking.type" &&
            this.props.context.active_id
        ) {
            this.pickingTypeId = this.props.context.active_id;
        }
        useSubEnv({
            localStorageName: `mrp_workorder.db_${this.userService.db.name}.user_${this.userService.userId}.picking_type_${this.pickingTypeId}`,
        });
        if (this.props.context.production_id){
            this._onProductionBarcodeScanned(this.props.context.production_id)
        }

        this.state = useState({
            activeResModel: this.props.context.workcenter_id ? 'mrp.workorder' : this.props.resModel,
            activeWorkcenter: this.props.context.workcenter_id || false,
            workcenters: JSON.parse(localStorage.getItem(this.env.localStorageName)) || [],
        });

        const paramsList = [];
        for (const { resModel, fields } of this.props.models) {
            const activeFields = {};
            for (const fieldName in fields) {
                activeFields[fieldName] = makeActiveField();
            }
            const params = {
                config: { resModel, fields, activeFields },
            };
            paramsList.push(params);
        }
        const models = useModels(MESRelationalModel, paramsList);
        for (const model of models) {
            const resModelName = model.config.resModel.replaceAll(".", "_");
            this[resModelName] = model;
        }

        this.showEmployeesPanel = true;
        this.useEmployee = useConnectedEmployee(
            [this.mrp_production, this.mrp_workorder, this.stock_move],
            "mrp_display",
            this.props.context
        );
        this.barcode = useService("barcode");
        useBus(this.barcode.bus, 'barcode_scanned', (event) => this._onBarcodeScanned(event.detail.barcode));
        this.notification = useService("notification");
        this.orm = useService('orm');

        onWillStart(async () => {
            this.groups = {
                byproducts: await this.userService.hasGroup("mrp.group_mrp_byproducts"),
                uom: await this.userService.hasGroup("uom.group_uom"),
                workorders: await this.userService.hasGroup("mrp.group_mrp_routings"),
            };
            this.group_mrp_routings = await this.userService.hasGroup("mrp.group_mrp_routings");
            if (!this.state.workcenters.length){
                const allWorkcenters = await this.orm.searchRead('mrp.workcenter',[], ['id', 'display_name']);
                localStorage.setItem(this.env.localStorageName, JSON.stringify(allWorkcenters));
                this.state.workcenters = allWorkcenters;
            }
            await this.useEmployee.getConnectedEmployees(true);
        });
        onWillDestroy(async () => {
            await this.processValidationStack(false);
        })
    }

    addToValidationStack(record, validationCallback) {
        const relevantStack = this.validationStack[record.resModel];
        if (relevantStack.find(rec => rec.record.resId === record.resId)) {
            return; // Don't add more than once the same record into the stack.
        }
        relevantStack.push({
            record,
            isValidated: false,
            validationCallback,
        });
    }

    close() {
        this.homeMenu.toggle();
    }

    async _onBarcodeScanned(barcode){
        if (barcode.startsWith('O-BTN.') || barcode.startsWith('O-CMD.')) {
            return;
        }
        const production = this.productions.find(mo => mo.data.name === barcode);
        if (production) {
            return this._onProductionBarcodeScanned(barcode);
        }
        const workorder = this.workorders.find(wo => wo.data.barcode === barcode);
        if (workorder) {
            return this._onWorkorderBarcodeScanned(workorder);
        }
        const employee = await this.orm.call("mrp.workcenter", "get_employee_barcode", [undefined, barcode]);
        if (employee) {
            return this.useEmployee.setSessionOwner(employee, undefined);
        }
    }

    async _onProductionBarcodeScanned(barcode){
        const searchItem = Object.values(this.env.searchModel.searchItems).find((i) => i.fieldName === "name");
        const autocompleteValue = {
            label: barcode,
            operator: "=",
            value: barcode,
        }
        this.env.searchModel.addAutoCompletionValues(searchItem.id, autocompleteValue);
    }

    async _onWorkorderBarcodeScanned(workorder){
        const { resModel, resId } = workorder;
        await this.useEmployee.getConnectedEmployees();
        const admin_id = this.useEmployee.employees.admin.id;
        if (admin_id && !workorder.data.employee_ids.records.some(emp => emp.resId == admin_id)) {
            await this.orm.call(resModel, "button_start", [resId]);
            this.notification.add(_t('STARTED work on workorder ' + workorder.data.display_name), { type: 'success' })
        } else {
            await this.orm.call(resModel, "stop_employee", [resId, [admin_id]]);
            this.notification.add(_t('STOPPED work on workorder ' + workorder.data.display_name), { type: 'warning' })
        }
        await workorder.load();
        await this.recordUpdated(resId);
        this.render();
        await this.useEmployee.getConnectedEmployees();
    }

    async recordUpdated(wo_id){
        const MO = this.productions.find(mo => mo.data.workorder_ids.records.some(wo => wo.resId === wo_id));
        if (MO) await MO.load();
    }

    get productions() {
        const productions = this.mrp_production.root.records;
        const statesComparativeValues = {
            progress: 0,
            to_close: 1,
            confirmed: 2,
        }
        productions.sort((p1, p2) => {
            const v1 = statesComparativeValues[p1.data.state];
            const v2 = statesComparativeValues[p2.data.state];
            const d1 = p1.data.date_start;
            const d2 = p2.data.date_start;
            return v1 - v2 || d1 - d2;
        });
        return productions;
    }

    get workorders() {
        const workorders = this.mrp_workorder.root.records.filter((wo)=> wo.data.state !== 'done');
        const statesComparativeValues = {
            // Smallest value = first. Biggest value = last.
            progress: 0,
            ready: 1,
            pending: 2,
            waiting: 3,
        };
        workorders.sort((wo1, wo2) => {
            const v1 = statesComparativeValues[wo1.data.state];
            const v2 = statesComparativeValues[wo2.data.state];
            const d1 = wo1.data.date_start;
            const d2 = wo2.data.date_start;
            return v1 - v2 || d1 - d2;
        });
        return workorders;
    }

    get workcenters() {
        const workcenters = [];
        for (const workcenter of this.state.workcenters) {
            workcenters.push([workcenter.id, workcenter.display_name]);
        }
        return workcenters;
    }

    toggleWorkcenter(workcenters) {
        const localStorageName = this.env.localStorageName;
        const workcentersState = JSON.parse(localStorage.getItem(localStorageName)) || [];
        for (const workcenter of workcenters) {
            const index = workcentersState.map((e) => e.id).indexOf(workcenter.id);
            if (workcentersState && index === -1) {
                workcentersState.push(workcenter);
            } else if (workcentersState) {
                workcentersState.splice(index, 1);
            }
        }
        localStorage.setItem(localStorageName, JSON.stringify(workcentersState));
        this.state.workcenters = workcentersState;
    }

    toggleEmployeesPanel() {
        this.showEmployeesPanel = !this.showEmployeesPanel;
        this.render(true);
    }

    filterWorkorderByProduction(workorder, production) {
        return workorder.data.production_id?.[0] === production.resId;
    }

    getRawMoves(record) {
        if (this.state.activeResModel === "mrp.workorder") {
            return this.stock_move.root.records.filter((move) =>
                move.data.manual_consumption &&
                record.data.move_raw_ids.currentIds.includes(move.resId)
            );
        }
        return this.stock_move.root.records.filter(
            (move) => move.data.raw_material_production_id?.[0] === record.resId
        );
    }

    getByproductMoves(record) {
        // TODO: `getByproductMoves` and `getFinishedMoves` can be merged and simplified (maybe include `getRawMoves` with them too ?)
        let byproductMoves = []
        if (this.state.activeResModel === "mrp.production") {
            byproductMoves = this.stock_move.root.records.filter((move) =>
                record.data.move_byproduct_ids.currentIds.includes(move.resId)
            );
        } else if (this.state.activeResModel === "mrp.workorder") {
            const relatedProduction = this.mrp_production.root.records.find(mo =>
                record.data.production_id[0] === mo.resId);
            if (relatedProduction) {
                byproductMoves = this.stock_move.root.records.filter((move) =>
                    move.data.production_id[0] === relatedProduction.resId &&
                    move.data.product_id[0] !== relatedProduction.data.product_id[0] &&
                    (!move.data.operation_id || move.data.operation_id[0] === record.data.operation_id[0])
                );
            }
        }
        return byproductMoves;
    }

    getFinishedMoves(record) {
        // TODO: `getByproductMoves` and `getFinishedMoves` can be merged and simplified (maybe include `getRawMoves` with them too ?)
        let finishedMoves = []
        if (this.state.activeResModel === "mrp.production") {
            finishedMoves = this.stock_move.root.records.filter((move) => {
                return move.data.production_id[0] === record.resId &&
                       move.data.product_id[0] === record.data.product_id[0]
            });
        }
        return finishedMoves;
    }

    getproduction(record) {
        if (record.resModel === "mrp.production") {
            return record;
        } else if (record.resModel === "mrp.workorder") {
            return this.mrp_production.root.records.find(mo => mo.resId === record.data.production_id[0]);
        }
    }

    getProductionWorkorders(record) {
        if (this.state.activeResModel === "mrp.production") {
            return this.mrp_workorder.root.records.filter((wo) => {
                return this.filterWorkorderByProduction(wo, record);
            });
        }
        return [];
    }

    getSubRecords(record) {
        const records = this.getRawMoves(record);
        records.push(...this.getByproductMoves(record));
        records.push(...this.getFinishedMoves(record));
        records.push(...this.getProductionWorkorders(record));
        const fieldName = record.resModel == "mrp.production" ? "production_id" : "workorder_id";
        const checks = this.quality_check.root.records.filter((qc) => {
            return qc.data[fieldName][0] == record.resId;
        });
        records.push(...checks);

        records.sort((recA, recB) => {
            if (recA.resModel === "stock.move") {
                // Stock moves first.
                return recB.resModel !== "stock.move" ? 1 : 0;
            } else if (recA.data.workcenter_id) {
                // For WO/QC, sort them by WO's id.
                if (recB.resModel === "stock.move") {
                    return 1;
                }
                const woId1 = recA.data.workorder_id?.[0] || recA.resId;
                const woId2 = recB.data.workorder_id?.[0] || recB.resId;
                return woId1 - woId2;
            }
        });
        return records;
    }

    async processValidationStack(reload=true) {
        const productionIds = [];
        const kwargs = {};
        for (const workorder of this.validationStack["mrp.workorder"]) {
            await workorder.validationCallback();
        }
        for (const production of this.validationStack["mrp.production"]) {
            if (!production.isValidated) {
                productionIds.push(production.record.resId);
                const { data } = production.record;
                if (data.product_tracking == "serial" && !data.show_serial_mass_produce) {
                    kwargs.context = kwargs.context || { skip_redirection: true };
                    if (data.product_qty > 1) {
                        kwargs.context.skip_backorder = true;
                        if (!kwargs.context.mo_ids_to_backorder) {
                            kwargs.context.mo_ids_to_backorder = [];
                        }
                        kwargs.context.mo_ids_to_backorder.push(production.resId);
                    }
                }
            }
        }
        if (productionIds.length) {
            const action = await this.orm.call(
                "mrp.production",
                "button_mark_done",
                [productionIds],
                kwargs
            );
            if (action && typeof action === "object") {
                const params = reload ? { onClose: () => this.reload() } : {}
                return this.actionService.doAction(action, params);
            }
            this.validationStack = {
                "mrp.production": [],
                "mrp.workorder": [],
            };
        }
        if (reload) {
            await this.reload();
        }
        return { success: true };
    }

    get relevantRecords() {
        if (this.state.activeResModel === "mrp.workorder") {
            if (this.state.activeWorkcenter === -1){
                // 'My' workcenter selected -> return the ones where the current employee is working on.
                return this.myWorkorders;
            }
            return this.mrp_workorder.root.records.filter(wo =>
                wo.data.workcenter_id[0] === this.state.activeWorkcenter &&
                wo.data.state !== 'done' && this.getproduction(wo)
            );
        }
        return this.mrp_production.root.records;
    }

    get adminWorkorderIds(){
        const admin_id = this.useEmployee.employees.admin.id;
        const admin = this.useEmployee.employees.connected.find((emp) => emp.id === admin_id);
        return admin ? admin.workorder.map((wo) => wo.id): [];
    }

    async selectWorkcenter(workcenterId) {
        // Waits all the MO under validation are actually validated before to change the WC.
        const result = await this.processValidationStack();
        if (result.success) {
            this.state.activeWorkcenter = Number(workcenterId);
            this.state.activeResModel = this.state.activeWorkcenter
                ? "mrp.workorder"
                : "mrp.production";
        }
    }

    async removeFromValidationStack(record, isValidated=true) {
        const relevantStack = this.validationStack[record.resModel];
        const foundRecord = relevantStack.find(rec => rec.record.resId === record.resId);
        if (isValidated) {
            foundRecord.isValidated = true;
            if (relevantStack.every(rec => rec.isValidated)) {
                // Empties the validation stack if all under validation MO or WO are validated.
                this.validationStack[record.resModel] = [];
                await this.reload();
            }
        } else {
            const index = relevantStack.indexOf(foundRecord);
            relevantStack.splice(index, 1);
        }
    }

    toggleSearchPanel() {
        this.display.searchPanel = !this.display.searchPanel;
        this.render(true);
    }

    toggleWorkcenterDialog() {
        const params = {
            title: _t("Select your Work Centers"),
            confirm: this.toggleWorkcenter.bind(this),
            disabled: [],
            active: this.state.workcenters.map((wc) => wc.id),
        };
        this.dialogService.add(MrpWorkcenterDialog, params);
    }

    async reload(){
        this.mrp_production.skipNextRefresh = true;
        this.mrp_workorder.skipNextRefresh = true;
        this.quality_check.skipNextRefresh = true;
        await this.mrp_production.load(getSearchParams(this.mrp_production, this.props, this, false));
        await this.mrp_workorder.load(getSearchParams(this.mrp_workorder, this.props, this, false));
        await this.quality_check.load(getSearchParams(this.quality_check, this.props, this, false));
        await this.stock_move.load(getSearchParams(this.stock_move, this.props, this));
        await this.useEmployee.getConnectedEmployees();
        const my_wo_ids = this.adminWorkorderIds;
        this.myWorkorders = this.mrp_workorder.root.records.filter(
                (wo) => my_wo_ids.includes(wo.resId)
            )
    }
}
