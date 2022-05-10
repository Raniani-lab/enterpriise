/** @odoo-module **/

import { patch } from "web.utils";
import spreadsheet from "../../o_spreadsheet/o_spreadsheet_extended";
import { IrMenuSelector } from "@documents_spreadsheet/assets/components/ir_menu_selector/ir_menu_selector";
import { useService } from "@web/core/utils/hooks";

patch(spreadsheet.components.ChartPanel.prototype, "document_spreadsheet.ChartPanel", {
    /**
     * @override
     */
    setup() {
        this._super.apply(...arguments);
        this.menuService = useService("menu");
    },
    get odooMenuId() {
        const menu = this.env.model.getters.getChartOdooMenu(this.props.figure.id);
        if (!menu) return undefined;
        return menu.id;
    },
    /**
     * @param {number | undefined} odooMenuId
     */
    updateOdooLink(odooMenuId) {
        if (!odooMenuId) {
            this.env.model.dispatch("LINK_ODOO_MENU_TO_CHART", {
                chartId: this.props.figure.id,
                odooMenuId: undefined,
            });
            return;
        }
        const menu = this.env.model.getters.getIrMenu(odooMenuId);
        this.env.model.dispatch("LINK_ODOO_MENU_TO_CHART", {
            chartId: this.props.figure.id,
            odooMenuId: menu.xmlid || menu.id,
        });
    },
});
spreadsheet.components.ChartPanel.components = {
    ...spreadsheet.components.ChartPanel.components,
    IrMenuSelector,
};
