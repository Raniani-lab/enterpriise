/** @odoo-module */

import { MrpWorkorder } from "./mrp_workorder";
import { MrpQualityCheckConfirmationDialog } from "../dialog/mrp_quality_check_confirmation_dialog";
import { FileUploader } from "@web/views/fields/file_handler";
import { useService } from "@web/core/utils/hooks";

import { useRef } from "@odoo/owl";

export class QualityCheck extends MrpWorkorder {
    static template = "mrp_workorder.QualityCheck";
    static components = { ...MrpWorkorder.components, MrpQualityCheckConfirmationDialog, FileUploader };
    static props = {
        ...MrpWorkorder.props,
        displayInstruction: Function,
        quantityToProduce: { optional: true, type: Number },
    };

    setup() {
        super.setup();
        this.fieldState = "quality_state";
        this.isLongPressable = false;
        this.name = this.props.record.data.title || this.props.record.data.name;
        this.note = this.props.record.data.note;
        this.action = useService("action");
        this.fileUploaderToggle = useRef("fileUploaderToggle");
    }

    clicked() {
        this.props.displayInstruction();
    }

    async pass(){
        const { parent, record } = this.props;
        if (["instructions", "passfail"].includes(record.data.test_type)) {
            await record.model.orm.call(record.resModel, "do_pass", [record.resId]);
            return await this.reload();
        } else if (record.data.test_type === "register_production") {
            if (record.data.product_tracking == "serial") {
                await record.model.orm.call(
                    record.resModel,
                    "action_generate_serial_number_and_pass",
                    [record.resId]
                );
            } else {
                await parent.update({ qty_producing: this.props.quantityToProduce }, { save: true });
                await record.update({ qty_done: this.props.quantityToProduce }, { save: true });
                await record.model.orm.call(record.resModel, "action_next", [record.resId]);
            }
            return await this.reload();
        } else if (record.data.test_type === "print_label") {
            const res = await record.model.orm.call(record.resModel, "action_print", [record.resId]);
            this.action.doAction(res)
            return await this.reload()
        } else if (record.data.test_type === "picture") {
            this.fileUploaderToggle.el.click();
            return;
        }
        this.clicked();
    }

    get active() {
        return false;
    }

    get failed() {
        return this.state === "fail";
    }

    get isComplete() {
        return this.passed || this.failed;
    }

    get icon() {
        switch (this.props.record.data.test_type) {
            case "picture":
                return "fa fa-camera";
            case "register_consumed_materials":
            case "register_byproduct":
                return "fa fa-barcode";
            case "instructions":
                return "fa fa-square-o";
            case "passfail":
                return "fa fa-check";
            case "measure":
                return "fa fa-arrows-h";
            case "print_label":
                return "fa fa-print";
            default:
                return "fa fa-lightbulb-o";
        }
    }

    get passed() {
        return this.state === "pass";
    }

    async onFileUploaded(info) {
        await this.props.record.update({ picture: info.data }, { save: true });
        await this.props.record.model.orm.call(this.props.record.resModel, "do_pass", [this.props.record.resId]);
        return await this.reload();
    }
}
