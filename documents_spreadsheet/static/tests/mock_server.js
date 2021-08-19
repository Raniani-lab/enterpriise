/** @odoo-module */

import { registry } from "@web/core/registry";

registry
    .category("mock_server")
    .add("documents.document/join_spreadsheet_session", function (route, args) {
        const [id] = args.args;
        const record = this.models["documents.document"].records.find((record) => record.id === id);
        if (!record) {
            throw new Error(`Spreadsheet ${id} does not exist`);
        }
        return {
            raw: record.raw,
            name: record.name,
            is_favorited: record.is_favorited,
            revisions: [],
        };
    })
    .add("documents.document/dispatch_spreadsheet_message", () => false);
