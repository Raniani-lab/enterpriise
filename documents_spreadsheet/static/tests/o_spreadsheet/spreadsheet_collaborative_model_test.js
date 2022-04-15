/** @odoo-module */

import { nextTick } from "@web/../tests/helpers/utils";

import { getBasicServerData } from "../utils/spreadsheet_test_data";
import { getCellContent, getCellFormula, getCellValue } from "../utils/getters_helpers";
import {
    addGlobalFilter,
    editGlobalFilter,
    setCellContent,
    setGlobalFilterValue,
} from "../utils/commands_helpers";
import { setupCollaborativeEnv } from "../utils/collaborative_helpers";
import { waitForEvaluation } from "../spreadsheet_test_utils";
import PivotDataSource from "@documents_spreadsheet/bundle/pivot/pivot_data_source";

let dataSourceId = 0;

/**
 * Get a pivot definition, a data source and a pivot model (already loaded)
 */
async function getPivotReady(model) {
    const definition = {
        metaData: {
            colGroupBys: ["foo"],
            rowGroupBys: ["bar"],
            activeMeasures: ["probability"],
            resModel: "partner",
        },
        searchParams: {
            domain: [],
            context: {},
            groupBy: [],
            orderBy: [],
        },
    }
    const dataSource = model.config.dataSources.create(PivotDataSource, definition);
    await dataSource.loadModel();
    const pivotModel = dataSource.model;
    await dataSource.load();
    return { definition, dataSource, pivotModel };
}

/**
 * Insert a given pivot
 * @param {Model} model
 * @param {Object} params
 * @param {Object} params.definition Pivot definition
 * @param {PivotDataSource} params.dataSource Pivot data source (ready)
 * @param {Object} params.pivotModel Pivot model
 * @param {string|undefined} params.dataSourceId
 * @param {[number, number]|undefined} params.anchor
 */
function insertPreloadedPivot(model, params) {
    const { definition, dataSource, pivotModel } = params;
    const structure = pivotModel.getTableStructure();
    const sheetId = model.getters.getActiveSheetId();
    const { cols, rows, measures } = structure.export();
    const table = {
        cols,
        rows,
        measures,
    };
    const dataSourceId = params.dataSourceId || "data";
    model.config.dataSources._dataSources[dataSourceId] = dataSource;
    model.dispatch("INSERT_PIVOT", {
        sheetId,
        col: params.anchor ? params.anchor[0] : 0,
        row: params.anchor ? params.anchor[1] : 0,
        table,
        id: 1,
        dataSourceId,
        definition,
    });
    const columns = [];
    for (let col = 0; col <= table.cols[table.cols.length - 1].length; col++) {
        columns.push(col);
    }
    model.dispatch("AUTORESIZE_COLUMNS", { sheetId, cols: columns });
}

/**
 * Add a basic pivot in the current spreadsheet of model
 * @param {Model} model
 */
async function insertPivot(model) {
    const { definition, dataSource, pivotModel } = await getPivotReady(model);
    insertPreloadedPivot(model, {
        definition,
        dataSource,
        pivotModel,
    })
}

function insertList(model, id, anchor=[0, 0]) {
    const { definition, columns } = getListPayload();
    return model.dispatch("INSERT_ODOO_LIST", {
        sheetId: model.getters.getActiveSheetId(),
        col: anchor[0],
        row: anchor[1],
        id,
        definition,
        dataSourceId: dataSourceId++,
        columns,
        linesNumber: 5,
    })
}

function getListPayload() {
    return {
        definition: {
            metaData: {
                resModel: "partner",
                columns: ["foo", "probability"],
            },
            searchParams: {
                domain: [],
                context: {},
                orderBy: [],
            },
            limit: 5,
        },
        columns: [{ name: "foo", type: "integer" }, { name: "probability", type: "integer" }],
    };
}

let alice, bob, charlie, network;

QUnit.module("documents_spreadsheet > collaborative", {
    async beforeEach() {
        const env = await setupCollaborativeEnv(getBasicServerData());
        alice = env.alice;
        bob = env.bob;
        charlie = env.charlie;
        network = env.network;
    },
});

QUnit.test("A simple test", (assert) => {
    assert.expect(1);
    const sheetId = alice.getters.getActiveSheetId();
    alice.dispatch("UPDATE_CELL", { sheetId, col: 0, row: 0, content: "hello" });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellContent(user, "A1"),
        "hello"
    );
});

QUnit.test("Add a pivot", async (assert) => {
    assert.expect(7);
    await insertPivot(alice);
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivotIds().length,
        1
    );
    const cellFormulas = {
        B1: `=PIVOT.HEADER("1","foo","1")`, // header col
        A3: `=PIVOT.HEADER("1","bar","false")`, // header row
        B2: `=PIVOT.HEADER("1","foo","1","measure","probability")`, // measure
        B3: `=PIVOT("1","probability","bar","false","foo","1")`, // value
        F1: `=PIVOT.HEADER("1")`, // total header rows
        A5: `=PIVOT.HEADER("1")`, // total header cols
    };
    for (const [cellXc, formula] of Object.entries(cellFormulas)) {
        assert.spreadsheetIsSynchronized(
            [alice, bob, charlie],
            (user) => getCellContent(user, cellXc),
            formula
        );
    }
});

