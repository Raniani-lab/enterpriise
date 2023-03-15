/** @odoo-module **/
import { onMounted, onWillStart, useState, Component, useSubEnv, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { useSetupAction } from "@web/webclient/actions/action_hook";
import { _t } from "@web/core/l10n/translation";
import { downloadFile } from "@web/core/network/download";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";

import { UNTITLED_SPREADSHEET_NAME } from "@spreadsheet/helpers/constants";
import * as spreadsheet from "@odoo/o-spreadsheet";
import { migrate } from "@spreadsheet/o_spreadsheet/migration";
import { DataSources } from "@spreadsheet/data_sources/data_sources";
import { initCallbackRegistry } from "@spreadsheet/o_spreadsheet/init_callbacks";

import { loadSpreadsheetDependencies } from "@spreadsheet/helpers/helpers";

const uuidGenerator = new spreadsheet.helpers.UuidGenerator();

const { Model } = spreadsheet;
/**
 * @typedef SpreadsheetRecord
 * @property {number} id
 * @property {string} name
 * @property {string} data
 * @property {Object[]} revisions
 * @property {boolean} snapshot_requested
 * @property {Boolean} isReadonly
 */

export class AbstractSpreadsheetAction extends Component {
    setup() {
        if (!this.props.action.params) {
            // the action is coming from a this.trigger("do-action", ... ) of owl (not wowl and not legacy)
            this.params = this.props.action.context;
        } else {
            // the action is coming from wowl
            this.params = this.props.action.params;
        }
        this.isEmptySpreadsheet = this.params.is_new_spreadsheet || false;
        this.resId =
            this.params.spreadsheet_id ||
            this.params.active_id || // backward compatibility. spreadsheet_id used to be active_id
            (this.props.state && this.props.state.resId); // used when going back to a spreadsheet via breadcrumb
        this.shareId = this.params.share_id || this.props.state?.shareId;
        this.accessToken = this.params.access_token || this.props.state?.accessToken;
        this.router = useService("router");
        this.actionService = useService("action");
        this.notifications = useService("notification");
        this.orm = useService("orm");
        this.http = useService("http");
        this.user = useService("user");
        this.ui = useService("ui");
        useSetupAction({
            beforeLeave: this._leaveSpreadsheet.bind(this),
            beforeUnload: this._leaveSpreadsheet.bind(this),
            getLocalState: () => {
                return {
                    resId: this.resId,
                    shareId: this.shareId,
                    accessToken: this.accessToken,
                };
            },
        });
        useSubEnv({
            newSpreadsheet: this.createNewSpreadsheet.bind(this),
            makeCopy: this._makeCopy.bind(this),
            download: this.download.bind(this),
            downloadAsJson: this.downloadAsJson.bind(this),
        });
        this.state = useState({
            spreadsheetName: UNTITLED_SPREADSHEET_NAME,
        });

        onWillStart(async () => {
            await this.fetchData();
            this.createModel();
            await this.execInitCallbacks();
        });
        onMounted(() => {
            this.router.pushState({
                spreadsheet_id: this.resId,
                access_token: this.accessToken,
                share_id: this.shareId,
            });
            this.env.config.setDisplayName(this.state.spreadsheetName);
            this.model.on("unexpected-revision-id", this, this.onUnexpectedRevisionId.bind(this));
        });
        onWillUnmount(() => {
            this.model.off("unexpected-revision-id", this);
        });
    }

    async fetchData() {
        // if we are returning to the spreadsheet via the breadcrumb, we don't want
        // to do all the "creation" options of the actions
        if (!this.props.state) {
            await Promise.all([this._setupPreProcessingCallbacks(), loadSpreadsheetDependencies()]);
        }
        if (owl.status(this) === "destroyed") {
            return;
        }
        const [record] = await Promise.all([this._fetchData(), loadSpreadsheetDependencies()]);
        this._initializeWith(record);
    }

    createModel() {
        const dataSources = new DataSources(this.env);
        dataSources.addEventListener("data-source-updated", () => {
            const sheetId = this.model.getters.getActiveSheetId();
            this.model.dispatch("EVALUATE_CELLS", { sheetId });
        });
        this.model = new Model(
            migrate(this.spreadsheetData),
            {
                custom: { env: this.env, orm: this.orm, dataSources },
                external: {
                    fileStore: this.fileStore,
                    loadCurrencies: this.loadCurrencies.bind(this),
                },
                transportService: this.transportService,
                client: {
                    id: uuidGenerator.uuidv4(),
                    name: this.user.name,
                    userId: this.user.userId,
                },
                mode: this.isReadonly ? "readonly" : "normal",
                snapshotRequested: this.snapshotRequested,
            },
            this.stateUpdateMessages
        );
        if (this.env.debug) {
            // eslint-disable-next-line no-import-assign
            spreadsheet.__DEBUG__ = spreadsheet.__DEBUG__ || {};
            spreadsheet.__DEBUG__.model = this.model;
        }
    }

    async execInitCallbacks() {
        if (this.asyncInitCallback) {
            await this.asyncInitCallback(this.model);
        }
        if (this.initCallback) {
            this.initCallback(this.model);
        }
    }

    async _setupPreProcessingCallbacks() {
        if (this.params.preProcessingAction) {
            const initCallbackGenerator = initCallbackRegistry
                .get(this.params.preProcessingAction)
                .bind(this);
            this.initCallback = await initCallbackGenerator(this.params.preProcessingActionData);
        }
        if (this.params.preProcessingAsyncAction) {
            const initCallbackGenerator = initCallbackRegistry
                .get(this.params.preProcessingAsyncAction)
                .bind(this);
            this.asyncInitCallback = await initCallbackGenerator(
                this.params.preProcessingAsyncActionData
            );
        }
    }

    /**
     * @protected
     * @abstract
     * @param {SpreadsheetRecord} record
     */
    _initializeWith(record) {
        throw new Error("not implemented by children");
    }

    /**
     * Make a copy of the current document
     * @private
     */
    _makeCopy() {
        const { data, thumbnail } = this.getSaveData();
        this.makeCopy({ data, thumbnail });
    }

    /**
     * @private
     */
    async _leaveSpreadsheet() {
        this.model.leaveSession();
        this.model.off("update", this);
        if (!this.isReadonly) {
            return this.onSpreadsheetLeft(this.getSaveData());
        }
    }

    async makeCopy() {
        throw new Error("not implemented by children");
    }
    async createNewSpreadsheet() {
        throw new Error("not implemented by children");
    }
    async onSpreadsheetLeft() {
        throw new Error("not implemented by children");
    }

    /**
     * @returns {Promise<SpreadsheetRecord>}
     */
    async _fetchData() {
        throw new Error("not implemented by children");
    }

    /**
     * @protected
     */
    _notifyCreation() {
        this.notifications.add(this.notificationMessage, {
            type: "info",
            sticky: false,
        });
    }

    /**
     * Open a spreadsheet
     * @private
     */
    _openSpreadsheet(spreadsheetId) {
        this._notifyCreation();
        this.actionService.doAction(
            {
                type: "ir.actions.client",
                tag: this.props.action.tag,
                params: { spreadsheet_id: spreadsheetId },
            },
            { clear_breadcrumbs: true }
        );
    }

    /**
     * Reload the spreadsheet if an unexpected revision id is triggered.
     */
    onUnexpectedRevisionId() {
        this.actionService.doAction("reload_context");
    }

    /**
     * Load currencies from database
     */
    async loadCurrencies() {
        const odooCurrencies = await this.orm.searchRead(
            "res.currency", // model
            [], // domain
            ["symbol", "full_name", "position", "name", "decimal_places"], // fields
            {
                // opts
                order: "active DESC, full_name ASC",
                context: { active_test: false },
            }
        );
        return odooCurrencies.map((currency) => {
            return {
                code: currency.name,
                symbol: currency.symbol,
                position: currency.position || "after",
                name: currency.full_name || _t("Currency"),
                decimalPlaces: currency.decimal_places || 2,
            };
        });
    }

    /**
     * Downloads the spreadsheet in xlsx format
     */
    async download() {
        this.ui.block();
        try {
            await this.actionService.doAction({
                type: "ir.actions.client",
                tag: "action_download_spreadsheet",
                params: {
                    name: this.state.spreadsheetName,
                    xlsxData: this.model.exportXLSX(),
                },
            });
        } finally {
            this.ui.unblock();
        }
    }

    /**
     * Downloads the spreadsheet in json format
     */
    async downloadAsJson() {
        this.ui.block();
        try {
            const data = JSON.stringify(this.model.exportData());
            await downloadFile(
                data,
                `${this.state.spreadsheetName}.osheet.json`,
                "application/json"
            );
        } finally {
            this.ui.unblock();
        }
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
        const canvas = document.querySelector(".o-grid canvas:not(.o-figure-canvas)");
        const canvasResizer = document.createElement("canvas");
        const size = 750;
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
}
AbstractSpreadsheetAction.props = { ...standardActionServiceProps };
