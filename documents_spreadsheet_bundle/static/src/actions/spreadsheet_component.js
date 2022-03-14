/** @odoo-module alias=documents_spreadsheet.SpreadsheetComponent */

import { _t } from "web.core";
import Dialog from "web.OwlDialog";
import { useSetupAction } from "@web/webclient/actions/action_hook";
import { useService } from "@web/core/utils/hooks";

import { DEFAULT_LINES_NUMBER } from "../o_spreadsheet/constants";

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
import CachedRPC from "../o_spreadsheet/cached_rpc";
import { legacyRPC, jsonToBase64 } from "../o_spreadsheet/helpers";
import { LegacyComponent } from "@web/legacy/legacy_component";

const { onMounted, onWillUnmount, useExternalListener, useState, useSubEnv } = owl;
const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

const { Spreadsheet, Model } = spreadsheet;

export default class SpreadsheetComponent extends LegacyComponent {
    setup() {
        this.orm = useService("orm");
        const user = useService("user");
        this.ui = useService("ui");

        const rpc = legacyRPC(this.orm);
        this.cacheRPC = new CachedRPC(rpc);
        this.props.exposeSpreadsheet(this);

        useSubEnv({
            newSpreadsheet: this.newSpreadsheet.bind(this),
            saveAsTemplate: this._saveAsTemplate.bind(this),
            makeCopy: this.makeCopy.bind(this),
            download: this._download.bind(this),
            delayedRPC: this.cacheRPC.delayedRPC.bind(this.cacheRPC),
            getLinesNumber: this._getLinesNumber.bind(this),
            notifyUser: this.notifyUser.bind(this),
            editText: this.editText.bind(this),
            askConfirmation: this.askConfirmation.bind(this),
            loadCurrencies: this.loadCurrencies.bind(this),
        });

        useSetupAction({
            beforeLeave: this._onLeave.bind(this),
        });

        useExternalListener(window, "beforeunload", this._onLeave.bind(this));

        this.state = useState({
            dialog: {
                isDisplayed: false,
                title: undefined,
                isEditText: false,
                errorText : undefined,
                inputContent: undefined,
                isEditInteger: false,
                inputIntegerContent: undefined,
            },
        });

        this.model = new Model(
            this.props.data,
            {
                evalContext: { env: this.env },
                transportService: this.props.transportService,
                client: {
                    id: uuidGenerator.uuidv4(),
                    name: user.name,
                    userId: user.uid,
                },
                isReadonly: this.props.isReadonly,
                snapshotRequested: this.props.snapshotRequested,
            },
            this.props.stateUpdateMessages
        );

        if (this.env.debug) {
            spreadsheet.__DEBUG__ = spreadsheet.__DEBUG__ || {};
            spreadsheet.__DEBUG__.model = this.model;
        }

        this.model.on("update", this, () => {
            if (this.props.spreadsheetSyncStatus) {
                this.props.spreadsheetSyncStatus({
                    synced: this.model.getters.isFullySynchronized(),
                    numberOfConnectedUsers: this.getConnectedUsers(),
                });
            }
        });
        this.model.on("unexpected-revision-id", this, () => {
            if (this.props.onUnexpectedRevisionId) {
                this.props.onUnexpectedRevisionId();
            }
        });
        if (this.props.showFormulas) {
            this.model.dispatch("SET_FORMULA_VISIBILITY", { show: true });
        }

        this.dialogContent = undefined;
        this.pivot = undefined;
        this.confirmDialog = () => true;

        onMounted(() => {
            if (this.props.initCallback) {
                this.props.initCallback(this.model);
            }
            if (this.props.download) {
                this._download();
            }
        });

        onWillUnmount(() => this._onLeave());
    }

    exposeSpreadsheet(spreadsheet) {
        this.spreadsheet = spreadsheet;
    }

    /**
     * Return the number of connected users. If one user has more than
     * one open tab, it's only counted once.
     * @return {number}
     */
    getConnectedUsers() {
        return new Set(
            [...this.model.getters.getConnectedClients().values()].map((client) => client.userId)
        ).size;
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
        document.querySelector("canvas").focus();
    }

    /**
     * Load currencies from database
     */
    async loadCurrencies() {
        const odooCurrencies = await this.orm.searchRead(
            "res.currency", // model
            [], // domain
            ["symbol", "full_name", "position", "name", "decimal_places"], // fields
            { // opts
                order: "active DESC, full_name ASC"
            },
            { active_test: false } // ctx
        )
        return odooCurrencies.map((currency) => {
            return {
                code: currency.name,
                symbol: currency.symbol,
                position: currency.position || "after",
                name: currency.full_name || _t("Currency"),
                decimalPlaces: currency.decimal_places || 2,
            }
        });
    }

