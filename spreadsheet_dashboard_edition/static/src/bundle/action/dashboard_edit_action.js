/** @odoo-module */

import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { registry } from "@web/core/registry";
import SpreadsheetComponent from "@spreadsheet_edition/bundle/actions/spreadsheet_component";
import { SpreadsheetControlPanel } from "@spreadsheet_edition/bundle/actions/control_panel/spreadsheet_control_panel";
import { useService } from "@web/core/utils/hooks";
import { RecordFileStore } from "@spreadsheet_edition/bundle/image/record_file_store";
import { session } from "@web/session";

/**
 * @typedef {import("@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action").SpreadsheetRecord} SpreadsheetRecord
 *
 * @typedef State
 * @property {Array} connectedUsers
 * @property {boolean} isSynced
 *
 * @typedef {import("@spreadsheet_edition/bundle/o_spreadsheet/collaborative/spreadsheet_collaborative_service").SpreadsheetCollaborativeService} SpreadsheetCollaborativeService
 */

const { useState, Component, useSubEnv } = owl;

export class DashboardEditAction extends AbstractSpreadsheetAction {
    setup() {
        super.setup();
        /** @type {State} */
        this.collaborativeState = useState({
            connectedUsers: [{ name: session.username, id: session.id }],
            isSynced: true,
        });
        useSubEnv({
            // TODO clean this env key
            isDashboardSpreadsheet: true,
        });

        /** @type {SpreadsheetCollaborativeService} */
        this.spreadsheetCollaborative = useService("spreadsheet_collaborative");
        this.fileStore = new RecordFileStore(
            "spreadsheet.dashboard",
            this.resId,
            this.http,
            this.orm
        );
    }

    async onWillStart() {
        await super.onWillStart();
        this.transportService = this.spreadsheetCollaborative.getCollaborativeChannel(
            Component.env,
            "spreadsheet.dashboard",
            this.resId
        );
    }

    /**
     * @override
     * @returns {Promise<SpreadsheetRecord>}
     */
    async _fetchData() {
        const record = await this.orm.call("spreadsheet.dashboard", "join_spreadsheet_session", [
            this.resId,
        ]);
        return record;
    }

    /**
     * @override
     * @param {SpreadsheetRecord} record
     */
    _initializeWith(record) {
        this.spreadsheetData = record.data;
        this.stateUpdateMessages = record.revisions;
        this.snapshotRequested = record.snapshot_requested;
        this.state.spreadsheetName = record.name;
        this.isReadonly = record.isReadonly;
    }

    /**
     * Updates the control panel with the sync status of spreadsheet
     *
     * @param {{ synced: boolean, connectedUsers: Array<any> }}
     */
    _onSpreadsheetSyncStatus({ synced, connectedUsers }) {
        this.collaborativeState.isSynced = synced;
        this.collaborativeState.connectedUsers = connectedUsers;
    }

    async _onSpreadSheetNameChanged(detail) {
        const { name } = detail;
        this.state.spreadsheetName = name;
        this.env.config.setDisplayName(this.state.spreadsheetName);
        await this.orm.write("spreadsheet.dashboard", [this.resId], {
            name,
        });
    }

    async _onDownload() {
        //TODO
    }

    /**
     * Reload the spreadsheet if an unexpected revision id is triggered.
     */
    _onUnexpectedRevisionId() {
        this.actionService.doAction("reload_context");
    }

    async _onSpreadsheetLeft({ thumbnail }) {
        await this.orm.write("spreadsheet.dashboard", [this.resId], { thumbnail });
    }
}

DashboardEditAction.template = "spreadsheet_dashboard_edition.DashboardEditAction";
DashboardEditAction.components = {
    SpreadsheetControlPanel,
    SpreadsheetComponent,
};

registry.category("actions").add("action_edit_dashboard", DashboardEditAction, { force: true });
