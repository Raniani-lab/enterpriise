/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { start } from "@mail/../tests/helpers/test_utils";

import { click, contains } from "@web/../tests/utils";

QUnit.module("correspondence_details");

QUnit.test("The partner's phone number is displayed in correspondence details.", async () => {
    const pyEnv = await startServer();
    const phoneNumber = "355 649 6295";
    pyEnv["res.partner"].create({ display_name: "Maxime Randonnées", phone: phoneNumber });
    start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await click(".nav-link", { text: "Contacts" });
    await click(".list-group-item-action", { text: "Maxime Randonnées" });
    await contains(`[href$="${phoneNumber}"] .fa-phone`);
});

QUnit.test("The partner's mobile number is displayed in correspondence details.", async () => {
    const pyEnv = await startServer();
    const phoneNumber = "0456 703 6196";
    pyEnv["res.partner"].create({ display_name: "Maxime Randonnées", mobile: phoneNumber });
    start();
    await click(".o_menu_systray button[title='Open Softphone']");
    await click(".nav-link", { text: "Contacts" });
    await click(".list-group-item-action", { text: "Maxime Randonnées" });
    await contains(`[href$="${phoneNumber}"] .fa-mobile`);
});
