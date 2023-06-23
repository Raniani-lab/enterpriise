/** @odoo-module **/
import { registry } from "@web/core/registry";
import { _t } from "@web/legacy/js/services/core";

import SpreadsheetComponent from "@spreadsheet_edition/bundle/actions/spreadsheet_component";
import { useService } from "@web/core/utils/hooks";
import { AbstractSpreadsheetAction } from "@spreadsheet_edition/bundle/actions/abstract_spreadsheet_action";
import { DocumentsSpreadsheetControlPanel } from "@documents_spreadsheet/bundle/components/control_panel/spreadsheet_control_panel";

import { Component } from "@odoo/owl";

export class SpreadsheetTemplateAction extends AbstractSpreadsheetAction {
    setup() {
        super.setup();
        this.notificationMessage = this.env._t("New spreadsheet template created");
        this.orm = useService("orm");

        this.spreadsheetCollaborative = useService("spreadsheet_collaborative");
        this.transportService = this.spreadsheetCollaborative.getCollaborativeChannel(
            Component.env,
            "spreadsheet.template",
            this.resId
        );
    }

    _initializeWith(record) {
        this.spreadsheetData = record.data;
        this.state.spreadsheetName = record.name;
        this.isReadonly = record.isReadonly;
        this.stateUpdateMessages = record.revisions;
        this.snapshotRequested = record.snapshot_requested;
    }

    createModel() {
        super.createModel();
        this.model.dispatch("SET_FORMULA_VISIBILITY", { show: true });
    }

    /**
     * Fetch all the necessary data to open a spreadsheet template
     * @returns {Object}
     */
    async _fetchData() {
        return this.orm.call("spreadsheet.template", "join_spreadsheet_session", [this.resId]);
    }

    /**
     * Create a new empty spreadsheet template
     * @returns {number} id of the newly created spreadsheet template
     */
    async createNewSpreadsheet() {
        const data = {
            name: _t("Untitled spreadsheet template"),
        };
        const id = await this.orm.create("spreadsheet.template", [data]);
        this._openSpreadsheet(id);
        return id;
    }

    /**
     * Save the data and thumbnail on the given template
     * @param {number} spreadsheetTemplateId
     * @param {Object} values values to save
     * @param {Object} values.data exported spreadsheet data
     * @param {string} values.thumbnail spreadsheet thumbnail
     */
    async onSpreadsheetLeft({ thumbnail }) {
        await this.orm.write("spreadsheet.template", [this.resId], { thumbnail });
    }

    /**
     * Save a new name for the given template
     * @param {Object} detail
     * @param {string} detail.name
     */
    async _onSpreadSheetNameChanged(detail) {
        const { name } = detail;
        this.state.spreadsheetName = name;
        this.env.config.setDisplayName(this.state.spreadsheetName);
        await this.orm.write("spreadsheet.template", [this.resId], {
            name,
        });
    }

    async makeCopy({ data, thumbnail }) {
        const defaultValues = {
            spreadsheet_data: JSON.stringify(data),
            thumbnail,
        };
        const id = await this.orm.call("spreadsheet.template", "copy", [this.resId], {
            default: defaultValues,
        });
        this._openSpreadsheet(id);
    }
}

SpreadsheetTemplateAction.template = "documents_spreadsheet.SpreadsheetTemplateAction";
SpreadsheetTemplateAction.components = {
    SpreadsheetComponent,
    DocumentsSpreadsheetControlPanel,
};

registry
    .category("actions")
    .add("action_open_template", SpreadsheetTemplateAction, { force: true });
