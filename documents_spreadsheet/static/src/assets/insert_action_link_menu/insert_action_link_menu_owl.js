/** @odoo-module **/

import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";

import SpreadsheetSelectorDialog from "documents_spreadsheet.SpreadsheetSelectorDialog"

const { Component } = owl;
const favoriteMenuRegistry = registry.category("favoriteMenu");

/**
 * Insert a link to a view in spreadsheet
 * @extends Component
 */
export class InsertViewSpreadsheet extends Component {
    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.actionService = useService("action");
    }

    //-------------------------------------------------------------------------
    // Handlers
    //-------------------------------------------------------------------------

    async linkInSpreadsheet() {
        const spreadsheets = await this.orm.call("documents.document", "get_spreadsheets_to_display");
        const dialog = new SpreadsheetSelectorDialog(this, { spreadsheets }).open();
        dialog.on("confirm", this, this.insertInSpreadsheet);
    }

    /**
     * Open a new spreadsheet or an existing one and insert a link to the action.
     */
    async insertInSpreadsheet({ id: spreadsheet }) {
        const actionToLink = this.getViewDescription();
        // do action with action link
        let notificationMessage;
        const actionOptions = {
            preProcessingAction: "insertLink",
            preProcessingActionData: actionToLink
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
    }

    getViewDescription() {
        const { resModel } = this.env.searchModel;
        const { displayName, views = [] } = this.env.config;
        const { context, domain } = this.env.searchModel.getIrFilterValues();
        const action = {
            domain,
            context,
            modelName: resModel,
            views: views.map(([, type]) => [false, type]),
        };
        return {
            viewType: this.env.config.viewType,
            action,
            name: displayName,
        };
    }
}

InsertViewSpreadsheet.props = {};
InsertViewSpreadsheet.template = "documents_spreadsheet.InsertActionSpreadsheet";
InsertViewSpreadsheet.components = { DropdownItem };

favoriteMenuRegistry.add(
    "insert-action-link-in-spreadsheet",
    {
        Component: InsertViewSpreadsheet,
        groupNumber: 4,
        isDisplayed: ({ config, isSmall }) =>
            !isSmall && config.actionType === "ir.actions.act_window"
    },
    { sequence: 1 }
);
