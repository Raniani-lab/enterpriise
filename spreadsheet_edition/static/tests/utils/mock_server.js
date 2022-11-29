/** @odoo-module */

export function mockJoinSpreadsheetSession(resModel) {
    return function (route, args) {
        const [id] = args.args;
        const record = this.models[resModel].records.find((record) => record.id === id);
        if (!record) {
            throw new Error(`Spreadsheet ${id} does not exist`);
        }
        return {
            raw: JSON.parse(record.raw),
            name: record.name,
            is_favorited: record.is_favorited,
            revisions: [],
            isReadonly: false,
        };
    };
}
