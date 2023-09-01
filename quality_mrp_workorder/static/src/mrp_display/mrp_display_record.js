/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MrpDisplayRecord } from "@mrp_workorder/mrp_display/mrp_display_record";

patch(MrpDisplayRecord.prototype, {
    async validate() {
        const { resModel, resId } = this.props.record;
        if (resModel === "mrp.production") {
            if (this.record.quality_check_todo) {
                const action = await this.model.orm.call(resModel, "check_quality", [resId]);
                return this._doAction(action);
            }
        }
        return super.validate();
    },

    _shouldValidateProduction() {
        return super._shouldValidateProduction() && !this.props.production.data.quality_check_todo;
    },

    _productionDisplayDoneButton() {
        return this.record.check_ids.records.every((qc) =>
            ["fail", "pass"].includes(qc.data.quality_state)
        );
    },
});
