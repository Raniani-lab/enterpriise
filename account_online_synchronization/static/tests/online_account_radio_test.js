/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { start } from "@mail/../tests/helpers/test_utils";

import { click, contains } from "@web/../tests/utils";

QUnit.module("Views", {}, function () {
    QUnit.module("AccountOnlineSynchronizationAccountRadio");

    QUnit.test("can be rendered", async () => {
        const pyEnv = await startServer();
        const onlineLink = pyEnv["account.online.link"].create([
            {
                state: "connected",
                name: "Fake Bank",
            },
        ]);
        pyEnv["account.online.account"].create([
            {
                name: "account_1",
                online_identifier: "abcd",
                balance: 10.0,
                account_number: "account_number_1",
                account_online_link_id: onlineLink,
            },
            {
                name: "account_2",
                online_identifier: "efgh",
                balance: 20.0,
                account_number: "account_number_2",
                account_online_link_id: onlineLink,
            },
        ]);
        const bankSelection = pyEnv["account.bank.selection"].create([
            {
                account_online_link_id: onlineLink,
            },
        ]);

        const views = {
            "account.bank.selection,false,form": `<form>
                    <div>
                        <field name="account_online_account_ids" invisible="1"/>
                        <field name="selected_account" widget="online_account_radio" nolabel="1"/>
                    </div>
                </form>`,
        };
        const { openFormView } = await start({
            serverData: { views },
            mockRPC: function (route, args) {
                if (
                    route === "/web/dataset/call_kw/account.online.account/get_formatted_balances"
                ) {
                    return {
                        1: ["$ 10.0", 10.0],
                        2: ["$ 20.0", 20.0],
                    };
                }
            },
        });
        await openFormView("account.bank.selection", bankSelection);
        await contains(".o_radio_input", { count: 2 });
        await contains(".o_radio_item p:eq(0)", { text: "$ 10.0" });
        await contains(".o_radio_item label:eq(0)", { text: "account_1" });
        await contains(".o_radio_item p:eq(1)", { text: "$ 20.0" });
        await contains(".o_radio_item label:eq(1)", { text: "account_2" });
        await contains(".o_radio_input:eq(0):checked");
        await contains(".o_radio_input:eq(1):checked", { count: 0 });
        await click(".o_radio_input:eq(1)");
        await contains(".o_radio_input:eq(0):checked", { count: 0 });
        await contains(".o_radio_input:eq(1):checked");
    });
});
