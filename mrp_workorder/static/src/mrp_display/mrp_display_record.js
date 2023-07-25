/** @odoo-module */

import { CharField } from "@web/views/fields/char/char_field";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";
import { Component, useState } from "@odoo/owl";
import { Field } from "@web/views/fields/field";
import { StockMove } from "./mrp_record_line/stock_move";
import { MrpWorkorder } from "./mrp_record_line/mrp_workorder";
import { QualityCheck } from "./mrp_record_line/quality_check";
import { mrpTimerField } from "@mrp/widgets/timer";
import { useService } from "@web/core/utils/hooks";
import { MrpQualityCheckConfirmationDialog } from "./dialog/mrp_quality_check_confirmation_dialog";
import { MrpRegisterProductionDialog } from "./dialog/mrp_register_production_dialog";
import { SelectionField } from "@web/views/fields/selection/selection_field";
import { MrpMenuDialog } from "./dialog/mrp_menu_dialog";
import { MrpWorksheet } from "./mrp_record_line/mrp_worksheet";

export class MrpDisplayRecord extends Component {
    static components = {
        CharField, Field, Many2OneField, SelectionField,
        MrpTimerField: mrpTimerField.component,
        MrpWorksheet
    };
    static props = {
        addToValidationStack: Function,
        groups: Object,
        onlyRecord: Boolean,
        production: { optional: true, type: Object },
        record: Object,
        recordUpdated: Function,
        reload: Function,
        removeFromValidationStack: Function,
        selectUser: Function,
        selectWorkcenter: { optional: true, type: Function },
        sessionOwner: Object,
        subRecords: Array,
        updateEmployees: Function,
        workcenters: Array,
    };
    static template = "mrp_workorder.MrpDisplayRecord";

    setup() {
        this.user = useService("user");
        this.dialog = useService("dialog");
        this.action = useService("action");
        this.state = useState({
            underValidation: false,
            validated: false,
        });
        this.model = this.props.record.model;
        this.record = this.props.record.data;
        this.workorders = this.props.subRecords.filter(rec => rec.resModel === "mrp.workorder");
        this.qualityChecks = this.props.subRecords.filter(rec => rec.resModel === "quality.check");
        const moves = this.props.subRecords.filter(rec => rec.resModel === "stock.move");
        this.rawMoves = moves.filter(rec => rec.data.raw_material_production_id);

        const qualityCheckProductids = [];
        for (const qualityCheck of this.qualityChecks) {
            if (qualityCheck.data.component_id) {
                qualityCheckProductids.push(qualityCheck.data.component_id[0]);
            }
        };
        if (this.props.record.resModel == "mrp.production") {
            // Don't take the by-products who have a QC for them (registration managed by their QC).
            this.byproductMoves = moves.filter(move => {
                const productId = move.data.product_id[0]
                return move.data.production_id && productId !== this.record.product_id[0] &&
                    !qualityCheckProductids.includes(productId);
            });
        } else {
            this.byproductMoves = moves.filter(move => {
                const productId = move.data.product_id[0]
                return move.data.production_id && productId !== this.record.product_id[0];
            });
        }

        this.finishedMoves = moves.filter(rec => {
            return rec.data.production_id && rec.data.product_id[0] === this.record.product_id[0];
        });
        // Display a line for the production's registration if there is no QC for it.
        this.displayRegisterProduction = !this.qualityChecks.some(qc => {
            return qc.data.test_type === "register_production";
        });
        this.quantityToProduce = this.record.product_qty || this.record.qty_production;
        this.displayUOM = this.props.groups.uom;
    }

    /**
     * Opens a confirmation dialog to register the produced quantity and set the
     * tracking number if it applies.
     */
    registerProduction() {
        const title = this.env._t("Register Production");
        let body = this.env._t("Register the produced quantity");
        if (this.record.product_tracking === "serial") {
            body = this.env._t("Register the produced quantity and set the serial number");
        } else if (this.record.product_tracking === "lot") {
            body = this.env._t("Register the produced quantity and set the lot number");
        }
        const reload = () => this.reload();
        const params = { body, record: this.props.production, reload, title };
        this.dialog.add(MrpRegisterProductionDialog, params);
    }

    async quickRegisterProduction() {
        const { production } = this.props;
        const qtyToSet = this.productionComplete ? 0 : production.data.product_qty;
        production.update({ qty_producing: qtyToSet });
        await production.save();
        // Calls `set_qty_producing` because the onchange won't be triggered.
        await production.model.orm.call("mrp.production", "set_qty_producing", production.resIds);
        await this.reload();
    }

