/** @odoo-module */

import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { registry } from "@web/core/registry";
import { ormService } from "@web/core/orm_service";

import { RecordFileStore } from "@spreadsheet_edition/bundle/image/record_file_store";

QUnit.module(
    "Record file store",
    {
        beforeEach() {
            registry.category("services").add("orm", ormService);
        },
    },
    async () => {
        QUnit.test("upload image", async (assert) => {
            const fakeHTTPService = {
                start() {
                    return {
                        post: (route, params) => {
                            assert.step("image uploaded");
                            assert.strictEqual(params.model, "res.partner");
                            assert.strictEqual(params.id, 1);
                            assert.strictEqual(route, "/web/binary/upload_attachment");
                            return JSON.stringify([
                                {
                                    id: 10,
                                    name: params.ufile[0].name,
                                    mimetype: "image/png",
                                },
                            ]);
                        },
                    };
                },
            };
            registry.category("services").add("http", fakeHTTPService);
            const env = await makeTestEnv();
            const fileStore = new RecordFileStore(
                "res.partner",
                1,
                env.services.http,
                env.services.orm
            );
            const path = await fileStore.upload(
                new File(["image"], "image_name.png", { type: "image/*" })
            );
            assert.strictEqual(path, "/web/image/10");
            assert.verifySteps(["image uploaded"]);
        });

        QUnit.test("delete image", async (assert) => {
            const env = await makeTestEnv({
                mockRPC: (route, args) => {
                    if (args.method === "unlink") {
                        assert.step("image deleted");
                        assert.strictEqual(args.model, "ir.attachment");
                        const ids = args.args[0];
                        assert.deepEqual(ids, [10]);
                        return true;
                    }
                },
            });
            const fileStore = new RecordFileStore(
                "res.partner",
                1,
                env.services.http,
                env.services.orm
            );
            await fileStore.delete("/web/image/10");
            assert.verifySteps(["image deleted"]);
        });

        QUnit.test("delete file with path without attachment id", async (assert) => {
            const env = await makeTestEnv({
                mockRPC: (route, args) => {
                    if (args.method === "unlink") {
                        throw new Error("unlink should not be called");
                    }
                },
            });
            const fileStore = new RecordFileStore(
                "res.partner",
                1,
                env.services.http,
                env.services.orm
            );
            assert.rejects(fileStore.delete("/web/image/path/without/id"));
        });
    }
);
