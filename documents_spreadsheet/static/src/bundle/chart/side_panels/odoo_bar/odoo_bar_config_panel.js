/** @odoo-module */

import { IrMenuSelector } from "@documents_spreadsheet/assets/components/ir_menu_selector/ir_menu_selector";
import { CommonOdooChartConfigPanel } from "../common/config_panel";

export class OdooBarChartConfigPanel extends CommonOdooChartConfigPanel {
    onUpdateStacked(ev) {
        this.props.updateChart({
            stacked: ev.target.checked,
        });
    }
}

OdooBarChartConfigPanel.template = "documents_spreadsheet.OdooBarChartConfigPanel";
OdooBarChartConfigPanel.components = { IrMenuSelector };
