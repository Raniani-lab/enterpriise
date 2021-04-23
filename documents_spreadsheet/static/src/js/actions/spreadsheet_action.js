odoo.define("documents_spreadsheet/static/src/js/actions/spreadsheet_action.js", function (require) {
    "use strict";

    const AbstractAction = require("documents_spreadsheet/static/src/js/actions/spreadsheet_abstract_action.js");
    const core = require("web.core");
    const SpreadsheetCollaborativeChannel = require("documents_spreadsheet.SpreadsheetCollaborativeChannel");

    const { _lt, _t } = core;

    const SpreadsheetAction = AbstractAction.extend({
        custom_events: {
            ...AbstractAction.prototype.custom_events,
            favorite_toggled: "_onSpreadSheetFavoriteToggled",
            spreadsheet_sync_status: "_onSpreadsheetSyncStatus"
        },
        notificationMessage: _lt("New spreadsheet created in Documents"),


        /**
         * @override
         */
        init(parent, action) {
            this._super(...arguments);
            this.isFavorited = false;
            this.transportService = action.params.transportService
                || new SpreadsheetCollaborativeChannel(owl.Component.env, this.res_id);
        },

        /**
         * @override
         */
        start() {
            this.controlPanelProps.isFavorited = this.isFavorited
            this.controlPanelProps.isSpreadsheetSynced = true;
            this.controlPanelProps.numberOfConnectedUsers = 1;
            return this._super.apply(this, arguments);
        },

        async _fetchSpreadsheetData(id) {
            return this._rpc({
                model: "documents.document",
                method: "join_spreadsheet_session",
                args: [id],
            });
        },

        _updateData(record) {
            this._super(record);
            this.isFavorited = record.is_favorited;
            this.spreadsheetData = JSON.parse(record.raw);
            this.stateUpdateMessages = record.revisions;
            this.snapshotRequested = record.snapshot_requested;
        },

        /**
         * Create a copy of the given spreadsheet and display it
         */
        _makeCopy({ data, thumbnail }) {
            return this._rpc({
                model: "documents.document",
                method: "copy",
                args: [
                    this.res_id,
                    {
                        mimetype: "application/o-spreadsheet",
                        raw: data,
                        spreadsheet_snapshot: false,
                        thumbnail,
                    },
                ],
            });
        },
        /**
         * Create a new sheet
         */
        _createNewSpreadsheet() {
            return this._rpc({
                model: "documents.document",
                method: "create",
                args: [
                    {
                        name: _t("Untitled spreadsheet"),
                        mimetype: "application/o-spreadsheet",
                        raw: "{}",
                        handler: "spreadsheet",
                    },
                ],
            });
        },
        /**
         * Saves the spreadsheet name change.
         *
         * @private
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _saveName(name) {
            return this._rpc({
                model: "documents.document",
                method: "write",
                args: [[this.res_id], {
                    name,
                }],
            });
        },
        /**
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _onSpreadSheetFavoriteToggled(ev) {
            return this._rpc({
                model: "documents.document",
                method: "toggle_favorited",
                args: [[this.res_id]],
            });
        },

        /**
         * Updates the control panel with the sync status of spreadsheet
         *
         * @param {OdooEvent} ev
         */
        _onSpreadsheetSyncStatus(ev) {
            this.updateControlPanel({
                isSpreadsheetSynced: ev.data.synced,
                numberOfConnectedUsers: ev.data.numberOfConnectedUsers,
            });
        },

        _saveSpreadsheet(data, thumbnail, revisionId) {
            return this._rpc({
                model: "documents.document",
                method: "write",
                args: [
                    [this.res_id],
                    {
                        "thumbnail": thumbnail,
                        "raw": data,
                    }
                ],
            });
        }
    });

    core.action_registry.add("action_open_spreadsheet", SpreadsheetAction);

    return SpreadsheetAction;
});
