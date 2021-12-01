/** @odoo-module */

import ListView from "web.ListView";
import testUtils from "web.test_utils";
import * as LegacyFavoriteMenu from "web.FavoriteMenu";
import { InsertListSpreadsheetMenu as LegacyInsertListSpreadsheetMenu } from "@documents_spreadsheet/components/insert_list_spreadsheet_menu";
import { click, nextTick } from "@web/../tests/helpers/utils";
import { spawnListViewForSpreadsheet } from "../utils/list_helpers";

const createView = testUtils.createView;
const legacyFavoriteMenuRegistry = LegacyFavoriteMenu.registry;
const { modal } = testUtils;

QUnit.module(
    "documents_spreadsheet > insert_list_spreadsheet_menu",
    {
        beforeEach: function () {
            legacyFavoriteMenuRegistry.add(
                "insert-list-spreadsheet-menu",
                LegacyInsertListSpreadsheetMenu,
                5
            );
            this.data = {
                foo: {
                    fields: {
                        foo: { string: "Foo", type: "char" },
                    },
                    records: [{ id: 1, foo: "yop" }],
                },
            };
        },
    },
    function () {
        QUnit.test("Menu item is present in list view", async function (assert) {
            assert.expect(1);

            const list = await createView({
                View: ListView,
                model: "foo",
                data: this.data,
                arch: '<tree><field name="foo"/></tree>',
            });

            await testUtils.dom.click(list.$(".o_favorite_menu button"));
            assert.containsOnce(list, ".o_insert_list_spreadsheet_menu");

            list.destroy();
        });

        QUnit.test("Can save a list in a new spreadsheet", async (assert) => {
            assert.expect(2);
            const webClient = await spawnListViewForSpreadsheet({
                mockRPC: async function (route, args) {
                    if (args.method === "create" && args.model === "documents.document") {
                        assert.step("create");
                    }
                },
            });

            await click(webClient.el.querySelector(".o_favorite_menu button"));
            await click(webClient.el.querySelector(".o_insert_list_spreadsheet_menu"));
            await modal.clickButton("Confirm");
            await nextTick();
            assert.verifySteps(["create"]);
        });

        QUnit.test("Can save a list in existing spreadsheet", async (assert) => {
            assert.expect(3);

            const webClient = await spawnListViewForSpreadsheet({
                mockRPC: async function (route, args) {
                    if (args.model === "documents.document") {
                        assert.step(args.method);
                        switch (args.method) {
                            case "get_spreadsheets_to_display":
                                return [{ id: 1, name: "My Spreadsheet" }];
                        }
                    }
                },
            });

            await click(webClient.el.querySelector(".o_favorite_menu button"));
            await click(webClient.el.querySelector(".o_insert_list_spreadsheet_menu"));
            document.body
                .querySelector(".modal-content option[value='1']")
                .setAttribute("selected", "selected");
            await modal.clickButton("Confirm");
            await nextTick();

            assert.verifySteps(
                ["get_spreadsheets_to_display", "join_spreadsheet_session"],
                "get spreadsheet, then join"
            );
        });
    }
);
