/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import Dialog from "@web/legacy/js/core/owl_dialog";
import { useService } from "@web/core/utils/hooks";

import { DEFAULT_LINES_NUMBER } from "@spreadsheet/helpers/constants";

import { Spreadsheet, Model } from "@odoo/o-spreadsheet";

import { useState, useSubEnv, Component } from "@odoo/owl";

const tags = new Set();

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

        useSubEnv({
            getLinesNumber: this._getLinesNumber.bind(this),
            notifyUser: this.notifyUser.bind(this),
            raiseError: this.raiseError.bind(this),
            editText: this.editText.bind(this),
            askConfirmation: this.askConfirmation.bind(this),
        });

        this.state = useState({
            dialog: {
                isDisplayed: false,
                title: undefined,
                isEditText: false,
                errorText: undefined,
                inputContent: undefined,
                isEditInteger: false,
                inputIntegerContent: undefined,
            },
        });

        this.dialogContent = undefined;
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
        this.dialogContent = content;
        this.confirmDialog = () => {
            confirm();
            this.closeDialog();
        };
        this.state.dialog.isDisplayed = true;
    }

    /**
     * Ask the user to edit a text
     *
     * @param {string} title Title of the popup
     * @param {Function} callback Callback to call with the entered text
     * @param {Object} options Options of the dialog. Can contain a placeholder and an error message.
     */
    editText(title, callback, options = {}) {
        this.dialogContent = undefined;
        this.state.dialog.title = title && title.toString();
        this.state.dialog.errorText = options.error && options.error.toString();
        this.state.dialog.isEditText = true;
        this.state.inputContent = options.placeholder;
        this.confirmDialog = () => {
            this.closeDialog();
            callback(this.state.inputContent);
        };
        this.state.dialog.isDisplayed = true;
    }

    _getLinesNumber(callback) {
        this.dialogContent = _t("Select the number of records to insert");
        this.state.dialog.title = _t("Re-insert list");
        this.state.dialog.isEditInteger = true;
        this.state.dialog.inputIntegerContent = DEFAULT_LINES_NUMBER;
        this.confirmDialog = () => {
            this.closeDialog();
            callback(this.state.dialog.inputIntegerContent);
        };
        this.state.dialog.isDisplayed = true;
    }

    /**
     * Close the dialog.
     */
    closeDialog() {
        this.dialogContent = undefined;
        this.confirmDialog = () => true;
        this.state.dialog.title = undefined;
        this.state.dialog.errorText = undefined;
        this.state.dialog.isDisplayed = false;
        this.state.dialog.isEditText = false;
        this.state.dialog.isEditInteger = false;
        document.querySelector(".o-grid>input").focus();
    }

    /**
     * Adds a notification to display to the user
     * @param {{text: string, tag: string}} notification
     */
    notifyUser(notification) {
        if (tags.has(notification.tag)) {
            return;
        }
        this.notifications.add(notification.text, {
            type: "warning",
            sticky: true,
            onClose: () => tags.delete(notification.tag),
        });
        tags.add(notification.tag);
    }

    /**
     * Open a dialog to display an error message to the user.
     *
     * @param {string} content Content to display
     */
    raiseError(content, callback) {
        this.dialogContent = content;
        this.confirmDialog = () => {
            this.closeDialog();
            callback?.();
        };
        this.state.dialog.isDisplayed = true;
    }
}

SpreadsheetComponent.template = "spreadsheet_edition.SpreadsheetComponent";
SpreadsheetComponent.components = { Spreadsheet, Dialog };
Spreadsheet._t = _t;
SpreadsheetComponent.props = {
    model: Model,
};
