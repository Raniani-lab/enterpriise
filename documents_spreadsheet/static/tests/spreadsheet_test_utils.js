/** @odoo-module alias=documents_spreadsheet.TestUtils default=0 */
import spreadsheet from "documents_spreadsheet.spreadsheet";
import { createActionManager, nextTick, createView } from "web.test_utils";
import PivotView from "web.PivotView";
import MockServer from 'web.MockServer';
import makeTestEnvironment from 'web.test_env';
import MockSpreadsheetCollaborativeChannel from "./mock_spreadsheet_collaborative_channel";
import { getBasicArch, getTestData } from "./spreadsheet_test_data";

const { Model } = spreadsheet;
const { toCartesian } = spreadsheet.helpers;


/**
 * Get the value of the given cell
 */
export function getCellValue(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const cell = model.getters.getCell(sheetId, ...toCartesian(xc));
    if (!cell) {
        return undefined;
    }
    return model.getters.getCellValue(cell, sheetId);
}

/**
 * Get the computed value that would be autofilled starting from the given xc
 */
export function getAutofillValue(model, xc, { direction, steps}) {
    const content = getCellFormula(model, xc);
    const column = ["left", "right"].includes(direction);
    const increment = ["left", "top"].includes(direction) ? -steps : steps;
    return model.getters.getNextValue(content, column, increment);
}

/**
 * Get the cell of the given xc
 */
export function getCell(model, xc, sheetId = model.getters.getActiveSheetId()) {
    return model.getters.getCell(sheetId, ...toCartesian(xc));
}

/**
 * Get the cells of the given sheet (or active sheet if not provided)
 */
export function getCells(model, sheetId = model.getters.getActiveSheetId()) {
    return model.getters.getCells(sheetId);
}

/**
 * Get the formula of the given xc
 */
export function getCellFormula(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const cell = getCell(model, xc, sheetId);
    return cell && cell.type === "formula" ? model.getters.getFormulaCellContent(sheetId, cell) : "";
}

/**
 * Get the content of the given xc
 */
export function getCellContent(model, xc, sheetId = undefined) {
    if (sheetId === undefined) {
        sheetId =
            model.config.mode === "headless"
                ? model.getters.getVisibleSheets()[0]
                : model.getters.getActiveSheetId();
    }
    const cell = getCell(model, xc, sheetId);
    return cell ? model.getters.getCellText(cell, sheetId, true) : "";
}

/**
 * Get the list of the merges (["A1:A2"]) of the sheet
 */
export function getMerges(model, sheetId = model.getters.getActiveSheetId()) {
    return model.exportData().sheets.find((sheet) => sheet.id === sheetId).merges
}

/**
 * Set the content of a cell
 */
export function setCellContent(model, xc, content, sheetId = undefined) {
    if (sheetId === undefined) {
        sheetId =
            model.config.mode === "headless"
                ? model.getters.getVisibleSheets()[0]
                : model.getters.getActiveSheetId();
    }
    const [col, row] = toCartesian(xc);
    model.dispatch("UPDATE_CELL", { col, row, sheetId, content });
}

/**
 * Return the odoo spreadsheet component
 * @param {*} actionManager
 * @returns {Component}
 */
function getSpreadsheetComponent(actionManager) {
    return  actionManager.getCurrentController().widget
        .spreadsheetComponent.componentRef.comp;
}

/**
 * Return the o-spreadsheet component
 * @param {*} actionManager
 * @returns {Component}
 */
function getOSpreadsheetComponent(actionManager) {
    return getSpreadsheetComponent(actionManager).spreadsheet.comp;
}

/**
 * Return the o-spreadsheet Model
 */
function getSpreadsheetActionModel(actionManager) {
    return getOSpreadsheetComponent(actionManager).model;
}

function getSpreadsheetActionEnv(actionManager) {
    const model = getSpreadsheetActionModel(actionManager);
    const component = getSpreadsheetComponent(actionManager);
    const oComponent = getOSpreadsheetComponent(actionManager);
    return {
        ...component.env,
        getters: model.getters,
        dispatch: model.dispatch,
        services: model.config.evalContext.env.services,
        openSidePanel: oComponent.openSidePanel.bind(oComponent),
    }
}

