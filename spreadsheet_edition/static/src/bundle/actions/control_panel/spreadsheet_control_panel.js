/** @odoo-module **/

import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useService } from "@web/core/utils/hooks";
import { SpreadsheetName } from "./spreadsheet_name";
import { SpreadsheetShareButton } from "@spreadsheet/components/share_button/share_button";
import { session } from "@web/session";
import { _lt } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";
import { Component, onWillUnmount, useState, onWillStart } from "@odoo/owl";
import { helpers } from "@odoo/o-spreadsheet";

/**
 * @typedef {import("@spreadsheet_edition/bundle/actions/spreadsheet_component").User} User
 */

export class SpreadsheetControlPanel extends Component {
    setup() {
        this.controlPanelDisplay = {};
        this.actionService = useService("action");
        this.userService = useService("user");
        this.ormService = useService("orm");
        this.breadcrumbs = useState(this.env.config.breadcrumbs);
        this.collaborative = useState({
            isSynced: true,
            connectedUsers: [{ name: session.username, id: session.id }],
        });
        this.locale = useState({
            mismatchedLocaleTitle: "",
        });
        const model = this.props.model;
        if (model) {
            model.on("update", this, this.syncState.bind(this));
            onWillUnmount(() => model.off("update", this));
        }
        onWillStart(async () => {
            this.userLocale = await this.ormService.call("res.lang", "get_user_spreadsheet_locale");
        });
    }

    syncState() {
        this.collaborative.isSynced = this.props.model.getters.isFullySynchronized();
        this.collaborative.connectedUsers = this.getConnectedUsers();
        if (this.userLocale) {
            this.locale.mismatchedLocaleTitle = this.mismatchedLocaleTitle;
        }
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
            users: this.collaborative.connectedUsers.map((/**@type User*/ user) => {
                return {
                    name: user.name,
                    avatar: `/web/image?model=res.users&field=avatar_128&id=${user.id}`,
                };
            }),
        });
    }

    /**
     * Return the number of connected users. If one user has more than
     * one open tab, it's only counted once.
     * @return {Array<User>}
     */
    getConnectedUsers() {
        const connectedUsers = [];
        for (const client of this.props.model.getters.getConnectedClients()) {
            if (!connectedUsers.some((user) => user.id === client.userId)) {
                connectedUsers.push({
                    id: client.userId,
                    name: client.name,
                });
            }
        }
        return connectedUsers;
    }

    get mismatchedLocaleTitle() {
        const spreadsheetLocale = this.props.model.getters.getLocale();

        const title = sprintf(
            _lt("Difference between user locale (%s) and spreadsheet locale (%s):"),
            this.userLocale.code,
            spreadsheetLocale.code
        );
        const comparison = this.getLocalesComparison(spreadsheetLocale, this.userLocale);

        return comparison ? title + "\n" + comparison : "";
    }

    getLocalesComparison(spreadsheetLocale, userLocale) {
        const differences = [];
        if (spreadsheetLocale.dateFormat !== userLocale.dateFormat) {
            differences.push(sprintf(_lt("- current Date Format: %s"), userLocale.dateFormat));
        }

        if (
            spreadsheetLocale.thousandsSeparator !== userLocale.thousandsSeparator ||
            spreadsheetLocale.decimalSeparator !== userLocale.decimalSeparator
        ) {
            differences.push(
                sprintf(
                    _lt("- current Number Format: %s"),
                    helpers.formatValue(1234567.89, { format: "#,##0.00", locale: userLocale })
                )
            );
        }

        return differences.join("\n");
    }
}

SpreadsheetControlPanel.template = "spreadsheet_edition.SpreadsheetControlPanel";
SpreadsheetControlPanel.components = {
    ControlPanel,
    SpreadsheetName,
    SpreadsheetShareButton,
};
SpreadsheetControlPanel.props = {
    spreadsheetName: String,
    model: {
        type: Object,
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