    async generateSerialNumber() {
        if (this.trackingMode === "lot") {
            this.props.production.update({ qty_producing: this.props.production.data.product_qty });
            await this.props.production.save();
        }
        const args = [this.props.production.resId];
        await this.model.orm.call("mrp.production", "action_generate_serial", args);
        await this.reload();
    }

    get productionComplete() {
        const production = this.props.record.resModel === "mrp.production" ?
            this.record :
            this.props.production.data;
        if (production.product_tracking === "serial") {
            return Boolean(production.qty_producing === 1 && production.lot_producing_id);
        }
        return production.qty_producing >= production.product_qty
    }

    get quantityProducing() {
        return this.props.production.data.qty_producing;
    }

    getByproductLabel(record) {
        return this.env._t("Register %s", record.data.product_id[1]);
    }

    get cssClass() {
        const active = this.active ? "o_active" : "";
        const disabled = this.disabled ? 'o_disabled' : ''
        const underValidation = this.state.underValidation ? "o_fadeout_animation" : "";
        const finished = this.state.validated ? "d-none" : "";
        return `${active} ${disabled} ${underValidation} ${finished}`;
    }

    get displayDoneButton() {
        const { resModel } = this.props.record;
        if (resModel === "mrp.production") {
            return this._productionDisplayDoneButton();
        }
        return this._workorderDisplayDoneButton();
    }

    get subRecords() {
        if (this.props.record.resModel === "mrp.production") {
            const manualConsumptionMoves = this.rawMoves.filter(move => move.data.manual_consumption);
            return [...this.workorders, ...manualConsumptionMoves];
        }
        return this.props.subRecords;
    }

    subRecordProps(subRecord) {
        const props = {
            clickable: !this.state.underValidation,
            displayUOM: this.displayUOM,
            parent: this.props.record,
            record: subRecord,
        };
        if (subRecord.resModel === "quality.check") {
            props.displayInstruction = this.displayInstruction.bind(this, subRecord);
            props.sessionOwner = this.props.sessionOwner;
            props.updateEmployees = this.props.updateEmployees;
            if (subRecord.data.test_type === "register_production") {
                props.quantityToProduce = this.quantityToProduce;
            } else if (subRecord.data.test_type === "register_byproducts") {
                const relatedMove = this.byproductMoves.find(move => move.data.product_id[0] === subRecord.data.component_id?.[0]);
                if (relatedMove) {
                    props.quantityToProduce = relatedMove.data.product_uom_qty;
                }
            }
        } else if (subRecord.resModel === "mrp.workorder") {
            props.selectWorkcenter = this.props.selectWorkcenter;
            props.qualityChecks = this.props.subRecords.filter(
                (r) => r.resModel == "quality.check" && r.data.workorder_id[0] == subRecord.resId
            );
            props.sessionOwner = this.props.sessionOwner;
            props.updateEmployees = this.props.updateEmployees;
        }
        return props;
    }

    async getWorksheetData(record) {
        const recordData = record.data;
        if (recordData.source_document === 'step'){
            if (recordData.worksheet_document){
                const sheet = await record.model.orm.read("quality.check", [record.resId], ["worksheet_document"]);
                return {
                    resModel: "quality.check",
                    resId: recordData.id,
                    resField: "worksheet_document",
                    value: sheet[0]['worksheet_document'],
                    page: 1,
                }
            }
            if (recordData.worksheet_url){
                return {
                    resModel: "quality.check",
                    resId: recordData.id,
                    resField: "worksheet_url",
                    value: recordData.worksheet_url,
                    page: 1,
                }
            }
        } else {
            if (this.record.worksheet){
                const sheet = await this.props.record.model.orm.read("mrp.workorder", [this.record.id], ["worksheet"]);
                return {
                    resModel: "mrp.workorder",
                    resId: this.record.id,
                    resField: "worksheet",
                    value: sheet[0]['worksheet'],
                    page: recordData.worksheet_page,
                }
            }
            if (this.record.worksheet_google_slide){
                return {
                    resModel: "mrp.workorder",
                    resId: this.record.id,
                    resField: "worksheet_google_slide",
                    value: this.record.worksheet_google_slide,
                    page: recordData.worksheet_page,
                }
            }
        }
        // if (recordData.source_document === "step" && recordData.worksheet_document) {
        //     const worksheetDocument = await this.model.orm.read(record.resModel, record.resIds, [
        //         "worksheet_document",
        //     ]);
        //     return {type:'pdf', data: {
        //         resModel: "quality.check",
        //         resId: recordData.id,
        //         resField: "worksheet_document",
        //         value: worksheetDocument[0].worksheet_document,
        //         page: 1,
        //     }};
        // }
        // if (recordData.worksheet_page){
        //     const worksheetDocument = await this.model.orm.read("mrp.workorder", [recordData.workorder_id[0]], [
        //         "worksheet",
        //     ]);
        //     if (worksheetDocument.length && worksheetDocument[0]['worksheet']) {
        //         return {type: 'pdf', data:{
        //             resModel: "mrp.workorder",
        //             resId: recordData.workorder_id[0],
        //             resField: "worksheet",
        //             value: worksheetDocument[0]['worksheet'],
        //             page: recordData.worksheet_page,
        //         }}
        //     }
        // }
    }

