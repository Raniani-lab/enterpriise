/** @odoo-module */

import { registry } from "@web/core/registry";
import { mockJoinSpreadsheetSession } from "@spreadsheet_edition/../tests/utils/mock_server";

registry
    .category("mock_server")
    .add("documents.document/get_spreadsheets_to_display", function () {
        return this.models["documents.document"].records
            .filter((document) => document.handler === "spreadsheet")
            .map((spreadsheet) => ({
                name: spreadsheet.name,
                id: spreadsheet.id,
            }));
    })
    .add(
        "documents.document/join_spreadsheet_session",
        mockJoinSpreadsheetSession("documents.document")
    )
    .add("documents.document/dispatch_spreadsheet_message", () => false)
    .add("spreadsheet.template/fetch_template_data", function (route, args) {
        const [id] = args.args;
        const record = this.models["spreadsheet.template"].records.find(
            (record) => record.id === id
        );
        if (!record) {
            throw new Error(`Spreadsheet Template ${id} does not exist`);
        }
        return {
            data: record.data,
            name: record.name,
            isReadonly: false,
        };
    });
