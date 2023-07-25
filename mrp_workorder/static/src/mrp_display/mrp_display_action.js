/** @odoo-module */

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { WithSearch } from "@web/search/with_search/with_search";
import { MrpDisplay } from "@mrp_workorder/mrp_display/mrp_display";

const { Component, onWillStart } = owl;

// from record.js
const defaultActiveField = { attrs: {}, options: {}, domain: "[]", string: "" };

export class MrpDisplayAction extends Component {
    static template = "mrp_workorder.MrpDisplayAction";
    static components = { WithSearch, MrpDisplay };
    static props = {
        "*": true,
    };

    get fieldsStructure() {
        return {
            "mrp.production": [
                "display_name",
                "check_ids",
                "company_id",
                "employee_ids",
                "lot_producing_id",
                "move_byproduct_ids",
                "move_raw_ids",
                "move_finished_ids",
                "name",
                "product_id",
                "product_qty",
                "product_tracking",
                "product_uom_id",
                "qty_producing",
                "show_serial_mass_produce",
                "state",
                "workorder_ids",
                "date_start",
            ],
            "mrp.workorder": [
                "display_name",
                "current_quality_check_id",
                "duration",
                "is_user_working",
                "move_raw_ids",
                "name",
                "operation_id",
                "operation_note",
                "product_id",
                "production_id",
                "qty_producing",
                "qty_production",
                "state",
                "workcenter_id",
                "worksheet",
                "worksheet_google_slide",
                "check_ids",
                "employee_ids",
                "product_uom_id",
                "is_last_unfinished_wo",
                "barcode",
                "date_start",
                "allowed_employees",
                "all_employees_allowed",
            ],
            "stock.move": [
                "manual_consumption",
                "operation_id",
                "product_id",
                "product_uom",
                "product_uom_qty",
                "production_id",
                "quantity_done",
                "raw_material_production_id",
                "should_consume_qty",
                "workorder_id",
            ],
            "quality.check": [
                "company_id",
                "component_id",
                "component_remaining_qty",
                "component_tracking",
                "component_uom_id",
                "lot_id",
                "name",
                "note",
                "picture",
                "product_id",
                "product_tracking",
                "production_id",
                "qty_done",
                "quality_state",
                "source_document",
                "test_type",
                "title",
                "workcenter_id",
                "workorder_id",
                "worksheet_document",
                "worksheet_url",
                "worksheet_page",
                "write_date",
                "measure",
                "norm_unit",
                "previous_check_id",
                "next_check_id",
            ],
        }
    }

    setup() {
        this.viewService = useService("view");
        this.fieldService = useService("field");
        this.orm = useService("orm");
        this.resModel = "mrp.production";
        this.models = [];

        onWillStart(async () => {
            for (const [resModel, fieldNames] of Object.entries(this.fieldsStructure)) {
                const fields = await this.fieldService.loadFields(resModel, { fieldNames });
                for (const [fName, fInfo] of Object.entries(fields)) {
                    fields[fName] = { ...defaultActiveField, ...fInfo };
                }
                this.models.push({ fields, resModel });
            }

            const searchViews = await this.viewService.loadViews({
                resModel: this.resModel,
                views: [[false, "search"]],
            });
            const domain = [
                ["state", "in", ["confirmed", "progress", "to_close"]],
                "|",
                ["bom_id", "=", false],
                ["bom_id.type", "in", ["normal", "phantom"]],
            ];
            const { context } = this.props.action;
            if (context.active_model === "stock.picking.type" && context.active_id) {
                domain.push(["picking_type_id", "=", context.active_id]);
            }
            this.withSearchProps = {
                resModel: this.resModel,
                searchViewArch: searchViews.views.search.arch,
                searchViewId: searchViews.views.search.id,
                searchViewFields: searchViews.fields,
                context,
                domain,
                orderBy: [{name: 'state', asc: false}, {name: 'date_start', asc: true}],
            };
        });
    }
}

registry.category("actions").add("mrp_display", MrpDisplayAction);
