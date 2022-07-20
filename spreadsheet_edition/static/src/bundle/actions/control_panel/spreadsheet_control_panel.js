/** @odoo-module **/

import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useService } from "@web/core/utils/hooks";
import { SpreadsheetName } from "./spreadsheet_name";
import { useAutoSavingWarning } from "./collaborative_cross_tab_bus_warning";

const { Component } = owl;

export class SpreadsheetControlPanel extends Component {

    setup() {
        this.controlPanelDisplay = {
            "bottom-left": false,
            "bottom-right": false,
        };
        useAutoSavingWarning(() => !this.props.isSpreadsheetSynced);
        this.actionService = useService("action");
    }

    /**
     * Called when an element of the breadcrumbs is clicked.
     *
     * @param {string} jsId
     */
    onBreadcrumbClicked(jsId) {
        this.actionService.restore(jsId);
    }
}

SpreadsheetControlPanel.template = "spreadsheet_edition.SpreadsheetControlPanel";
SpreadsheetControlPanel.components = {
    ControlPanel,
    SpreadsheetName,
};
SpreadsheetControlPanel.props = {
    spreadsheetName: String,
    isSpreadsheetSynced: {
        type: Boolean,
        optional: true
    },
    numberOfConnectedUsers: {
        type: Number,
        optional: true
    },
    isReadonly: {
        type: Boolean,
        optional: true
    },
    onSpreadsheetNameChanged: {
        type: Function,
        optional: true,
    }
};