export async function createSpreadsheet(params = {}) {
    let { spreadsheetId } = params;
    if (!spreadsheetId) {
        const documents = params.data["documents.document"].records;
        spreadsheetId = Math.max(...documents.map((d) => d.id)) + 1;
        documents.push({
            id: spreadsheetId,
            name: "pivot spreadsheet",
            raw: "{}",
        });
    }
    const actionManager = await createActionManager(params);
    const transportService = params.transportService || new MockSpreadsheetCollaborativeChannel();
    await actionManager.doAction({
        type: "ir.actions.client",
        tag: "action_open_spreadsheet",
        params: {
            active_id: spreadsheetId,
            transportService,
        },
    });
    return {
        actionManager,
        model: getSpreadsheetActionModel(actionManager),
        env: getSpreadsheetActionEnv(actionManager),
    };
}

/**
 * Create a spreadsheet model from a Pivot controller
 * @param pivotView Pivot view
 * @param actions Callback to execute on the controller before exporting
 * the pivot data
 */
export async function createSpreadsheetFromPivot(pivotView = {}, actions) {
    pivotView = {
        arch: getBasicArch(),
        data: getTestData(),
        model: pivotView.model || "partner",
        ...pivotView,
    };
    const { data, debug } = pivotView;
    const controller = await createView({
        View: PivotView,
        ...pivotView }
    );
    const documents = data["documents.document"].records;
    const id = Math.max(...documents.map((d) => d.id)) + 1;
    documents.push({
        id,
        name: "pivot spreadsheet",
        raw: "{}",
    });
    const actionManager = await createActionManager({
        debug,
        data,
        mockRPC: pivotView.mockRPC,
        intercepts: pivotView.intercepts || {},
        services: pivotView.services,
        archs: pivotView.archs || {},
    });
    if (actions) {
        await actions(controller);
    }
    const transportService = new MockSpreadsheetCollaborativeChannel();
    await actionManager.doAction({
        type: "ir.actions.client",
        tag: "action_open_spreadsheet",
        params: {
            active_id: id,
            transportService,
            initCallback: await controller._getCallbackBuildPivot(true)
        },
    });
    await nextTick();
    const spreadSheetComponent = actionManager.getCurrentController().widget
    .spreadsheetComponent.componentRef.comp;
    const oSpreadsheetComponent = spreadSheetComponent.spreadsheet.comp
    const model = oSpreadsheetComponent.model;
    const env = Object.assign(spreadSheetComponent.env, {
        getters: model.getters,
        dispatch: model.dispatch,
        services: model.config.evalContext.env.services,
        openSidePanel: oSpreadsheetComponent.openSidePanel.bind(oSpreadsheetComponent),
    });
    controller.destroy();
    return { actionManager, env, model, transportService };
}

/**
 * Setup a realtime collaborative test environment, with the given data
 */
export function setupCollaborativeEnv(data) {
    const mockServer = new MockServer(data, {});
    const env = makeTestEnvironment({}, mockServer.performRpc.bind(mockServer));
    const network = new MockSpreadsheetCollaborativeChannel();
    const model = new Model()
    const alice = new Model(model.exportData(), {
        evalContext: { env },
        transportService: network,
        client: { id: "alice", name: "Alice" },
    });
    const bob = new Model(model.exportData(), {
        evalContext: { env },
        transportService: network,
        client: { id: "bob", name: "Bob" },
    });
    const charlie = new Model(model.exportData(), {
        evalContext: { env },
        transportService: network,
        client: { id: "charlie", name: "Charlie" },
    });
    return { network, alice, bob, charlie, rpc: env.services.rpc };
}

export function joinSession(spreadsheetChannel, client) {
    spreadsheetChannel.broadcast({
        type: "CLIENT_JOINED",
        client: {
            position: {
                sheetId: "1",
                col: 1,
                row: 1
            },
            name: "Raoul Grosbedon",
            ...client,
        }
    });
}

export function leaveSession(spreadsheetChannel, clientId) {
    spreadsheetChannel.broadcast({
        type: "CLIENT_LEFT",
        clientId
    });
}

QUnit.assert.spreadsheetIsSynchronized = function(users, callback, expected) {
    for (const user of users) {
        const actual = callback(user);
        if (!QUnit.equiv(actual, expected)) {
            const userName = user.getters.getClient().name;
            return this.pushResult( {
                result: false,
                actual,
                expected,
                message: `${userName} does not have the expected value`
            });
        }
    }
    this.pushResult({ result: true });
};
