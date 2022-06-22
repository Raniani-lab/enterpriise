/** @odoo-module */

import { registry } from "@web/core/registry";

registry
    .category("mock_server")
    .add("account.account/spreadsheet_fetch_debit_credit", function (route, args) {
        return new Array(args.args[0].length).fill({ credit: 0, debit: 0 });
    })
    .add("account.account/get_account_group", function (route, args, performRPC) {
        const accountTypeIds = args.args[0];
        const data = accountTypeIds.map((typeId) => {
            const records = this.mockSearchRead("account.account", [
                [["user_type_id", "=", typeId]],
                ["code"],
            ], {});
            return records.map((record) => record.code);
        });
        return data;
    });
