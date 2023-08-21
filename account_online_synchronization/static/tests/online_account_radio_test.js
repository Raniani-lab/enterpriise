/* @odoo-module */

import { click, start, startServer } from "@mail/../tests/helpers/test_utils";

QUnit.module("Views", {}, function () {
    QUnit.module("AccountOnlineSynchronizationAccountRadio");

    QUnit.test("can be rendered", async (assert) => {
        const pyEnv = await startServer();
        const onlineLink = pyEnv["account.online.link"].create([{
            "state": "connected",
            "name": "Fake Bank",
        }]);
        pyEnv["account.online.account"].create([
            {
                "name": "account_1",
                "online_identifier": "abcd",
                "balance": 10.0,
                "account_number": "account_number_1",
                "account_online_link_id": onlineLink,
            },
            {
                "name": "account_2",
                "online_identifier": "efgh",
                "balance": 20.0,
                "account_number": "account_number_2",
                "account_online_link_id": onlineLink,
            },
        ]);
        const bankSelection = pyEnv["account.bank.selection"].create([{
            "account_online_link_id": onlineLink,
        }]);

        const views = {
            "account.bank.selection,false,form":
                `<form>
                    <div>
                        <field name="account_online_account_ids" invisible="1"/>
                        <field name="selected_account" widget="online_account_radio" nolabel="1"/>
                    </div>
                </form>`,
        };
        const { openView } = await start({
            serverData: { views },
            mockRPC: function (route, args) {
                if (route === "/web/dataset/call_kw/account.online.account/get_formatted_balances") {
                    return {
                        1: ["$ 10.0", 10.0],
                        2: ["$ 20.0", 20.0],
                    };
                }
            },
        });

        await openView({
            res_id: bankSelection,
            res_model: "account.bank.selection",
            views: [[false, "form"]],
        });

        assert.containsN(document.body, ".o_radio_input", 2, "View contains 2 radio buttons");

        assert.equal(document.querySelectorAll(".o_radio_item p")[0].innerText, "$ 10.0");
        assert.equal(document.querySelectorAll(".o_radio_item label")[0].innerText, "account_1");
        assert.equal(document.querySelectorAll(".o_radio_item p")[1].innerText, "$ 20.0");
        assert.equal(document.querySelectorAll(".o_radio_item label")[1].innerText, "account_2");

        assert.ok(document.querySelectorAll(".o_radio_input")[0].checked, "First radio is already selected");
        assert.notOk(document.querySelectorAll(".o_radio_input")[1].checked, "Second radio is not selected");

        await click('.o_radio_input:last()'); // Select the other radio button

        assert.notOk(document.querySelectorAll(".o_radio_input")[0].checked, "First radio is no longer selected");
        assert.ok(document.querySelectorAll(".o_radio_input")[1].checked, "Second radio is now selected");
    });
});
