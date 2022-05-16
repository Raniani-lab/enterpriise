/** @odoo-module */

import ListView from "web.ListView";
import testUtils from "web.test_utils";
import * as LegacyFavoriteMenu from "web.FavoriteMenu";
import { InsertListSpreadsheetMenu as LegacyInsertListSpreadsheetMenu } from "@documents_spreadsheet/assets/components/insert_list_spreadsheet_menu";
import { click, nextTick, getFixture, patchWithCleanup } from "@web/../tests/helpers/utils";
import { spawnListViewForSpreadsheet } from "../utils/list_helpers";
import { SpreadsheetAction } from "@documents_spreadsheet/bundle/actions/spreadsheet_action";
import { getSpreadsheetActionModel } from "../utils/webclient_helpers";
import { waitForDataSourcesLoaded } from "../spreadsheet_test_utils";

const createView = testUtils.createView;
const legacyFavoriteMenuRegistry = LegacyFavoriteMenu.registry;
const { modal } = testUtils;

let target;
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
            target = getFixture();
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

            await spawnListViewForSpreadsheet({
                mockRPC: async function (route, args) {
                    if (args.method === "create" && args.model === "documents.document") {
                        assert.step("create");
                    }
                },
            });

            await click(target.querySelector(".o_favorite_menu button"));
            await click(target.querySelector(".o_insert_list_spreadsheet_menu"));
            await modal.clickButton("Confirm");
            await nextTick();
            assert.verifySteps(["create"]);
        });

        QUnit.test("Can save a list in existing spreadsheet", async (assert) => {
            assert.expect(3);

            await spawnListViewForSpreadsheet({
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

            await click(target.querySelector(".o_favorite_menu button"));
            await click(target.querySelector(".o_insert_list_spreadsheet_menu"));
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

        QUnit.test("List name can be changed from the dialog", async (assert) => {
            assert.expect(2);

            await spawnListViewForSpreadsheet();

            let spreadsheetAction;
            patchWithCleanup(SpreadsheetAction.prototype, {
                setup() {
                    this._super();
                    spreadsheetAction = this;
                },
            });
            await click(document.body.querySelector(".o_favorite_menu button"));
            await click(document.body.querySelector(".o_insert_list_spreadsheet_menu"));
            document.body.querySelector(".o_spreadsheet_name").value = "New name";
            await modal.clickButton("Confirm");
            const model = getSpreadsheetActionModel(spreadsheetAction);
            await waitForDataSourcesLoaded(model);
            assert.equal(model.getters.getListName("1"), "New name");
            assert.equal(model.getters.getListDisplayName("1"), "(#1) New name");
        });

        QUnit.test("Unsorted List name doesn't contains sorting info", async function (assert) {
            assert.expect(1);
            await spawnListViewForSpreadsheet();

            await click(target.querySelector(".o_favorite_menu button"));
            await click(target.querySelector(".o_insert_list_spreadsheet_menu"));
            assert.equal(document.body.querySelector(".o_spreadsheet_name").value, "Partners");
        });

        QUnit.test("Sorted List name contains sorting info", async function (assert) {
            assert.expect(1);
            await spawnListViewForSpreadsheet({
                orderBy: [{name:'bar', asc: true}],
            });

            await click(target.querySelector(".o_favorite_menu button"));
            await click(target.querySelector(".o_insert_list_spreadsheet_menu"));
            assert.equal(document.body.querySelector(".o_spreadsheet_name").value, "Partners by Bar");
        });

        QUnit.test("List name is not changed if the name is empty", async (assert) => {
            await spawnListViewForSpreadsheet();

            let spreadsheetAction;
            patchWithCleanup(SpreadsheetAction.prototype, {
                setup() {
                    this._super();
                    spreadsheetAction = this;
                },
            });
            await click(document.body.querySelector(".o_favorite_menu button"));
            await click(document.body.querySelector(".o_insert_list_spreadsheet_menu"));
            document.body.querySelector(".o_spreadsheet_name").value = "";
            await modal.clickButton("Confirm");
            const model = getSpreadsheetActionModel(spreadsheetAction);
            await waitForDataSourcesLoaded(model);
            assert.equal(model.getters.getListName("1"), "Partners");
        });
    }
);
