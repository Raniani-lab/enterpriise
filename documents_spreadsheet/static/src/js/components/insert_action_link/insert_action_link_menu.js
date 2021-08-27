/** @odoo-module */
import DropdownMenuItem from "web.DropdownMenuItem";
import FavoriteMenu from "web.FavoriteMenu";
import pyUtils from "web.py_utils";
import Domain from "web.Domain";
import { useService } from "@web/core/utils/hooks";
import { useModel } from "web.Model";
import SpreadsheetSelectorDialog from "documents_spreadsheet.SpreadsheetSelectorDialog";
import spreadsheet from "../../o_spreadsheet/o_spreadsheet_loader";
import { buildViewLink } from "../../o_spreadsheet/registries/odoo_menu_link_cell";
import { createEmptySpreadsheet } from "../../o_spreadsheet/helpers/helpers";

const { UuidGenerator, markdownLink } = spreadsheet.helpers;
const uuidGenerator = new UuidGenerator();

/**
 * Insert a link to a view in spreadsheet
 *
 * @extends DropdownMenuItem
 */
export class InsertViewSpreadsheet extends DropdownMenuItem {
    constructor() {
        super(...arguments);
        this.model = useModel("searchModel");
        this.notification = useService("notification");
    }

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * @private
     */
    async _linkInSpreadsheet() {
        const spreadsheets = await this.rpc({
            model: "documents.document",
            method: "get_spreadsheets_to_display",
            args: [],
        });
        const dialog = new SpreadsheetSelectorDialog(this, { spreadsheets }).open();
        dialog.on("confirm", this, this._insertInSpreadsheet);
    }
    /**
     * Open a new spreadsheet or an existing one and insert a link to the action.

     * @private
     */
    async _insertInSpreadsheet({ id: spreadsheet }) {
        let documentId;
        let notificationMessage;
        const insertLinkCallback = await this._getInsertMenuCallback(!spreadsheet);
        if (!spreadsheet) {
            documentId = await createEmptySpreadsheet(this.rpc.bind(this));
            notificationMessage = this.env._t("New spreadsheet created in Documents");
        } else {
            documentId = spreadsheet.id;
            notificationMessage = _.str.sprintf(
                this.env._t("New sheet inserted in '%s'"),
                spreadsheet.name
            );
        }
        this.env.services.notification.notify({
            type: "info",
            message: notificationMessage,
            sticky: false,
        });
        const action = {
            type: "ir.actions.client",
            tag: "action_open_spreadsheet",
            params: {
                spreadsheet_id: documentId,
                initCallback: insertLinkCallback,
            },
        };
        this.trigger("do-action", { action });
    }

    /**
     * Get the function to be called when the spreadsheet is opened in order
     * to insert the link.
     *
     * @param {boolean} isEmptySpreadsheet True if the link is inserted in
     *                                     an empty spreadsheet, false
     *                                     otherwise
     *
     * @private
     * @returns Function to call
     */
    async _getInsertMenuCallback(isEmptySpreadsheet) {
        const action = this._getViewDescription();
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
                content: markdownLink(this.env.action.name, viewLink),
                col: 0,
                row: 0,
            });
        };
    }

    _getViewDescription() {
        const irFilterValues = this.model.get("irFilterValues");
        const domain = pyUtils.assembleDomains(
            [
                Domain.prototype.arrayToString(this.env.action.domain),
                Domain.prototype.arrayToString(irFilterValues.domain),
            ],
            "AND"
        );
        const action = {
            domain,
            context: irFilterValues.context,
            modelName: this.env.action.res_model,
            views: this.env.action.views.map((view) => [false, view.type]),
        };
        return {
            viewType: this.env.view.type,
            action: action,
            name: this.env.action.name,
        };
    }

    //---------------------------------------------------------------------
    // Static
    //---------------------------------------------------------------------

    /**
     * @returns {boolean}
     */
    static shouldBeDisplayed(env) {
        return env.view && env.action.type === "ir.actions.act_window" && !env.device.isMobile;
    }
}

InsertViewSpreadsheet.props = {};
InsertViewSpreadsheet.template = "documents_spreadsheet.InsertActionSpreadsheet";

FavoriteMenu.registry.add("insert-action-link-in-spreadsheet", InsertViewSpreadsheet, 1);
