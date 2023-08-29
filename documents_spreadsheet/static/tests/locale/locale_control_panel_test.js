/** @odoo-module */

import { createSpreadsheet } from "../spreadsheet_test_utils";

import { constants } from "@odoo/o-spreadsheet";

const userLocale = constants.DEFAULT_LOCALE;

QUnit.module("documents_spreadsheet > Locale Control Panel", {}, function () {
    QUnit.test("No locale icon if user locale matched spreadsheet locale", async function (assert) {
        await createSpreadsheet({
            mockRPC: async function (route, args) {
                if (args.method === "get_user_spreadsheet_locale") {
                    return userLocale;
                }
            },
        });
        const icon = document.querySelector(".o_spreadsheet_status .fa-globe");
        assert.notOk(icon);
    });

    QUnit.test(
        "Different locales between user and spreadsheet: display icon as danger",
        async function (assert) {
            await createSpreadsheet({
                mockRPC: async function (route, args) {
                    if (args.method === "get_user_spreadsheet_locale") {
                        return {
                            ...userLocale,
                            code: "fr_FR",
                            dateFormat: "yyyy-mm-dd",
                            thousandsSeparator: " ",
                            decimalSeparator: ",",
                        };
                    }
                },
            });
            const icon = document.querySelector(".o_spreadsheet_status .fa-globe");
            assert.ok(icon);
            assert.ok(icon.classList.contains("text-danger"));
            assert.equal(
                icon.title,
                "Difference between user locale (fr_FR) and spreadsheet locale (en_US). This spreadsheet is using the formats below:\n" +
                    "- dates: m/d/yyyy\n" +
                    "- numbers: 1,234,567.89"
            );
        }
    );
});
