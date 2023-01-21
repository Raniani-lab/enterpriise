/** @odoo-module **/

import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useService } from "@web/core/utils/hooks";
import { SpreadsheetName } from "./spreadsheet_name";

const { Component, useState } = owl;

/**
 * @typedef {import("@spreadsheet_edition/bundle/actions/spreadsheet_component").User} User
 */

export class SpreadsheetControlPanel extends Component {
    setup() {
        this.controlPanelDisplay = {
            "bottom-left": false,
            "bottom-right": false,
        };
        this.actionService = useService("action");
        this.breadcrumbs = useState(this.env.config.breadcrumbs);
    }

    /**
     * Called when an element of the breadcrumbs is clicked.
     *
     * @param {string} jsId
     */
    onBreadcrumbClicked(jsId) {
        this.actionService.restore(jsId);
    }

    get tooltipInfo() {
        return JSON.stringify({
            users: this.props.connectedUsers.map((/**@type User*/ user) => {
                return {
                    name: user.name,
                    avatar: `/web/image?model=res.users&field=avatar_128&id=${user.id}`,
                };
            }),
        });
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
        optional: true,
    },
    connectedUsers: {
        type: Array,
        optional: true,
    },
    isReadonly: {
        type: Boolean,
        optional: true,
    },
    onSpreadsheetNameChanged: {
        type: Function,
        optional: true,
    },
};
