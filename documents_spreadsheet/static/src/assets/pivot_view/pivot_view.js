/** @odoo-module **/

import { PivotController} from "@web/views/pivot/pivot_controller";
import { pivotView } from "@web/views/pivot/pivot_view";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";
import { removeContextUserInfo, PERIODS } from "../helpers";

import { _t } from "@web/core/l10n/translation";
import { SpreadsheetSelectorDialog } from "../components/spreadsheet_selector_dialog/spreadsheet_selector_dialog";

const { onWillStart } = owl;

patch(PivotController.prototype, "pivot_spreadsheet", {
    setup() {
        this._super.apply(this, arguments);
        this.userService = useService("user");
        this.notification = useService("notification");
        this.actionService = useService("action");
        onWillStart(async () => {
            this.canInsertPivot = await this.userService.hasGroup("documents.group_documents_user");
        });
    },

    onInsertInSpreadsheet() {
        let name = this.model.metaData.title;
        const groupBy =
            this.model.metaData.fullColGroupBys[0] || this.model.metaData.fullRowGroupBys[0];
        if (groupBy) {
            let [field, period] = groupBy.split(":");
            period = PERIODS[period];
            name +=
                ` ${_t("by")} ` +
                this.model.metaData.fields[field].string +
                (period ? ` (${period})` : "");
        }
        const params = {
            type: "PIVOT",
            name,
            confirm: (args) => this.insertInSpreadsheet(args),
        };
        this.env.services.dialog.add(SpreadsheetSelectorDialog, params);
    },

    /**
     * Open a new spreadsheet or an existing one and insert the pivot in it.
     *
     * @param {Object} param0
     * @param {object} param0.spreadsheet details of the selected document
     *                                  in which the pivot should be inserted. undefined if
     *                                  it's a new sheet
     * @param {number} param0.spreadsheet.id the id of the selected spreadsheet
     * @param {string} param0.spreadsheet.name the name of the selected spreadsheet
     * @param {string} param0.name Name of the pivot
     *
     */
    async insertInSpreadsheet({ spreadsheet, name }) {
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
            },
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
