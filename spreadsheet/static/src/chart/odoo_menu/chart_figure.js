/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { useService } from "@web/core/utils/hooks";

patch(spreadsheet.components.ChartFigure.prototype, "spreadsheet.ChartFigure", {
    setup() {
        this._super();
        this.menuService = useService("menu");
        this.actionService = useService("action");
    },
    async navigateToOdooMenu() {
        const menu = this.env.model.getters.getChartOdooMenu(this.props.figureId);
        if (!menu) {
            throw new Error(`Cannot find any menu associated with the chart`);
        }
        await this.actionService.doAction(menu.actionID);
    },
    get hasOdooMenu() {
        return this.env.model.getters.getChartOdooMenu(this.props.figureId) !== undefined;
    },
});