QUnit.test("Add two pivots concurrently", async (assert) => {
    assert.expect(6);
    const { definition: def1, dataSource: ds1, pivotModel: pm1 } = await getPivotReady(alice);
    const { definition: def2, dataSource: ds2, pivotModel: pm2 } = await getPivotReady(bob);
    await network.concurrent(() => {
        insertPreloadedPivot(alice, {
            definition: def1,
            dataSource: ds1,
            dataSourceId: "data1",
            pivotModel: pm1,
        });
        insertPreloadedPivot(bob, {
            definition: def2,
            dataSource: ds2,
            pivotModel: pm2,
            dataSourceId: "data2",
            anchor: [0, 25],
        });
    });
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => user.getters.getPivotIds(), [
        "1",
        "2",
    ]);
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellFormula(user, "B1"),
        `=PIVOT.HEADER("1","foo","1")`
    );
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellFormula(user, "B26"),
        `=PIVOT.HEADER("2","foo","1")`
    );
    await nextTick();

    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "B4"), 11);
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellValue(user, "B29"),
        11
    );
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => Object.keys(user.config.dataSources._dataSources).length,
        2
    );
});


QUnit.test("Add a pivot in another sheet", async (assert) => {
    const { definition: def1, dataSource: ds1, pivotModel: pm1 } = await getPivotReady(alice);
    alice.dispatch("CREATE_SHEET", {
        sheetId: "sheetId",
        name: "Sheet",
    });
    alice.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: alice.getters.getActiveSheetId(),
        sheetIdTo: "sheetId",
    })
    insertPreloadedPivot(alice, {
        definition: def1,
        dataSource: ds1,
        dataSourceId: "data1",
        pivotModel: pm1,
    });
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getPivotIds(),
        ["1"]
    );
    // Let the evaluation and the data sources do what they need to do
    // before Bob and Charlie activate the second sheet to see the new pivot.
    await nextTick();
    bob.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: alice.getters.getActiveSheetId(),
        sheetIdTo: "sheetId",
    });
    charlie.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: alice.getters.getActiveSheetId(),
        sheetIdTo: "sheetId",
    })
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellFormula(user, "B1"),
        `=PIVOT.HEADER("1","foo","1")`
    );
    // values should not be loaded yet (lazy load)
    assert.spreadsheetIsSynchronized([bob, charlie], (user) => getCellValue(user, "B4"), "Loading...");
    assert.spreadsheetIsSynchronized(
        [bob, charlie],
        (user) => getCellValue(user, "B1"),
        "Loading..."
    );
    await nextTick();
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "B4"), 11);
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellValue(user, "B1"),
        1
    );
});

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
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "D4"), 10);
    await addGlobalFilter(alice, { filter });
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getGlobalFilterValue(filter.id),
        [41]
    );
    // the default value should be applied immediately
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "D4"), "");
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
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
    assert.equal(alice.getters.getActiveFilterCount(), 0);
    assert.equal(bob.getters.getActiveFilterCount(), 1);
    assert.equal(charlie.getters.getActiveFilterCount(), 0);
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
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "B4"), 11);
    await addGlobalFilter(alice, { filter });
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "B4"), 11);
    await editGlobalFilter(alice, {
        id: "41",
        filter: { ...filter, defaultValue: [37] },
    });
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "B4"), "");
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
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
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
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
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
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);
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

QUnit.module("documents_spreadsheet > collaborative > list", {
    async beforeEach() {
        const env = await setupCollaborativeEnv(getBasicServerData());
        alice = env.alice;
        bob = env.bob;
        charlie = env.charlie;
        network = env.network;
    },
});

QUnit.test("Add a list", async (assert) => {
    assert.expect(1);
    insertList(alice, 1)
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => user.getters.getListIds().length,
        1
    );
});

QUnit.test("Add two lists concurrently", async (assert) => {
    assert.expect(6);
    await network.concurrent(() => {
        insertList(alice, 1);
        insertList(bob, 1, [0, 25]);
    });
    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => user.getters.getListIds(), [
        "1",
        "2",
    ]);
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellFormula(user, "A1"),
        `=LIST.HEADER("1","foo")`
    );
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellFormula(user, "A26"),
        `=LIST.HEADER("2","foo")`
    );
    await waitForEvaluation(alice);
    await waitForEvaluation(bob);
    await waitForEvaluation(charlie);

    assert.spreadsheetIsSynchronized([alice, bob, charlie], (user) => getCellValue(user, "A4"), 17);
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellValue(user, "A29"),
        17
    );
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => Object.keys(user.config.dataSources._dataSources).length,
        2
    );
});

QUnit.test("Can undo a command before a INSERT_ODOO_LIST", async (assert) => {
    assert.expect(1);
    setCellContent(bob, "A10", "Hello Alice");
    insertList(alice, 1);
    setCellContent(charlie, "A11", "Hello all");
    bob.dispatch("REQUEST_UNDO");
    assert.spreadsheetIsSynchronized(
        [alice, bob, charlie],
        (user) => getCellContent(user, "A10"),
        ""
    );
});