    /**
     * Retrieve the spreadsheet_data and the thumbnail associated to the
     * current spreadsheet
     */
    getSaveData() {
        const data = this.model.exportData();
        return {
            data,
            revisionId: data.revisionId,
            thumbnail: this.getThumbnail(),
        };
    }

    getThumbnail() {
        const dimensions = spreadsheet.SPREADSHEET_DIMENSIONS;
        const canvas = document.querySelector("canvas");
        const canvasResizer = document.createElement("canvas");
        const size = this.props.thumbnailSize;
        canvasResizer.width = size;
        canvasResizer.height = size;
        const canvasCtx = canvasResizer.getContext("2d");
        // use only 25 first rows in thumbnail
        const sourceSize = Math.min(
            25 * dimensions.DEFAULT_CELL_HEIGHT,
            canvas.width,
            canvas.height
        );
        canvasCtx.drawImage(
            canvas,
            dimensions.HEADER_WIDTH - 1,
            dimensions.HEADER_HEIGHT - 1,
            sourceSize,
            sourceSize,
            0,
            0,
            size,
            size
        );
        return canvasResizer.toDataURL().replace("data:image/png;base64,", "");
    }
    /**
     * Make a copy of the current document
     */
    makeCopy() {
        const { data, thumbnail } = this.getSaveData();
        this.props.onMakeCopy({ data, thumbnail });
    }
    /**
     * Create a new spreadsheet
     */
    newSpreadsheet() {
        this.props.onNewSpreadsheet();
    }

    /**
     * Downloads the spreadsheet in xlsx format
     */
    async _download() {
        this.ui.block();
        try {
            const { files } = await this.model.exportXLSX();
            this.props.onDownload({
                name: this.props.name,
                files,
            });
        } finally {
            this.ui.unblock();
        }
    }

    /**
     * @private
     * @returns {Promise}
     */
    async _saveAsTemplate() {
        const model = new Model(this.model.exportData(), {
            mode: "headless",
            evalContext: { env: this.env },
        });
        await model.waitForIdle();
        model.dispatch("CONVERT_PIVOT_TO_TEMPLATE");
        const data = model.exportData();
        const name = this.props.name;
        this.trigger("do-action", {
            action: "documents_spreadsheet.save_spreadsheet_template_action",
            options: {
                additional_context: {
                    default_template_name: `${name} - Template`,
                    default_data: jsonToBase64(data),
                    default_thumbnail: this.getThumbnail(),
                },
            },
        });
    }
    /**
     * Open a dialog to display a message to the user.
     *
     * @param {string} content Content to display
     */
    notifyUser(content) {
        this.dialogContent = content;
        this.confirmDialog = this.closeDialog;
        this.state.dialog.isDisplayed = true;
    }

    _onLeave() {
        if (this.alreadyLeft) {
            return;
        }
        this.alreadyLeft = true;
        this.model.leaveSession();
        this.model.off("update", this);
        if (!this.props.isReadonly) {
            this.props.onSpreadsheetSaved(this.getSaveData());
        }
    }
}

SpreadsheetComponent.template = "documents_spreadsheet.SpreadsheetComponent";
SpreadsheetComponent.components = { Spreadsheet, Dialog };
Spreadsheet._t = _t;
SpreadsheetComponent.props = {
    name: String,
    data: Object,
    thumbnailSize: Number,
    isReadonly: { type: Boolean, optional: true },
    snapshotRequested: { type: Boolean, optional: true },
    showFormulas: { type: Boolean, optional: true },
    download: { type: Boolean, optional: true },
    stateUpdateMessages: { type: Array, optional: true },
    initCallback: {
        optional: true,
        type: Function,
    },
    transportService: {
        optional: true,
        type: Object,
    },
    spreadsheetSyncStatus: {
        optional: true,
        type: Function,
    },
    onDownload: {
        optional: true,
        type: Function,
    },
    onUnexpectedRevisionId: {
        optional: true,
        type: Function,
    },
    onMakeCopy: {
        type: Function,
    },
    onSpreadsheetSaved: {
        type: Function,
    },
    onNewSpreadsheet: {
        type: Function,
    },
    exposeSpreadsheet: {
        type: Function,
        optional: true,
    },
};
SpreadsheetComponent.defaultProps = {
    isReadonly: false,
    download: false,
    snapshotRequested: false,
    showFormulas: false,
    stateUpdateMessages: [],
    exposeSpreadsheet: () => {},
    onDownload: () => {},
};
