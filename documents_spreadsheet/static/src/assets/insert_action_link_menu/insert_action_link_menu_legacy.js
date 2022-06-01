/** @odoo-module */

import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import FavoriteMenu from "web.FavoriteMenu";
import pyUtils from "web.py_utils";
import Domain from "web.Domain";
import { useService } from "@web/core/utils/hooks";
import { useModel } from "web.Model";
import { sprintf } from "@web/core/utils/strings"
import { LegacyComponent } from "@web/legacy/legacy_component";
import { SpreadsheetSelectorDialog } from "../components/spreadsheet_selector_dialog/spreadsheet_selector_dialog";


export class InsertViewSpreadsheet extends LegacyComponent {
    setup() {
        this.model = useModel("searchModel");
        this.notification = useService("notification");
        this.dialogManager = useService("dialog");
    }

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * @private
     */
    linkInSpreadsheet() {
        this.dialogManager.add(SpreadsheetSelectorDialog, {
            type: "LINK",
            name: this.env.action.name,
            confirm: (args) => this._insertInSpreadsheet(args),
        });
    }

    /**
     * Open a new spreadsheet or an existing one and insert a link to the action.
     * @private
     */
    async _insertInSpreadsheet({ spreadsheet, name }) {
        const actionToLink = this._getViewDescription();
        actionToLink.name = name;
        // do action with action link
        let notificationMessage;
        const actionOptions = {
            preProcessingAction: "insertLink",
            preProcessingActionData: actionToLink,
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

        this.notification.notify({ title: "", message: notificationMessage, type: "info" });
        this.trigger("do-action", {
            action: "action_open_spreadsheet",
            options: { additional_context: actionOptions },
        });
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
InsertViewSpreadsheet.components = { DropdownItem };

FavoriteMenu.registry.add("insert-action-link-in-spreadsheet", InsertViewSpreadsheet, 1);
