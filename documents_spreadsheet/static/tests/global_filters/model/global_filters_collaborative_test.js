/** @odoo-module */

import {
    addGlobalFilter,
    editGlobalFilter,
    setGlobalFilterValue,
} from "@spreadsheet/../tests/utils/commands";
import { getBasicServerData } from "@spreadsheet/../tests/utils/data";
import { getCellValue } from "@spreadsheet/../tests/utils/getters";
import { nextTick } from "@web/../tests/helpers/utils";
import { insertPivot } from "../../pivot/model/pivot_collaborative_test";
import { setupCollaborativeEnv } from "../../utils/collaborative_helpers";

let alice, bob, charlie, network;

async function beforeEach() {
    const env = await setupCollaborativeEnv(getBasicServerData());
    alice = env.alice;
    bob = env.bob;
    charlie = env.charlie;
    network = env.network;
}

QUnit.module("documents_spreadsheet > collaborative global filters", { beforeEach }, () => {
    QUnit.test("Add a filter with a default value", async (assert) => {
        assert.expect(3);
        await insertPivot(alice);
        const filter = {
            id: "41",
            type: "relation",
            label: "41",
            defaultValue: [41],
            pivotFields: { 1: { field: "product_id", type: "many2one" } },
            modelName: undefined,
            rangeType: undefined,
        };
        await nextTick();
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => getCellValue(user, "D4"),
            10
        );
        await addGlobalFilter(alice, { filter });
        await nextTick();
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => user.getters.getGlobalFilterValue(filter.id),
            [41]
        );
        // the default value should be applied immediately
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => getCellValue(user, "D4"),
            ""
        );
    });

    QUnit.test("Edit a filter", async (assert) => {
        assert.expect(3);
        await insertPivot(alice);
        const filter = {
            id: "41",
            type: "relation",
            label: "41",
            defaultValue: [41],
            pivotFields: { 1: { field: "product_id", type: "many2one" } },
            modelID: undefined,
            modelName: undefined,
            rangeType: undefined,
        };
        await nextTick();
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => getCellValue(user, "B4"),
            11
        );
        await addGlobalFilter(alice, { filter });
        await nextTick();
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => getCellValue(user, "B4"),
            11
        );
        await editGlobalFilter(alice, {
            id: "41",
            filter: { ...filter, defaultValue: [37] },
        });
        await nextTick();
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => getCellValue(user, "B4"),
            ""
        );
    });

    QUnit.test("Edit a filter and remove it concurrently", async (assert) => {
        assert.expect(1);
        const filter = {
            id: "41",
            type: "relation",
            label: "41",
            defaultValue: [41],
            pivotFields: { 1: { field: "product_id", type: "many2one" } },
            modelID: undefined,
            modelName: undefined,
            rangeType: undefined,
        };
        await addGlobalFilter(alice, { filter });
        await nextTick();
        await network.concurrent(() => {
            charlie.dispatch("EDIT_GLOBAL_FILTER", {
                id: "41",
                filter: { ...filter, defaultValue: [37] },
            });
            bob.dispatch("REMOVE_GLOBAL_FILTER", { id: "41" });
        });
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => user.getters.getGlobalFilters(),
            []
        );
    });

    QUnit.test("Remove a filter and edit it concurrently", async (assert) => {
        assert.expect(1);
        const filter = {
            id: "41",
            type: "relation",
            label: "41",
            defaultValue: [41],
            pivotFields: { 1: { field: "product_id", type: "many2one" } },
            modelID: undefined,
            modelName: undefined,
            rangeType: undefined,
        };
        await addGlobalFilter(alice, { filter });
        await nextTick();
        await network.concurrent(() => {
            bob.dispatch("REMOVE_GLOBAL_FILTER", { id: "41" });
            charlie.dispatch("EDIT_GLOBAL_FILTER", {
                id: "41",
                filter: { ...filter, defaultValue: [37] },
            });
        });
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => user.getters.getGlobalFilters(),
            []
        );
    });

    QUnit.test("Remove a filter and edit another concurrently", async (assert) => {
        assert.expect(1);
        const filter1 = {
            id: "41",
            type: "relation",
            label: "41",
            defaultValue: [41],
            pivotFields: { 1: { field: "product_id", type: "many2one" } },
            modelID: undefined,
            modelName: undefined,
            rangeType: undefined,
        };
        const filter2 = {
            id: "37",
            type: "relation",
            label: "37",
            defaultValue: [37],
            pivotFields: { 1: { field: "product_id", type: "many2one" } },
            modelID: undefined,
            modelName: undefined,
            rangeType: undefined,
        };
        await addGlobalFilter(alice, { filter: filter1 });
        await addGlobalFilter(alice, { filter: filter2 });
        await nextTick();
        await network.concurrent(() => {
            bob.dispatch("REMOVE_GLOBAL_FILTER", { id: "41" });
            charlie.dispatch("EDIT_GLOBAL_FILTER", {
                id: "37",
                filter: { ...filter2, defaultValue: [74] },
            });
        });
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => user.getters.getGlobalFilters().map((filter) => filter.id),
            ["37"]
        );
    });

    QUnit.test("Setting a filter value is only applied locally", async (assert) => {
        assert.expect(3);
        await insertPivot(alice);
        const filter = {
            id: "41",
            type: "relation",
            label: "a relational filter",
            pivotFields: { 1: { field: "product_id", type: "many2one" } },
        };
        await addGlobalFilter(alice, { filter });
        await setGlobalFilterValue(bob, {
            id: filter.id,
            value: [1],
        });
        await nextTick();
        assert.equal(alice.getters.getActiveFilterCount(), 0);
        assert.equal(bob.getters.getActiveFilterCount(), 1);
        assert.equal(charlie.getters.getActiveFilterCount(), 0);
    });
});
