/** @odoo-module **/

import { GraphController } from "@web/views/graph/graph_controller";
import { SpreadsheetSelectorDialog } from "../components/spreadsheet_selector_dialog/spreadsheet_selector_dialog";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";
import { removeContextUserInfo } from "../helpers";

const { onWillStart } = owl;

export const patchGraphSpreadsheet = {
    setup() {
        this._super.apply(this, arguments);
        this.userService = useService("user");
        this.notification = useService("notification");
        this.actionService = useService("action");
        this.router = useService("router");
        this.menu = useService("menu");
        onWillStart(async () => {
            this.canInsertChart = await this.userService.hasGroup("documents.group_documents_user");
        });
    },

    async onInsertInSpreadsheet() {
        const params = {
            type: "GRAPH",
            name: this.model.metaData.title,
            confirm: (args) => this.insertInSpreadsheet(args),
        };
        this.env.services.dialog.add(SpreadsheetSelectorDialog, params);
    },

    /**
     * Open a new spreadsheet or an existing one and insert the graph in it.
     *
     * @param {Object} param0
     * @param {Object} param0.spreadsheet details of the selected document
     *                                  in which the graph should be inserted. undefined if
     *                                  it's a new sheet
     * @param {number} param0.spreadsheet.id the id of the selected spreadsheet
     * @param {string} param0.spreadsheet.name the name of the selected spreadsheet
     * @param {string} param0.name Name of the graph
     *
     */
    async insertInSpreadsheet({ spreadsheet, name }) {
        let notificationMessage;
        let menuXMLId = undefined;
        const menuId = this.router.current.hash.menu_id;
        if (menuId) {
            const menu = this.menu.getMenu(menuId);
            menuXMLId = menu ? menu.xmlid || menu.id : undefined;
        }
        const actionOptions = {
            preProcessingAsyncAction: "insertChart",
            preProcessingAsyncActionData: {
                metaData: this.model.metaData,
                searchParams: {
                    ...this.model.searchParams,
                    context: removeContextUserInfo(this.model.searchParams.context),
                },
                name,
                menuXMLId,
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
};

patch(GraphController.prototype, "graph_spreadsheet", patchGraphSpreadsheet);
