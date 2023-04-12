/** @odoo-module **/
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { x2ManyCommands } from "@web/core/orm_service";

import SpreadsheetComponent from "@spreadsheet_edition/bundle/actions/spreadsheet_component";
import { SpreadsheetName } from "@spreadsheet_edition/bundle/actions/control_panel/spreadsheet_name";

import { Model } from "@odoo/o-spreadsheet";
import { UNTITLED_SPREADSHEET_NAME } from "@spreadsheet/helpers/constants";
import { convertFromSpreadsheetTemplate } from "@documents_spreadsheet/bundle/helpers";
import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { DocumentsSpreadsheetControlPanel } from "../components/control_panel/spreadsheet_control_panel";
import { RecordFileStore } from "@spreadsheet_edition/bundle/image/record_file_store";
import { sprintf } from "@web/core/utils/strings";
import { _t } from "@web/core/l10n/translation";

import { Component, useState, useSubEnv } from "@odoo/owl";

export class SpreadsheetAction extends AbstractSpreadsheetAction {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.notificationMessage = this.env._t("New spreadsheet created in Documents");
        this.state = useState({
            isFavorited: false,
            spreadsheetName: UNTITLED_SPREADSHEET_NAME,
        });

        this.spreadsheetCollaborative = useService("spreadsheet_collaborative");
        this.fileStore = new RecordFileStore("documents.document", this.resId, this.http, this.orm);
        this.transportService = this.spreadsheetCollaborative.getCollaborativeChannel(
            Component.env,
            "documents.document",
            this.resId,
            this.shareId,
            this.accessToken
        );
        useSubEnv({
            saveAsTemplate: this.saveAsTemplate.bind(this),
        });
    }

    async _fetchData() {
        const record = await this.orm.call("documents.document", "join_spreadsheet_session", [
            this.resId,
            this.shareId,
            this.accessToken,
        ]);
        if (this.params.convert_from_template) {
            return {
                ...record,
                data: await convertFromSpreadsheetTemplate(this.env, record.data, record.revisions),
                snapshot_requested: true,
                revisions: [],
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
        this.record = record;
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
     * Create a copy of the given spreadsheet and display it
     */
    async makeCopy({ data, thumbnail }) {
        const defaultValues = {
            mimetype: "application/o-spreadsheet",
            handler: "spreadsheet",
            spreadsheet_data: JSON.stringify(data),
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
    async createNewSpreadsheet() {
        const action = await this.orm.call("documents.document", "action_open_new_spreadsheet");
        this._notifyCreation();
        this.actionService.doAction(action, { clear_breadcrumbs: true });
    }

    async onSpreadsheetLeft({ data, thumbnail }) {
        if (this.accessToken) {
            return;
        }
        await this.orm.write("documents.document", [this.resId], {
            is_multipage: data.sheets?.length > 1 || false,
            thumbnail,
        });
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

    /**
     * @private
     * @returns {Promise}
     */
    async saveAsTemplate() {
        const model = new Model(this.model.exportData(), {
            custom: {
                env: this.env,
                dataSources: this.model.config.custom.dataSources,
            },
        });
        await model.config.custom.dataSources.waitForAllLoaded();
        const proms = [];
        for (const pivotId of model.getters.getPivotIds()) {
            proms.push(model.getters.getPivotDataSource(pivotId).prepareForTemplateGeneration());
        }
        await Promise.all(proms);
        model.dispatch("CONVERT_PIVOT_TO_TEMPLATE");
        const data = model.exportData();
        const name = this.state.spreadsheetName;

        this.actionService.doAction("documents_spreadsheet.save_spreadsheet_template_action", {
            additionalContext: {
                default_template_name: sprintf(_t("%s - Template"), name),
                default_spreadsheet_data: JSON.stringify(data),
                default_thumbnail: this.getThumbnail(),
            },
        });
    }

    async shareSpreadsheet(data, excelExport) {
        const vals = {
            document_ids: [x2ManyCommands.replaceWith([this.resId])],
            folder_id: this.record.folder_id,
            type: "ids",
            spreadsheet_shares: [
                {
                    document_id: this.resId,
                    spreadsheet_data: JSON.stringify(data),
                    excel_files: excelExport.files,
                },
            ],
        };
        const url = await this.orm.call("documents.share", "action_get_share_url", [vals]);
        return url;
    }
}

SpreadsheetAction.template = "documents_spreadsheet.SpreadsheetAction";
SpreadsheetAction.components = {
    SpreadsheetComponent,
    DocumentsSpreadsheetControlPanel,
    SpreadsheetName,
};

registry.category("actions").add("action_open_spreadsheet", SpreadsheetAction, { force: true });
