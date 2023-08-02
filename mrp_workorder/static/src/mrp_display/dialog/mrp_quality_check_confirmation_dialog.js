/** @odoo-module */

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import DocumentViewer from '@mrp_workorder/components/viewer';
import { formatFloat } from "@web/views/fields/formatters";
import { FloatField } from "@web/views/fields/float/float_field";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";
import { TabletImageField } from "@quality/tablet_image_field/tablet_image_field";
import { useService, useBus } from "@web/core/utils/hooks";

export class MrpQualityCheckConfirmationDialog extends ConfirmationDialog {
    static props = {
        ...ConfirmationDialog.props,
        record: Object,
        reload: { type: Function, optional: true },
        qualityCheckDone: { type: Function, optional: true },
        worksheetData: { type: Object, optional: true },
        checkInstruction: { type: Object, optional: true},
    };
    static template = "mrp_workorder.MrpQualityCheckConfirmationDialog";
    static components = {
        ...ConfirmationDialog.components,
        DocumentViewer,
        FloatField,
        Many2OneField,
        TabletImageField,
    };

    setup() {
        super.setup();
        this.barcode = useService("barcode");
        this.notification = useService("notification");
        this.action = useService("action");
        useBus(this.props.record.model.bus, "update", this.render.bind(this, true));
        useBus(this.barcode.bus, 'barcode_scanned', (event) => this._onBarcodeScanned(event.detail.barcode));
        this.formatFloat = formatFloat;
        const { component_tracking, test_type, product_tracking } = this.recordData;
        this.displayLot =
            Boolean(component_tracking && component_tracking !== "none") ||
            Boolean(test_type === "register_production" && product_tracking !== "none");
    }

    get recordData() {
        return this.props.record.data;
    }

    get confirmLabel() {
        if (["instructions", "passfail"].includes(this.recordData.test_type)) {
            return this.env._t("next");
        } else if (this.recordData.test_type === "print_label") {
            return this.env._t("print labels");
        }
        return this.env._t("validate");
    }

    async validate() {
        if (this.recordData.test_type === "print_label") {
            return this.doActionAndClose("action_print", false);
        } else if (this.recordData.test_type === "measure") {
            return this.doActionAndClose("do_measure");
        } else if (this.recordData.test_type === "worksheet") {
            return this.doActionAndClose("action_worksheet_check", false);
        }
        const skipSave = ["instructions", "passfail"].includes(this.recordData.test_type);
        this.doActionAndClose("action_next", !skipSave);
    }

    async continueProduction() {
        await this.props.record.model.orm.write(
            "mrp.workorder",
            [this.props.record.data.workorder_id[0]],
            { current_quality_check_id: this.props.record.resId });
        this.doActionAndClose("action_continue", false, true);
    }

    async openWorksheet(){
        const res = await this.props.record.model.orm.call(
            this.props.record.resModel,
            "action_fill_sheet",
            [this.props.record.resId]);
        this.action.doAction(res);
    }

    async pass() {
        this.doActionAndClose("action_pass_and_next");
    }

    async fail() {
        this.doActionAndClose("action_fail_and_next");
    }

    async doActionAndClose(action, saveModel = true, reloadChecks = false){
        if (saveModel) {
            await this.props.record.save();
        }
        const res = await this.props.record.model.orm.call(this.props.record.resModel, action, [this.props.record.resId]);
        if (res) {
            this.action.doAction(res);
        }
        await this.props.record.load();
        await this.props.qualityCheckDone(reloadChecks);
        this.props.close();
    }

    async _onBarcodeScanned (barcode){
        if (["register_consumed_materials", "register_byproducts"].includes(this.recordData.test_type)){
            const lot = await this.props.record.model.orm.search('stock.lot', [
                ["name", "=", barcode],
                ["product_id", "=", this.recordData.component_id[0]],
                "|", ["company_id", "=", false], ["company_id", "=", this.recordData.company_id[0]],
            ]);
            if (lot.length) {
                this.recordData.lot_id = [lot[0], barcode];
                this.render();
            }
        }
    }

    get lotInfo() {
        const productId = this.recordData.component_id?.[0] || this.props.record.data.product_id[0];
        return {
            name: "lot_id",
            record: this.props.record,
            context: {
                default_product_id: productId,
                default_company_id: this.recordData.company_id[0],
            },
            domain: [
                "&",
                ["product_id", "=", productId],
                "|",
                ["company_id", "=", false],
                ["company_id", "=", this.recordData.company_id[0]],
            ],
        };
    }

    get measureInfo() {
        return {
            name: "measure",
            record: this.props.record,
        };
    }

    get note() {
        const note = this.recordData.note;
        return note && note !== "<p><br></p>" && note != "false" ? note : undefined;
    }

    get picInfo() {
        return {
            name: "picture",
            record: this.props.record,
            width: 100,
            height: 100,
        };
    }

    get qtyDoneInfo() {
        return {
            name: "qty_done",
            record: this.props.record,
        };
    }
}
