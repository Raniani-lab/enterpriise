/** @odoo-module */

import { getBasicData } from "@spreadsheet/../tests/utils/data";

export function getAccountingData() {
    return {
        models: {
            ...getBasicData(),
            "account.move.line": {
                fields: {
                    account_id: { type: "many2one", relation: "account.account" },
                    date: { string: "Date", type: "date" },
                },
                records: [
                    { id: 1, name: "line1", account_id: 1, date: "2022-06-01" },
                    { id: 2, name: "line2", account_id: 2, date: "2022-06-23" },
                ],
            },
            "account.account": {
                fields: {
                    code: { string: "Code", type: "string" },
                    user_type_id: { string: "Account type", type: "integer" },
                },
                records: [
                    { id: 1, code: "100104", user_type_id: 1 },
                    { id: 2, code: "100105", user_type_id: 2 },
                    { id: 3, code: "200104", user_type_id: 1 },
                ],
            },
        },
        views: {
            "account.move.line,false,list": /* xml */ `
                    <tree string="Move Lines">
                        <field name="id"/>
                        <field name="account_id"/>
                        <field name="date"/>
                    </tree>
                `,
            "account.move.line,false,search": /* xml */ `<search/>`,
        },
    };
}
