/** @odoo-module alias=documents_spreadsheet.TestUtils default=0 */

import { ormService } from "@web/core/orm_service";
import { registry } from "@web/core/registry";
import { jsonToBase64 } from "@documents_spreadsheet/bundle/o_spreadsheet/helpers";
import { getBasicServerData } from "./utils/spreadsheet_test_data";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { patchWithCleanup, click, getFixture, nextTick, triggerEvent } from "@web/../tests/helpers/utils";
import { SpreadsheetAction } from "@documents_spreadsheet/bundle/actions/spreadsheet_action";
import { SpreadsheetTemplateAction } from "@documents_spreadsheet/bundle/actions/spreadsheet_template/spreadsheet_template_action";
import { UNTITLED_SPREADSHEET_NAME } from "@documents_spreadsheet/bundle/o_spreadsheet/constants";
import {
    getSpreadsheetActionEnv,
    getSpreadsheetActionModel,
    prepareWebClientForSpreadsheet,
} from "./utils/webclient_helpers";
import spreadsheet from "@documents_spreadsheet/bundle/o_spreadsheet/o_spreadsheet_extended";
import { DataSources } from "@documents_spreadsheet/bundle/o_spreadsheet/data_sources/data_sources";
const { Model } = spreadsheet;

/**
 * @typedef {import("./utils/spreadsheet_test_data").ServerData} ServerData
 */


/**
 * @typedef {object} SpreadsheetTestParams
 * @property {object} [webClient] Webclient already configured
 * @property {number} [spreadsheetId] Id of the spreadsheet
 * @property {ServerData} [serverData] Data to be injected in the mock server
 * @property {Function} [mockRPC] Mock rpc function
 * @property {object} [legacyServicesRegistry]
 */

/**
 * Open a spreadsheet action
 *
 * @param {string} actionTag Action tag ("action_open_spreadsheet" or "action_open_template")
 * @param {SpreadsheetTestParams} params
 */
async function createSpreadsheetAction(actionTag, params) {
    const SpreadsheetActionComponent =
        actionTag === "action_open_spreadsheet" ? SpreadsheetAction : SpreadsheetTemplateAction;
    let { webClient } = params;
    /** @type {any} */
    let spreadsheetAction;
    patchWithCleanup(SpreadsheetActionComponent.prototype, {
        setup() {
            this._super();
            spreadsheetAction = this;
        },
    });
    if (!webClient) {
        await prepareWebClientForSpreadsheet();
        webClient = await createWebClient({
            serverData: params.serverData || getBasicServerData(),
            mockRPC: params.mockRPC,
            legacyParams: {
                withLegacyMockServer: true,
                serviceRegistry: params.legacyServicesRegistry,
            },
        });
    }

    await doAction(webClient, {
        type: "ir.actions.client",
        tag: actionTag,
        params: {
            spreadsheet_id: params.spreadsheetId,
        },
    },
    { clearBreadcrumbs: true } // Sometimes in test defining custom action, Odoo opens on the action instead of opening on root
    );
    return {
        webClient,
        model: getSpreadsheetActionModel(spreadsheetAction),
        env: getSpreadsheetActionEnv(spreadsheetAction),
        transportService: spreadsheetAction.transportService,
    };
}

/**
 * Create an empty spreadsheet
 *
 * @param {SpreadsheetTestParams} params
 */
export async function createSpreadsheet(params = {}) {
    if (!params.serverData) {
        params.serverData = getBasicServerData();
    }
    if (!params.spreadsheetId) {
        const documents = params.serverData.models["documents.document"].records;
        const spreadsheetId = Math.max(...documents.map((d) => d.id)) + 1;
        documents.push({
            id: spreadsheetId,
            name: UNTITLED_SPREADSHEET_NAME,
            raw: "{}",
        });
        params = { ...params, spreadsheetId };
    }
    return createSpreadsheetAction("action_open_spreadsheet", params);
}

/**
 * Create a spreadsheet template
 *
 * @param {SpreadsheetTestParams} params
 */
export async function createSpreadsheetTemplate(params = {}) {
    if (!params.serverData) {
        params.serverData = getBasicServerData();
    }
    if (!params.spreadsheetId) {
        const templates = params.serverData.models["spreadsheet.template"].records;
        const spreadsheetId = Math.max(...templates.map((d) => d.id)) + 1;
        templates.push({
            id: spreadsheetId,
            name: "test template",
            data: jsonToBase64({}),
        });
        params = { ...params, spreadsheetId };
    }
    return createSpreadsheetAction("action_open_template", params);
}

/**
 * Create a spreadsheet with both a pivot and a list view.
 */
export async function createSpreadsheetWithPivotAndList() {
    await prepareWebClientForSpreadsheet();
    const webClient = await createWebClient({
        serverData: getBasicServerData(),
    });

    let spreadsheetAction = {};
    patchWithCleanup(SpreadsheetAction.prototype, {
        setup() {
            this._super();
            spreadsheetAction = this;
        },
    });

    /** Open the list view */
    await doAction(webClient, {
        name: "list view",
        res_model: "partner",
        type: "ir.actions.act_window",
        views: [[false, "list"]],
    });

    const target = getFixture();

    /** Put the current list in a new spreadsheet */
    await click(target.querySelector(".o_favorite_menu button"));
    await click(target.querySelector(".o_insert_list_spreadsheet_menu"));
    await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    await nextTick();

    /** Open the pivot view */
    await doAction(webClient, {
        name: "pivot view",
        res_model: "partner",
        type: "ir.actions.act_window",
        views: [[false, "pivot"]],
    });

    /** Put the pivot in the newly created spreadsheet */
    await click(target.querySelector(".o_pivot_add_spreadsheet"));
    await triggerEvent(target, `.o-sp-dialog-item div[data-id='${spreadsheetAction.resId}']`, "focus");
    await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    await nextTick();

    const env = getSpreadsheetActionEnv(spreadsheetAction);
    const model = getSpreadsheetActionModel(spreadsheetAction);
    await waitForDataSourcesLoaded(model);

    return { env, model };
}

export async function waitForDataSourcesLoaded(model) {
    await model.config.dataSources.waitForAllLoaded();
}

export function setupDataSourceEvaluation(model) {
    model.config.dataSources.addEventListener("data-source-updated", () => {
        const sheetId = model.getters.getActiveSheetId();
        model.dispatch("EVALUATE_CELLS", { sheetId });
    });
}

/**
 * Create a spreadsheet model with a mocked server environnement
 *
 * @param {object} params
 * @param {object} [params.spreadsheetData] Spreadsheet data to import
 * @param {ServerData} [params.serverData] Data to be injected in the mock server
 * @param {function} [params.mockRPC] Mock rpc function
 */
export async function createModelWithDataSource(params = {}) {
    registry.category("services").add("orm", ormService);
    const env = await makeTestEnv({
        serverData: params.serverData || getBasicServerData(),
        mockRPC: params.mockRPC,
    });
    const model = new Model(params.spreadsheetData, {
        evalContext: { env },
        dataSources: new DataSources(env.services.orm.silent),
    });
    setupDataSourceEvaluation(model);
    await nextTick(); // initial async formulas loading
    return model;
}
