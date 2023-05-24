/** @odoo-module **/

"use strict";

import framework from "web.framework";
import testUtils from "web.test_utils";

import { getFixture } from "@web/../tests/helpers/utils";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";

import { DocumentAction } from "@sign/js/backend/document";

let serverData;
let target;
QUnit.module(
    "document_backend_tests",
    {
        beforeEach: function () {
            this.data = {
                partner: {
                    fields: {
                        display_name: { string: "Displayed name", type: "char" },
                        template_id: {
                            string: "Template",
                            type: "many2one",
                            relation: "sign.template",
                        },
                    },
                    records: [
                        {
                            id: 1,
                            display_name: "some record",
                            template_id: 1,
                        },
                    ],
                },
                "sign.template": {
                    fields: {
                        display_name: { string: "Template Name", type: "char" },
                    },
                    records: [
                        {
                            id: 1,
                            display_name: "some template",
                        },
                    ],
                },
            };
            serverData = { models: this.data };
            target = getFixture();
        },
    },
    function () {
        QUnit.test("simple rendering", async function (assert) {
            assert.expect(4);

            const hasFinishedProm = testUtils.makeTestPromise();
            testUtils.mock.patch(framework, {
                blockUI: function () {
                    assert.step("blockUI");
                },
                unblockUI: function () {
                    assert.step("unblockUI");
                    hasFinishedProm.resolve();
                },
            });
            const actions = {
                9: {
                    id: 9,
                    name: "A Client Action",
                    tag: "sign.Document",
                    type: "ir.actions.client",
                    context: { id: 5, token: "abc" },
                },
            };
            Object.assign(serverData, { actions });

            const webClient = await createWebClient({
                serverData,
                mockRPC: function (route) {
                    if (route === "/sign/get_document/5/abc") {
                        return Promise.resolve("<span>def</span>");
                    }
                },
            });

            await doAction(webClient, 9);
            await hasFinishedProm;

            assert.verifySteps(["blockUI", "unblockUI"]);

            assert.strictEqual(
                target.querySelector(".o_sign_document").innerText.trim(),
                "def",
                "should display text from server"
            );

            testUtils.mock.unpatch(framework);
        });

        QUnit.test("do not crash when leaving the action", async function (assert) {
            assert.expect(3);
            testUtils.mock.patch(framework, {
                blockUI: function () {},
                unblockUI: function () {},
            });

            const proms = [];
            testUtils.mock.patch(DocumentAction, {
                _init_page() {
                    const prom = this._super.apply(this, arguments);
                    proms.push(prom);
                    return prom;
                },
            });
            const actions = {
                9: {
                    id: 9,
                    name: "A Client Action",
                    tag: "sign.Document",
                    type: "ir.actions.client",
                    context: { id: 5, token: "abc" },
                },
            };
            Object.assign(serverData, { actions });

            const webClient = await createWebClient({
                serverData,
                mockRPC: function (route) {
                    if (route === "/sign/get_document/5/abc") {
                        assert.step(route);
                        return Promise.resolve("<span>def</span>");
                    }
                },
            });

            await doAction(webClient, 9);
            await doAction(webClient, 9);
            await Promise.all(proms);

            assert.verifySteps(["/sign/get_document/5/abc", "/sign/get_document/5/abc"]);
            testUtils.mock.unpatch(DocumentAction);
            testUtils.mock.unpatch(framework);
        });
    }
);
