/** @odoo-module **/

import { PivotController} from "@web/views/pivot/pivot_controller";
import { pivotView } from "@web/views/pivot/pivot_view";
import SpreadsheetSelectorDialog from "documents_spreadsheet.SpreadsheetSelectorDialog";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";
import { removeContextUserInfo } from "../helpers";

import { _t } from "@web/core/l10n/translation";
const PERIODS = {
    day: _t("Day"),
    week: _t("Week"),
    month: _t("Month"),
    quarter: _t("Quarter"),
    year: _t("Year"),
};

const { onWillStart } = owl;

patch(PivotController.prototype, "pivot_spreadsheet", {
    setup() {
        this._super.apply(this, arguments);
        this.userService = useService("user");
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.actionService = useService("action");
        onWillStart(async () => {
            this.canInsertPivot = await this.userService.hasGroup("documents.group_documents_user");
        });
    },

    async onInsertInSpreadsheet() {
        const spreadsheets = await this.orm.call(
            "documents.document",
            "get_spreadsheets_to_display",
            [],
            []
        );

        let name = this.model.metaData.title;
        const groupBy = this.model.metaData.fullColGroupBys[0] || this.model.metaData.fullRowGroupBys[0];
        if (groupBy) {
            let [field, period] = groupBy.split(":");
            period = PERIODS[period];
            name += ` ${_t("by")} ` + this.model.metaData.fields[field].string + (period ? ` (${period})` : "");
        }
        const params = {
            spreadsheets,
            title: this.env._t("Select a spreadsheet to insert your pivot"),
            type: "PIVOT",
            name,
        };
        const dialog = new SpreadsheetSelectorDialog(this, params).open();
        dialog.on("confirm", this, this.insertInSpreadsheet);
    },

    /**
     * Open a new spreadsheet or an existing one and insert the pivot in it.
     *
     * @param {object} spreadsheet details of the selected document
     *                                  in which the pivot should be inserted. undefined if
     *                                  it's a new sheet
     * @param {number} spreadsheet.id the id of the selected spreadsheet
     * @param {string} spreadsheet.name the name of the selected spreadsheet
     * @param {string} name Name of the pivot
     *
     */
    async insertInSpreadsheet({ id: spreadsheet, name }) {
        let notificationMessage;
        const actionOptions = {
            preProcessingAsyncAction: "insertPivot",
            preProcessingAsyncActionData: {
                data: this.model.data,
                metaData: this.model.metaData,
                searchParams: {
                    ...this.model.searchParams,
                    context: removeContextUserInfo(this.model.searchParams.context),
                },
                name,
            }
        };

        if (!spreadsheet.id) {
            actionOptions.alwaysCreate = true;
            notificationMessage = this.env._t("New spreadsheet created in Documents");
        } else {
            actionOptions.spreadsheet_id = spreadsheet.id;
            notificationMessage = sprintf(
                this.env._t("New sheet inserted in '%s'"),
                spreadsheet.name
            );
        }

        this.notification.add(notificationMessage, { type: "info" });
        this.actionService.doAction({
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: actionOptions,
        });
    },
});

pivotView.buttonTemplate = "documents_spreadsheet.PivotView.buttons";
