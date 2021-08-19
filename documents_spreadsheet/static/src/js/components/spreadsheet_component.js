odoo.define("documents_spreadsheet.SpreadsheetComponent", function (require) {
    "use strict";

    const core = require("web.core");
    const Dialog = require("web.OwlDialog");

    const { jsonToBase64 } = require("documents_spreadsheet.pivot_utils");
    const PivotDialog = require("documents_spreadsheet.PivotDialog")
    const spreadsheet = require("documents_spreadsheet.spreadsheet_extended");
    const { useService } = require("@web/core/utils/hooks");

    const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

    const Spreadsheet = spreadsheet.Spreadsheet;
    const Model = spreadsheet.Model;
    const { useState, useRef, useSubEnv, useExternalListener } = owl.hooks;
    const _t = core._t;

    class SpreadsheetComponent extends owl.Component {
        constructor(parent, props) {
            super(...arguments);
            const user = useService("user");
            this.ui = useService("ui");
            useSubEnv({
                newSpreadsheet: this.newSpreadsheet.bind(this),
                saveAsTemplate: this._saveAsTemplate.bind(this),
                makeCopy: this.makeCopy.bind(this),
                openPivotDialog: this.openPivotDialog.bind(this),
                download: this._download.bind(this),
            });
            this.state = useState({
                dialog: {
                    isDisplayed: false,
                    title: undefined,
                    isEditText: false,
                    inputContent: undefined,
                },
                pivotDialog: {
                    isDisplayed: false,
                },
            });
            this.spreadsheet = useRef("spreadsheet");
            this.dialogContent = undefined;
            this.pivot = undefined;
            this.insertPivotValueCallback = undefined;
            this.confirmDialog = () => true;
            this.data = props.data;
            this.stateUpdateMessages = props.stateUpdateMessages;
            this.res_id = props.res_id;
            this.client = {
                id: uuidGenerator.uuidv4(),
                name: user.name,
                userId: user.userId,
            }
            this.transportService = this.props.transportService;
            useExternalListener(window, "beforeunload", this._onLeave.bind(this));
        }

        get model() {
            return this.spreadsheet.comp.model;
        }

        mounted() {
            this.spreadsheet.comp.model.on("update", this, () => this.trigger("spreadsheet-sync-status", {
                synced: this.model.getters.isFullySynchronized(),
                numberOfConnectedUsers: this.getConnectedUsers(),
            }));
            if (this.props.showFormulas) {
                this.spreadsheet.comp.model.dispatch("SET_FORMULA_VISIBILITY", { show: true });
            }
            if (this.props.initCallback) {
                this.props.initCallback(this.spreadsheet.comp.model);
            }
            if (this.props.download) {
                this._download();
            }
        }

        /**
         * Return the number of connected users. If one user has more than
         * one open tab, it's only counted once.
         * @return {number}
         */
        getConnectedUsers() {
            return new Set([...this.model.getters.getConnectedClients().values()].map((client) => client.userId)).size;
        }

        willUnmount() {
            this._onLeave();
        }
        /**
         * Open a dialog to ask a confirmation to the user.
         *
         * @param {CustomEvent} ev
         * @param {string} ev.detail.content Content to display
         * @param {Function} ev.detail.confirm Callback if the user press 'Confirm'
         */
        askConfirmation(ev) {
            this.dialogContent = ev.detail.content;
            this.confirmDialog = () => {
                ev.detail.confirm();
                this.closeDialog();
            };
            this.state.dialog.isDisplayed = true;
        }

        editText(ev) {
            this.dialogContent = undefined;
            this.state.dialog.title = ev.detail.title && ev.detail.title.toString();
            this.state.dialog.isEditText = true;
            this.state.inputContent = ev.detail.placeholder;
            this.confirmDialog = () => {
                this.closeDialog();
                ev.detail.callback(this.state.inputContent);
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
            this.state.dialog.isDisplayed = false;
            this.state.dialog.isEditText = false;
        }
        /**
         * Close the pivot dialog.
         */
        closePivotDialog() {
            this.state.pivotDialog.isDisplayed = false;
            this.spreadsheet.comp.focusGrid();
        }
        /**
         * Insert a value of the spreadsheet using the callbackfunction;
         */
        _onCellClicked(ev) {
            this.insertPivotValueCallback(ev.detail.formula);
            this.closePivotDialog();
        }
        /**
         * Retrieve the spreadsheet_data and the thumbnail associated to the
         * current spreadsheet
         */
        getSaveData() {
            const data = this.spreadsheet.comp.model.exportData();
            return {
                data,
                revisionId: data.revisionId,
                thumbnail: this.getThumbnail()
            };
        }
        getMissingValueDialogTitle() {
            const title = _t("Insert pivot cell");
            const pivotTitle = this.getPivotTitle();
            if (pivotTitle) {
                return `${title} - ${pivotTitle}`
            }
            return title;
        }

        getPivotTitle() {
            if (this.pivot) {
                const getters = this.spreadsheet.comp.model.getters;
                const name = getters.isCacheLoaded(this.pivot.id)
                    ? getters.getCache(this.pivot.id).getModelLabel()
                    : this.pivot.model;
                const id = this.pivot.id;
                return `${name} (#${id})`;
            }
            return "";
        }
        getThumbnail() {
            const dimensions = spreadsheet.SPREADSHEET_DIMENSIONS;
            const canvas = this.spreadsheet.comp.grid.comp.canvas.el;
            const canvasResizer = document.createElement("canvas");
            const size = this.props.thumbnailSize
            canvasResizer.width = size;
            canvasResizer.height = size;
            const canvasCtx = canvasResizer.getContext("2d");
            // use only 25 first rows in thumbnail
            const sourceSize = Math.min(25 * dimensions.DEFAULT_CELL_HEIGHT, canvas.width, canvas.height);
            canvasCtx.drawImage(canvas, dimensions.HEADER_WIDTH - 1, dimensions.HEADER_HEIGHT - 1, sourceSize, sourceSize, 0, 0, size, size);
            return canvasResizer.toDataURL().replace("data:image/png;base64,", "");
        }
        /**
         * Make a copy of the current document
         */
        makeCopy() {
            const { data, thumbnail } = this.getSaveData();
            this.trigger("make-copy", {
                data,
                thumbnail,
            });
        }
        /**
         * Create a new spreadsheet
         */
        newSpreadsheet() {
            this.trigger("new-spreadsheet");
        }

        /**
         * Downloads the spreadsheet in xlsx format
         */
        async _download() {
            const model = this.spreadsheet.comp.model;
            await Promise.all(model.getters.getPivots().map((pivot) => model.getters.getAsyncCache(pivot.id, {
                initialDomain: false,
                force: true
            })));
            await Promise.all(model.getters.getGlobalFilters().map((filter) => model.getters.getFilterDisplayValue(filter.label)));

            this.ui.block();
            try {
                const { files } = await this.spreadsheet.comp.env.exportXLSX();
                this.trigger("download", {
                    name: this.props.name,
                    files,
                });
            }
            finally {
                this.ui.unblock();
            }
        }

        /**
         * @private
         * @returns {Promise}
         */
        async _saveAsTemplate() {
            const model = new Model(
                this.spreadsheet.comp.model.exportData(), {
                mode: "headless",
                evalContext: { env: this.env }
            });
            await Promise.all(model.getters.getPivots().map((pivot) => model.getters.getAsyncCache(pivot.id, {
                initialDomain: true,
                force: true
            })));
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
         * @param {CustomEvent} ev
         * @param {string} ev.detail.content Content to display
         */
        notifyUser(ev) {
            this.dialogContent = ev.detail.content;
            this.confirmDialog = this.closeDialog;
            this.state.dialog.isDisplayed = true;
        }

        openPivotDialog(ev) {
            this.pivot = this.spreadsheet.comp.model.getters.getPivot(ev.pivotId);
            this.cache = this.spreadsheet.comp.model.getters.getCache(ev.pivotId);
            this.insertPivotValueCallback = ev.insertPivotValueCallback;
            this.state.pivotDialog.isDisplayed = true;
        }
        _onLeave() {
            if (this.alreadyLeft) {
                return;
            }
            this.alreadyLeft = true;
            this.spreadsheet.comp.model.off("update", this);
            this.trigger("spreadsheet-saved", this.getSaveData());
        }
    }

    SpreadsheetComponent.template = "documents_spreadsheet.SpreadsheetComponent";
    SpreadsheetComponent.components = { Spreadsheet, Dialog, PivotDialog };

    return SpreadsheetComponent;
});
