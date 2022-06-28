/** @odoo-module **/

import { GraphController } from "@web/views/graph/graph_controller";
import { SpreadsheetSelectorDialog } from "../components/spreadsheet_selector_dialog/spreadsheet_selector_dialog";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
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
                menuXMLId,
            },
        };
        const params = {
            type: "GRAPH",
            name: this.model.metaData.title,
            actionOptions,
        };
        this.env.services.dialog.add(SpreadsheetSelectorDialog, params);
    },
};

patch(GraphController.prototype, "graph_spreadsheet", patchGraphSpreadsheet);