    async displayInstruction(record) {
        if (!record) { // Searches the next Quality Check.
            const lastQC = this.lastOpenedQualityCheck.data;
            const workorder = this.props.record.resModel === "mrp.workorder" ?
                this.record :
                this.workorders.find(wo => wo.resId === lastQC.workorder_id[0]);
            const currentCheckId = workorder.current_quality_check_id[0];
            record = this.qualityChecks.find(qc => qc.resId === currentCheckId);
        }
        if (record === this.lastOpenedQualityCheck || !record) { // Avoids a QC to re-open itself.
            delete this.lastOpenedQualityCheck;
            return;
        }

        const worksheetData = await this.getWorksheetData(record);
        const params = {
            body: record.data.note,
            record,
            title: `${record.data.production_id[1]}: ${record.data.display_name}`,
            worksheetData,
            checkInstruction: this.record.operation_note,
            cancel: () => {
                delete this.lastOpenedQualityCheck;
            },
            qualityCheckDone: this.qualityCheckDone.bind(this),
        };
        this.lastOpenedQualityCheck = record;

        this.dialog.add(MrpQualityCheckConfirmationDialog, params);
    }

    async qualityCheckDone(updateChecks = false, qualityState = "pass") {
        if (updateChecks) {
            await this.props.reload();
        }
        await this.reload();
        if (updateChecks){
            this.qualityChecks = this.props.subRecords.filter(
                (rec) => rec.resModel === "quality.check"
            );
        }
        // Show the next Quality Check only if the previous one is passed.
        if (qualityState === "pass") {
            return this.displayInstruction();
        }
    }

    get active() {
        return this.props.record.data.employee_ids.records.length != 0;
    }

    get disabled() {
        if (this.props.record.resModel === "mrp.workorder"){
            if (!this.props.record.data.all_employees_allowed &&
                !this.props.record.data.allowed_employees.currentIds.includes(this.props.sessionOwner.id)) {
                return true
            }
        }
        return this.props.groups.workorders && !this.props.sessionOwner.id
    }

    get trackingMode() {
        if (
            this.props.production.data.product_tracking == "serial" &&
            this.props.production.data.show_serial_mass_produce &&
            !["progress", "to_close"].includes(this.props.production.data.state)
        ) {
            return "mass_produce";
        }
        return this.props.production.data.product_tracking;
    }

    getComponent(record) {
        if (record.resModel === "stock.move") {
            return StockMove;
        } else if (record.resModel === "mrp.workorder") {
            return MrpWorkorder;
        } else if (record.resModel === "quality.check") {
            return QualityCheck;
        }
        throw Error(`No Component found for the model "${record.resModel}"`);
    }

    async onClickHeader() {
        if (this.props.record.resModel === "mrp.workorder"){
            this.startWorking(true);
        }
    }

    onClickOpenMenu(ev) {
        const params = {
            workcenters: this.props.workcenters,
            checks: this.qualityChecks,
        };
        this.dialog.add(MrpMenuDialog, {
            groups: this.props.groups,
            title: "What do you want to do?",
            record: this.props.record,
            params,
            reload: this.props.reload.bind(this),
        });
    }

