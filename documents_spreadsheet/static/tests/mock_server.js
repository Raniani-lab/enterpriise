/** @odoo-module alias=documents_spreadsheet.MockServer */

import MockServer from "web.MockServer";

MockServer.include({
    /**
     * @override
     * @private
     * @returns {Promise}
     */
    async _performRpc(route, args) {
        const { model, method } = args;
        if (model === "documents.document" && method === "join_spreadsheet_session") {
            const [id] = args.args;
            const record = this.data[model].records.find((r) => r.id === id);
            if (!record) {
                throw new Error(`Spreadsheet ${id} does not exist`)
            }
            return {
                raw: record.raw,
                name: record.name,
                is_favorited: record.is_favorited,
                revisions: [],
            }
        }
        else if (route.includes("dispatch_spreadsheet_message")) {
            return false;
        }
        return this._super(...arguments);
    },
});
