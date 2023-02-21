/** @odoo-module **/
import { registry } from "@web/core/registry";
import { download } from "@web/core/network/download";
import { useService } from "@web/core/utils/hooks";
import { session } from "@web/session";

import SpreadsheetComponent from "@spreadsheet_edition/bundle/actions/spreadsheet_component";
import { SpreadsheetName } from "@spreadsheet_edition/bundle/actions/control_panel/spreadsheet_name";

import { UNTITLED_SPREADSHEET_NAME } from "@spreadsheet/helpers/constants";
import { convertFromSpreadsheetTemplate } from "@documents_spreadsheet/bundle/helpers";
import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { DocumentsSpreadsheetControlPanel } from "../components/control_panel/spreadsheet_control_panel";
import { RecordFileStore } from "@spreadsheet_edition/bundle/image/record_file_store";

const { Component, useState } = owl;

export class SpreadsheetAction extends AbstractSpreadsheetAction {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.notificationMessage = this.env._t("New spreadsheet created in Documents");
        this.state = useState({
            connectedUsers: [{ name: session.username, id: session.uid }],
            isSynced: true,
            isFavorited: false,
            spreadsheetName: UNTITLED_SPREADSHEET_NAME,
        });

        this.spreadsheetCollaborative = useService("spreadsheet_collaborative");
        this.fileStore = new RecordFileStore("documents.document", this.resId, this.http, this.orm);
    }

    async onWillStart() {
        await super.onWillStart();
        this.transportService = this.spreadsheetCollaborative.getCollaborativeChannel(
            Component.env,
            "documents.document",
            this.resId
        );
    }

    async _fetchData() {
        const record = await this.orm.call("documents.document", "join_spreadsheet_session", [
            this.resId,
        ]);
        if (this.params.convert_from_template) {
            return {
                ...record,
                raw: await convertFromSpreadsheetTemplate(this.orm, record.raw),
            };
        }
        return record;
    }

    /**
     * @override
     */
    _initializeWith(record) {
        this.state.isFavorited = record.is_favorited;
        this.spreadsheetData = record.data;
        this.stateUpdateMessages = record.revisions;
        this.snapshotRequested = record.snapshot_requested;
        this.state.spreadsheetName = record.name;
        this.isReadonly = record.isReadonly;
    }

    /**
     * @private
     * @param {Object}
     */
    async _onDownload({ name, files }) {
        await download({
            url: "/spreadsheet/xlsx",
            data: {
                zip_name: `${name}.xlsx`,
                files: JSON.stringify(files),
            },
        });
    }

    /**
     * @param {OdooEvent} ev
     * @returns {Promise}
     */
    async _onSpreadSheetFavoriteToggled(ev) {
        this.state.isFavorited = !this.state.isFavorited;
        return await this.orm.call("documents.document", "toggle_favorited", [[this.resId]]);
    }

    /**
     * Updates the control panel with the sync status of spreadsheet
     *
     * @param {Object}
     */
    _onSpreadsheetSyncStatus({ synced, connectedUsers }) {
        this.state.isSynced = synced;
        this.state.connectedUsers = connectedUsers;
    }

    /**
     * Reload the spreadsheet if an unexpected revision id is triggered.
     */
    _onUnexpectedRevisionId() {
        this.actionService.doAction("reload_context");
    }

    /**
     * Create a copy of the given spreadsheet and display it
     */
    async _onMakeCopy({ data, thumbnail }) {
        const defaultValues = {
            mimetype: "application/o-spreadsheet",
            spreadsheet_data: JSON.stringify(data),
            spreadsheet_snapshot: false,
            thumbnail,
        };
        const id = await this.orm.call("documents.document", "copy", [this.resId], {
            default: defaultValues,
        });
        this._openSpreadsheet(id);
    }

    /**
     * Create a new sheet and display it
     */
    async _onNewSpreadsheet() {
        const action = await this.orm.call("documents.document", "action_open_new_spreadsheet");
        this._notifyCreation();
        this.actionService.doAction(action, { clear_breadcrumbs: true });
    }

    async _onSpreadsheetSaved({ thumbnail }) {
        await this.orm.write("documents.document", [this.resId], { thumbnail });
    }

    /**
     * Saves the spreadsheet name change.
     * @param {Object} detail
     * @returns {Promise}
     */
    async _onSpreadSheetNameChanged(detail) {
        const { name } = detail;
        this.state.spreadsheetName = name;
        this.env.config.setDisplayName(this.state.spreadsheetName);
        return await this.orm.write("documents.document", [this.resId], { name });
    }
}

SpreadsheetAction.template = "documents_spreadsheet.SpreadsheetAction";
SpreadsheetAction.components = {
    SpreadsheetComponent,
    DocumentsSpreadsheetControlPanel,
    SpreadsheetName,
};

registry.category("actions").add("action_open_spreadsheet", SpreadsheetAction, { force: true });
