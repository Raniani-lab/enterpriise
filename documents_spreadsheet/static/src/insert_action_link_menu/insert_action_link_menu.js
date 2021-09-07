/** @odoo-module **/

import { createEmptySpreadsheet } from "@documents_spreadsheet/js/o_spreadsheet/helpers/helpers";
import spreadsheet from "@documents_spreadsheet/js/o_spreadsheet/o_spreadsheet_loader";
import { buildViewLink } from "@documents_spreadsheet/js/o_spreadsheet/registries/odoo_menu_link_cell";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";
import SpreadsheetSelectorDialog from "documents_spreadsheet.SpreadsheetSelectorDialog";

const { Component } = owl;
const { UuidGenerator, markdownLink } = spreadsheet.helpers;
const uuidGenerator = new UuidGenerator();
const favoriteMenuRegistry = registry.category("favoriteMenu");

/**
 * Insert a link to a view in spreadsheet
 * @extends Component
 */
export class InsertViewSpreadsheet extends Component {
    setup() {
        this.action = useService("action");
        this.notification = useService("notification");
        this.orm = useService("orm");
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
        let documentId;
        let notificationMessage;
        const insertLinkCallback = await this.getInsertMenuCallback(!spreadsheet);
        if (!spreadsheet) {
            documentId = await createEmptySpreadsheet(this.env.searchModel.orm);
            notificationMessage = this.env._t("New spreadsheet created in Documents");
        } else {
            documentId = spreadsheet.id;
            notificationMessage = sprintf(
                this.env._t("New sheet inserted in '%s'"),
                spreadsheet.name
            );
        }
        this.notification.add(notificationMessage, { type: "info" });
        this.action.doAction({
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                spreadsheet_id: documentId,
                initCallback: insertLinkCallback,
            },
        });
    }

    /**
     * Get the function to be called when the spreadsheet is opened in order
     * to insert the link.
     * @param {boolean} isEmptySpreadsheet True if the link is inserted in
     *                                     an empty spreadsheet, false
     *                                     otherwise
     * @returns Function to call
     */
    async getInsertMenuCallback(isEmptySpreadsheet) {
        const action = this.getViewDescription();
        return (model) => {
            if (!isEmptySpreadsheet) {
                const sheetId = uuidGenerator.uuidv4();
                const sheetIdFrom = model.getters.getActiveSheetId();
                model.dispatch("CREATE_SHEET", {
                    sheetId,
                    position: model.getters.getVisibleSheets().length,
                });
                model.dispatch("ACTIVATE_SHEET", { sheetIdFrom, sheetIdTo: sheetId });
            }
            const viewLink = buildViewLink(action);
            model.dispatch("UPDATE_CELL", {
                sheetId: model.getters.getActiveSheetId(),
                content: markdownLink(this.env.searchModel.displayName, viewLink),
                col: 0,
                row: 0,
            });
        };
    }

    getViewDescription() {
        const { displayName, resModel, view } = this.env.searchModel;
        const { context, domain } = this.env.searchModel.getIrFilterValues();
        const { views } = this.env.searchModel.action;
        const action = {
            domain,
            context,
            modelName: resModel,
            views: views.map(([, type]) => [false, type]),
        };
        return {
            viewType: view.type,
            action,
            name: displayName,
        };
    }
}

InsertViewSpreadsheet.props = {};
InsertViewSpreadsheet.template = "documents_spreadsheet.InsertActionSpreadsheet";

favoriteMenuRegistry.add(
    "insert-action-link-in-spreadsheet",
    {
        Component: InsertViewSpreadsheet,
        groupNumber: 4,
        isDisplayed: ({ isSmall, searchModel }) =>
            !isSmall && searchModel.action.type === "ir.actions.act_window"
    },
    { sequence: 1 }
);
