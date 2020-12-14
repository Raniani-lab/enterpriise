/** @odoo-module alias=documents_spreadsheet.SpreadsheetCollaborativeModelTests */

import { nextTick } from "web.test_utils";

import {
    setupCollaborativeEnv,
    getCellContent,
    getCellFormula,
    getCellValue,
} from "./spreadsheet_test_utils";
import { createPivotCache } from "documents_spreadsheet.pivot_utils";
import { getTestData } from "./spreadsheet_test_data";


const { module, test } = QUnit;

async function getPivot(rpcFn) {
    const pivot = {
        colGroupBys: ["foo"],
        domain: [],
        measures: [{ field: "probability", operator: "avg" }],
        model: "partner",
        rowGroupBys: ["bar"],
    }
    const cache = await createPivotCache(pivot, rpcFn);
    return { pivot, cache };
}

let alice, bob, charlie, network, rpc;

module("documents_spreadsheet > collaborative", {
    beforeEach() {
        const env = setupCollaborativeEnv(getTestData());
        alice = env.alice;
        bob = env.bob;
        charlie = env.charlie;
        network = env.network;
        rpc = env.rpc;
    }
});

test("A simple test", (assert) => {
    assert.expect(1);
    const sheetId = alice.getters.getActiveSheetId();
    alice.dispatch("UPDATE_CELL", { sheetId, col: 0, row: 0, content: "hello" });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellContent(user, "A1"),
        "hello",
    );
});

test("Add a pivot", async (assert) => {
    assert.expect(1);
    const sheetId = alice.getters.getActiveSheetId();
    const { pivot, cache } = await getPivot(rpc);
    alice.dispatch("BUILD_PIVOT", {
        sheetId,
        pivot,
        cache,
        anchor: [0, 0],
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivots().length,
        1,
    );
});

test("Add two pivots concurrently", async (assert) => {
    assert.expect(3);
    const sheetId = alice.getters.getActiveSheetId();
    const { pivot: pivot1, cache: cache1 } = await getPivot(rpc);
    const { pivot: pivot2, cache: cache2 } = await getPivot(rpc);
    await network.concurrent(() => {
        alice.dispatch("BUILD_PIVOT", {
            sheetId,
            pivot: pivot1,
            cache: cache1,
            anchor: [0, 0],
        });
        bob.dispatch("BUILD_PIVOT", {
            sheetId,
            pivot: pivot2,
            cache: cache2,
            anchor: [0, 25],
        });
    })
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivots().map(p => p.id),
        [1, 2],
    );
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellFormula(user, "B1"),
        `=PIVOT.HEADER("1","foo","1")`,
    );
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellFormula(user, "B26"),
        `=PIVOT.HEADER("2","foo","1")`,
    );
});

test("Add a filter with a default value", async (assert) => {
    assert.expect(3)
    const sheetId = alice.getters.getActiveSheetId();
    const { pivot, cache } = await getPivot(rpc);
    alice.dispatch("BUILD_PIVOT", {
        sheetId,
        pivot,
        cache,
        anchor: [0, 0],
    });
    const filter = {
        id: "41",
        type: "relation",
        label: "41",
        defaultValue: [41],
        fields: { 1: { field: "product_id", type: "many2one" } },
        modelID: undefined,
        modelName: undefined,
        rangeType: undefined,
    };
    await nextTick();
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellValue(user, "D4"),
        "10",
    );
    alice.dispatch("ADD_PIVOT_FILTER", { filter });
    await nextTick();
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getGlobalFilters(),
        [{...filter, value: [41] }],
    );
    // the default value should be applied immediately
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellValue(user, "D4"),
        "",
    );
});