    async actionAssignSerial() {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.workorder") {
            return;
        }
        await this.model.orm.call(resModel, "action_generate_serial", [resId]);
        this.model.load();
    }

    onClickValidateButton() {
        if (this.state.underValidation) { // Already under validation: cancel the validation process
            this.props.removeFromValidationStack(this.props.record, false);
            this.state.underValidation = false;
        } else { // Start the record's validation process (delayed actual validation).
            this.validate()
        }
    }

    async validate() {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.production") {
            const params = {};
            let methodName = "pre_button_mark_done";
            if (this.trackingMode === "mass_produce") {
                methodName = "action_serial_mass_produce_wizard";
                params.mark_as_done = true;
            }
            const action = await this.model.orm.call(resModel, methodName, [resId], params);
            // If there is a wizard while trying to mark as done the production, confirming the
            // wizard will straight mark the MO as done without the confirmation delay.
            if (action && typeof action === "object") {
                return this._doAction(action);
            }
        } else if (resModel === "mrp.workorder") {
            if (this.record.state === "ready") {
                this.props.record.update({ qty_producing: this.record.qty_production });
                await this.props.record.save();
            }
            await this.model.orm.call(resModel, "end_all", [resId]);
            await this.reload();
            await this.props.updateEmployees();
            if (this.record.is_last_unfinished_wo){
                const params = {};
                let methodName = "pre_button_mark_done";
                if (this.trackingMode === "mass_produce") {
                    methodName = "action_serial_mass_produce_wizard";
                    params.mark_as_done = true;
                }
                const action = await this.model.orm.call("mrp.production", methodName, [this.props.production.resId], params);
                // If there is a wizard while trying to mark as done the production, confirming the
                // wizard will straight mark the MO as done without the confirmation delay.
                if (action && typeof action === "object") {
                    return this._doAction(action);
                }
            }
        }
        // Makes the validation taking a little amount of time (see o_fadeout_animation CSS class).
        this.props.addToValidationStack(this.props.record, () => this.realValidation());
        this.state.underValidation = true;
    }

    realValidation() {
        if (this.state.validated) {
            return;
        }
        if (this.props.record.resModel === "mrp.production") {
            return this.productionValidation();
        } else if (this.props.record.resModel === "mrp.workorder") {
            return this.workorderValidation();
        }
    }

    async productionValidation() {
        const { resId, resModel } = this.props.production;
        const kwargs = {};
        if (this.trackingMode == "serial") {
            kwargs.context = { skip_redirection: true };
            if (this.record.product_qty > 1) {
                kwargs.context.skip_backorder = true;
                kwargs.context.mo_ids_to_backorder = [resId];
            }
        }
        const action = await this.model.orm.call(resModel, "button_mark_done", [resId], kwargs);
        if (action && typeof action === "object") {
            return this._doAction(action);
        } else if (this.props.record.resModel === "mrp.production") {
            await this.props.removeFromValidationStack(this.props.record);
            this.state.validated = true;
            await this.props.updateEmployees();
        }
    }

    async workorderValidation() {
        const { resId, resModel } = this.props.record;
        if (this.record.is_last_unfinished_wo) {
            await this.model.orm.call(resModel, "action_open_manufacturing_order", [resId]);
            await this.productionValidation();
        } else {
            const context = { no_start_next: true };
            await this.model.orm.call(resModel, "do_finish", [resId], { context });
        }
        await this.props.removeFromValidationStack(this.props.record);
        this.state.validated = true;
        await this.props.updateEmployees();
    }

    _doAction(action) {
        const options = {
            onClose: () => this.props.reload(),
        };
        return this.model.action.doAction(action, options);
    }

    async reload() {
        await this.props.record.load();
        // Updates the MO/WO's moves and quality checks too.
        const models = new Set();
        for (const record of this.props.subRecords) {
            await record.load();
            models.add(record.model);
        }
        for (const model of models) {
            model.notify();
        }
    }

    _productionDisplayDoneButton() {
        return this.qualityChecks.every((qc) => ["fail", "pass"].includes(qc.data.quality_state));
    }

    openFormView() {
        this.model.action.doAction({
            type: "ir.actions.act_window",
            res_model: this.props.record.resModel,
            views: [[false, "form"]],
            res_id: this.props.record.resId,
        });
    }

    get uom() {
        return this.record.product_uom_id?.[1];
    }

    _workorderDisplayDoneButton() {
        return (
            ["pending", "waiting", "ready", "progress"].includes(this.record.state) &&
            this.qualityChecks.every((qc) => ["pass", "fail"].includes(qc.data.quality_state))
        );
    }

    async startWorking(shouldStop=false){
        const { resModel, resId } = this.props.record;
        if (resModel !== "mrp.workorder") {
            return;
        }
        await this.props.updateEmployees();
        const admin_id = this.props.sessionOwner.id;
        if (admin_id && !this.props.record.data.employee_ids.records.some(emp => emp.resId == admin_id)) {
            await this.model.orm.call(resModel, "button_start", [resId]);
        } else if (shouldStop) {
            await this.model.orm.call(resModel, "stop_employee", [resId, [admin_id]]);
        }
        await this.reload();
        await this.props.recordUpdated(this.record.id);
        await this.props.updateEmployees();
    }

    get showWorksheetCheck() {
        if (this.props.record.resModel === "mrp.workorder" && (this.props.record.data.worksheet || this.props.record.data.worksheet_google_slide)){
            const checks = this.props.subRecords.filter(r => r.resModel === "quality.check");
            return !checks.length;
        }
        return false
    }

    onAnimationEnd(ev) {
        if (ev.animationName === "fadeout" && this.state.underValidation) {
            this.realValidation();
        }
    }
}
