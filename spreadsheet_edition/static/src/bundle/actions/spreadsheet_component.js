/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

import { DEFAULT_LINES_NUMBER } from "@spreadsheet/helpers/constants";
import { SpreadsheetDialog } from "@spreadsheet_edition/bundle/actions/spreadsheet_dialog/spreadsheet_dialog";

import { Spreadsheet, Model } from "@odoo/o-spreadsheet";

import { useSubEnv, Component } from "@odoo/owl";

/**
 * @typedef {Object} User
 * @property {string} User.name
 * @property {string} User.id
 */

/**
 * Component wrapping the <Spreadsheet> component from o-spreadsheet
 * to add user interactions extensions from odoo such as notifications,
 * error dialogs, etc.
 */
export default class SpreadsheetComponent extends Component {
    get model() {
        return this.props.model;
    }
    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notifications = useService("notification");
        this.dialog = useService("dialog");

        useSubEnv({
            getLinesNumber: this._getLinesNumber.bind(this),
            notifyUser: this.notifyUser.bind(this),
            raiseError: this.raiseError.bind(this),
            editText: this.editText.bind(this),
            askConfirmation: this.askConfirmation.bind(this),
        });

        this.pivot = undefined;
        this.confirmDialog = () => true;
    }

    /**
     * Open a dialog to ask a confirmation to the user.
     *
     * @param {string} content Content to display
     * @param {Function} confirm Callback if the user press 'Confirm'
     */
    askConfirmation(content, confirm) {
        this.dialog.add(
            SpreadsheetDialog,
            { content, confirm },
            { onClose: this.closeDialog.bind(this) }
        );
    }

    /**
     * Ask the user to edit a text
     *
     * @param {string} title Title of the popup
     * @param {Function} callback Callback to call with the entered text
     * @param {Object} options Options of the dialog. Can contain a placeholder and an error message.
     */
    editText(title, callback, options = {}) {
        this.dialog.add(
            SpreadsheetDialog,
            {
                confirm: callback,
                title: title && title.toString(),
                errorText: options.error && options.error.toString(),
                edit: true,
                inputContent: options.placeholder,
                inputType: "text",
            },
            { onClose: this.closeDialog.bind(this) }
        );
    }

    _getLinesNumber(callback) {
        this.dialog.add(
            SpreadsheetDialog,
            {
                content: _t("Select the number of records to insert"),
                confirm: callback,
                title: _t("Re-insert list"),
                edit: true,
                inputContent: DEFAULT_LINES_NUMBER,
                inputType: "number",
            },
            { onClose: this.closeDialog.bind(this) }
        );
    }

    /**
     * Close the dialog.
     */
    closeDialog() {
        document.querySelector(".o-grid>input").focus();
    }

    /**
     * Adds a notification to display to the user
     * @param {{text: string, type: string, sticky: boolean }} notification
     */
    notifyUser(notification) {
        this.notifications.add(notification.text, {
            type: notification.type,
            sticky: notification.sticky,
        });
    }

    /**
     * Open a dialog to display an error message to the user.
     *
     * @param {string} content Content to display
     */
    raiseError(content, callback) {
        this.dialog.add(
            SpreadsheetDialog,
            {
                content,
                confirm: callback,
            },
            { onClose: this.closeDialog.bind(this) }
        );
    }
}

SpreadsheetComponent.template = "spreadsheet_edition.SpreadsheetComponent";
SpreadsheetComponent.components = { Spreadsheet };
Spreadsheet._t = _t;
SpreadsheetComponent.props = {
    model: Model,
};