test("Setting a filter value is only applied locally", async (assert) => {
    assert.expect(3);
    const sheetId = alice.getters.getActiveSheetId();
    const { pivot, cache } = await getPivot(rpc);
    alice.dispatch("BUILD_PIVOT", {
        sheetId,
        pivot,
        cache,
        anchor: [0, 0],
    });
    const filter = {
        id: "41",
        type: "relation",
        label: "a relational filter",
        fields: { 1: { field: "product_id", type: "many2one" } },
    }
    alice.dispatch("ADD_PIVOT_FILTER", { filter });
    bob.dispatch("SET_PIVOT_FILTER_VALUE", {
        id: filter.id,
        value: [1],
    })
    assert.equal(alice.getters.getActiveFilterCount(), 0);
    assert.equal(bob.getters.getActiveFilterCount(), 1);
    assert.equal(charlie.getters.getActiveFilterCount(), 0);
});

test("Edit a filter", async assert => {
    assert.expect(3);
    const sheetId = alice.getters.getActiveSheetId();
    const { pivot, cache } = await getPivot(rpc);
    alice.dispatch("BUILD_PIVOT", {
        sheetId,
        pivot,
        cache,
        anchor: [0, 0],
    });
    const filter = {
        id: "41",
        type: "relation",
        label: "41",
        defaultValue: [41],
        fields: { 1: { field: "product_id", type: "many2one" } },
        modelID: undefined,
        modelName: undefined,
        rangeType: undefined,
    };
    await nextTick();
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellValue(user, "B4"),
        "11",
    );
    alice.dispatch("ADD_PIVOT_FILTER", { filter });
    await nextTick();
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellValue(user, "B4"),
        "11",
    );
    alice.dispatch("EDIT_PIVOT_FILTER", {
        id: "41",
        filter: { ...filter, defaultValue: [37] }
    });
    await nextTick();
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellValue(user, "B4"),
        "",
    );
});

test("Edit a filter and remove it concurrently", async (assert) => {
    assert.expect(1);
    const filter = {
        id: "41",
        type: "relation",
        label: "41",
        defaultValue: [41],
        fields: { 1: { field: "product_id", type: "many2one" } },
        modelID: undefined,
        modelName: undefined,
        rangeType: undefined,
    };
    alice.dispatch("ADD_PIVOT_FILTER", { filter });
    await network.concurrent(() => {
        charlie.dispatch("EDIT_PIVOT_FILTER", {
            id: "41",
            filter: { ...filter, defaultValue: [37] }
        });
        bob.dispatch("REMOVE_PIVOT_FILTER", { id: "41" });
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getGlobalFilters(),
        [],
    );
});

test("Remove a filter and edit it concurrently", async (assert) => {
    assert.expect(1);
    const filter = {
        id: "41",
        type: "relation",
        label: "41",
        defaultValue: [41],
        fields: { 1: { field: "product_id", type: "many2one" } },
        modelID: undefined,
        modelName: undefined,
        rangeType: undefined,
    };
    alice.dispatch("ADD_PIVOT_FILTER", { filter });
    await network.concurrent(() => {
        bob.dispatch("REMOVE_PIVOT_FILTER", { id: "41" });
        charlie.dispatch("EDIT_PIVOT_FILTER", {
            id: "41",
            filter: { ...filter, defaultValue: [37] }
        });
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getGlobalFilters(),
        [],
    );
});

test("Remove a filter and edit another concurrently", async(assert) => {
    assert.expect(1);
    const filter1 = {
        id: "41",
        type: "relation",
        label: "41",
        defaultValue: [41],
        fields: { 1: { field: "product_id", type: "many2one" } },
        modelID: undefined,
        modelName: undefined,
        rangeType: undefined,
    };
    const filter2 = {
        id: "37",
        type: "relation",
        label: "37",
        defaultValue: [37],
        fields: { 1: { field: "product_id", type: "many2one" } },
        modelID: undefined,
        modelName: undefined,
        rangeType: undefined,
    };
    alice.dispatch("ADD_PIVOT_FILTER", { filter: filter1 });
    alice.dispatch("ADD_PIVOT_FILTER", { filter: filter2 });
    await network.concurrent(() => {
        bob.dispatch("REMOVE_PIVOT_FILTER", { id: "41" });
        charlie.dispatch("EDIT_PIVOT_FILTER", {
            id: "37",
            filter: { ...filter2, defaultValue: [74] }
        });
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getGlobalFilters().map((filter) => filter.id),
        ["37"],
    );
});
