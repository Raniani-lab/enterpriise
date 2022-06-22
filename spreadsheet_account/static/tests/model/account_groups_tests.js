/** @odoo-module */

import { nextTick } from "@web/../tests/helpers/utils";
import { setCellContent } from "@spreadsheet/../tests/utils/commands";
import { createModelWithDataSource } from "@spreadsheet/../tests/utils/model";
import { getCellValue, getCell } from "@spreadsheet/../tests/utils/getters";
import { getAccountingData } from "../accounting_test_data";

let serverData;

function beforeEach() {
    serverData = getAccountingData();
}

QUnit.module("spreadsheet_account > account groups", { beforeEach }, () => {
    QUnit.test("get no account", async (assert) => {
        const model = await createModelWithDataSource({ serverData });
        setCellContent(model, "A1", `=ODOO.ACCOUNT.GROUP("100")`);
        await nextTick();
        assert.equal(getCellValue(model, "A1"), "");
    });

    QUnit.test("get one account", async (assert) => {
        const model = await createModelWithDataSource({ serverData });
        setCellContent(model, "A1", `=ODOO.ACCOUNT.GROUP(2)`);
        await nextTick();
        assert.equal(getCellValue(model, "A1"), "100105");
    });

    QUnit.test("get multiple accounts", async (assert) => {
        const model = await createModelWithDataSource({ serverData });
        setCellContent(model, "A1", `=ODOO.ACCOUNT.GROUP(1)`);
        await nextTick();
        assert.equal(getCellValue(model, "A1"), "100104,200104");
    });

    QUnit.test("wrong account id", async (assert) => {
        const model = await createModelWithDataSource({ serverData });
        setCellContent(model, "A1", `=ODOO.ACCOUNT.GROUP("not an id")`);
        await nextTick();
        assert.equal(
            getCell(model, "A1").evaluated.error.message,
            "The function ODOO.ACCOUNT.GROUP expects a number value, but 'not an id' is a string, and cannot be coerced to a number."
        );
    });
});
