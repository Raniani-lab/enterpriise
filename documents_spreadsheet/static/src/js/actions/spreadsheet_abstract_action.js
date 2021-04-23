odoo.define("documents_spreadsheet/static/src/js/actions/spreadsheet_abstract_action.js", function (require) {
    "use strict";

    const AbstractAction = require("web.AbstractAction");
    const core = require("web.core");
    const { ComponentWrapper } = require("web.OwlCompatibility");
    const SpreadsheetComponent = require("documents_spreadsheet.SpreadsheetComponent");
    const SpreadsheetControlPanel = require("documents_spreadsheet.ControlPanel");

    const _t = core._t;

    const SpreadsheetAbstractAction = AbstractAction.extend({
        config: {
            ...AbstractAction.prototype.config,
            ControlPanel: SpreadsheetControlPanel
        },
        jsLibs: [
            '/web/static/lib/Chart/Chart.js',
        ],
        contentTemplate: "documents_spreadsheet.SpreadsheetAction",
        events: {},
        custom_events: {
            spreadsheet_name_changed: "_onSpreadSheetNameChanged",
            make_copy: "_onMakeCopy",
            new_spreadsheet: "_onNewSpreadsheet",
            spreadsheet_saved: "_onSpreadsheetSaved",
            unexpected_revision_id: "_onUnexpectedRevisionId",
        },
        hasControlPanel: true,
        thumbnailSize: 750,

        /**
         * @override
         * @param {Object} parent
         * @param {Object} action
         * @param {string} action.tag Tag of the action
         * @param {Object} action.params
         * @param {string} action.params.active_id Document id of the spreadsheet
         * @param {boolean} [action.params.showFormulas] At the start of spreadsheet, should display value or formula
         * @param {Function} [action.params.initCallback] Callback to execute at the start of spreadsheet
         * @param {Class} [action.params.transportService] Transport service to use in realtime collaborative editing.
         *                                                 If no transport service is provided, use the
         *                                                 SpreadsheetCollaborativeChannel.
         */
        init(parent, action) {
            this._super.apply(this, arguments);
            this.tag = action.tag;
            this.res_id = action.params.active_id;
            this.showFormulas = action.params.showFormulas || false;
            this.initCallback = action.params.initCallback || false;

            this.spreadsheetComponent = false;
            this.spreadsheetName = false;
            this.spreadsheetData = false;
            this.stateUpdateMessages = [];
            this.cancelFirst = true;
        },

        /**
         * @override
         */
        willStart() {
            return Promise.all([
                this._super.apply(this, arguments),
                this._loadData(),
            ])
        },

        /**
         * @override
         */
        async start() {
            this._setTitle(this.spreadsheetName);
            if (!this.spreadsheetData) {
                return this.do_action({
                    type: "ir.actions.client",
                    tag: "home",
                });
            }
            await this._super.apply(this, arguments);

            const container = this.el.getElementsByClassName("o_spreadsheet_action")[0];

            this.spreadsheetComponent = new ComponentWrapper(this, SpreadsheetComponent, {
                res_id: this.res_id,
                name: this.spreadsheetName,
                data: this.spreadsheetData,
                stateUpdateMessages: this.stateUpdateMessages,
                showFormulas: this.showFormulas,
                initCallback: this.initCallback,
                transportService: this.transportService,
                thumbnailSize: this.thumbnailSize,
                snapshotRequested: this.snapshotRequested,
            });
            await this.spreadsheetComponent.mount(container);
            this.spreadsheetComponent._addListener("make_copy");
            this.spreadsheetComponent._addListener("new_spreadsheet");
        },

        destroy() {
            if (this.spreadsheetComponent) {
                this.spreadsheetComponent.destroy();
            }
            this._super.apply(this, arguments);
        },

        /**
         * @override
         */
        getTitle() {
            // Return "Spreadsheet" as the action name while the spreadsheet name is not loaded or
            // the actual spreadsheet name once loaded.
            return this.spreadsheetName === false ? _t("Spreadsheet") : this.spreadsheetName;
        },

        async _loadData() {
            if (this.res_id === undefined) {
                return;
            }
            const record = await this._fetchSpreadsheetData(this.res_id);
            if (record) {
                this._updateData(record);
            }
        },

        _updateData({ name }) {
            if (name !== undefined) {
                this.spreadsheetName = name;
            }
        },

        /**
         * Create a copy of the given spreadsheet and display it
         */
        async _onMakeCopy({ data }) {
            const id = await this._makeCopy(data);
            this._openSpreadsheet(id);
        },

        /**
         * Create a new sheet and display it
         */
        async _onNewSpreadsheet() {
            const id = await this._createNewSpreadsheet();
            this._openSpreadsheet(id);
        },

        /**
         * Saves the spreadsheet name change.
         *
         * @private
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _onSpreadSheetNameChanged(ev) {
            const { name } = ev.data;
            this.spreadsheetName = name;
            this.spreadsheetComponent.update({ name });
            return this._saveName(name);
        },

        _onSpreadsheetSaved(ev) {
            const { data, thumbnail, revisionId } = ev.data;
            this._saveSpreadsheet(data, thumbnail, revisionId);
        },

        /**
         * Reload the spreadsheet if an unexpected revision id is triggered.
         *
         * @private
         */
        _onUnexpectedRevisionId() {
            this.do_action("reload_context");
        },

        /**
         * Open a spreadsheet
         */
        _openSpreadsheet(active_id) {
            this.displayNotification({
                type: "info",
                message: this.notificationMessage,
                sticky: false,
            });
            this.do_action(
                {
                    type: "ir.actions.client",
                    tag: this.tag,
                    params: { active_id },
                },
                { clear_breadcrumbs: true }
            );
        },

        async _createNewSpreadsheet() {
            /** ... */
        },

        async _makeCopy(data) {
            /** ... */
        },

        async _saveName(name) {
            /** ... */
        },

        async _fetchSpreadsheetData(id) {
            /** ... */
        },

        /**
         * @param {string} data stringifyed spreadsheet data
         * @param {string} thumbnail
         */
        async _saveSpreadsheet(data, thumbnail) {
            /** ... */
        },
    });

    return SpreadsheetAbstractAction;
});
