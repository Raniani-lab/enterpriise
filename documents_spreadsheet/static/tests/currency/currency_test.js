/** @odoo-module */

import { createSpreadsheet } from "../spreadsheet_test_utils";
import { setCellContent } from "../utils/commands_helpers";
import { getCell, getCellValue } from "../utils/getters_helpers";
import { nextTick } from "@web/../tests/helpers/utils";

QUnit.module("documents_spreadsheet > Currency");

QUnit.test("Basic exchange formula", async (assert) => {
    const { model } = await createSpreadsheet({
        mockRPC: async function (route, args) {
            if (args.method === "get_rates_for_spreadsheet") {
                const info = args.args[0][0];
                return [{ ...info, rate: 0.9 }];
            }
        },
    });
    setCellContent(model, "A1", `=ODOO.CURRENCY.RATE("EUR","USD")`);
    assert.strictEqual(getCellValue(model, "A1"), "Loading...");
    await nextTick();
    assert.strictEqual(getCellValue(model, "A1"), 0.9);
});

QUnit.test("Currency rate throw with unknown currency", async (assert) => {
    const { model } = await createSpreadsheet({
        mockRPC: async function (route, args) {
            if (args.method === "get_rates_for_spreadsheet") {
                const info = args.args[0][0];
                return [{ ...info, rate: false }];
            }
        },
    });
    setCellContent(model, "A1", `=ODOO.CURRENCY.RATE("INVALID","USD")`);
    await nextTick();
    assert.strictEqual(getCell(model, "A1").evaluated.error, "Currency rate unavailable.");
});

QUnit.test("Currency rates are only loaded once", async (assert) => {
    const { model } = await createSpreadsheet({
        mockRPC: async function (route, args) {
            if (args.method === "get_rates_for_spreadsheet") {
                assert.step("FETCH");
                const info = args.args[0][0];
                return [{ ...info, rate: 0.9 }];
            }
        },
    });
    setCellContent(model, "A1", `=ODOO.CURRENCY.RATE("EUR","USD")`);
    await nextTick();
    assert.verifySteps(["FETCH"]);
    setCellContent(model, "A2", `=ODOO.CURRENCY.RATE("EUR","USD")`);
    await nextTick();
    assert.verifySteps([]);
});

QUnit.test("Currency rates are loaded once by clock", async (assert) => {
    const { model } = await createSpreadsheet({
        mockRPC: async function (route, args) {
            if (args.method === "get_rates_for_spreadsheet") {
                assert.step("FETCH:" + args.args[0].length);
                const info1 = args.args[0][0];
                const info2 = args.args[0][1];
                return [
                    { ...info1, rate: 0.9 },
                    { ...info2, rate: 1 },
                ];
            }
        },
    });
    setCellContent(model, "A1", `=ODOO.CURRENCY.RATE("EUR","USD")`);
    setCellContent(model, "A2", `=ODOO.CURRENCY.RATE("EUR","SEK")`);
    await nextTick();
    assert.verifySteps(["FETCH:2"]);
});
