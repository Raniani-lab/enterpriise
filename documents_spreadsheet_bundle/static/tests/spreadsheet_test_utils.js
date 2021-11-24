/** @odoo-module alias=documents_spreadsheet.TestUtils default=0 */
import { jsonToBase64 } from "@documents_spreadsheet_bundle/o_spreadsheet/helpers";
import { getBasicServerData } from "./utils/spreadsheet_test_data";
import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { patchWithCleanup } from "@web/../tests/helpers/utils";
import { SpreadsheetAction } from "@documents_spreadsheet_bundle/actions/spreadsheet_action";
import { SpreadsheetTemplateAction } from "@documents_spreadsheet_bundle/actions/spreadsheet_template/spreadsheet_template_action";
import { UNTITLED_SPREADSHEET_NAME } from "@documents_spreadsheet_bundle/o_spreadsheet/constants";
import { click, nextTick } from "@web/../tests/helpers/utils";
import {
    getSpreadsheetActionEnv,
    getSpreadsheetActionModel,
    prepareWebClientForSpreadsheet,
} from "./utils/webclient_helpers";

/**
 * Open a spreadsheet action
 *
 * @param {string} actionTag Action tag ("action_open_spreadsheet" or "action_open_template")
 * @param {Object} params
 * @param {Object|undefined} params.webClient Webclient already configured
 * @param {Object|undefined} params.serverData Date to be injected in the webclient
 * @param {number} params.spreadsheetId Id of the spreadsheet
 * @param {Function|undefined} params.mockRPC Mock rpc function
 * @param {Object|undefined} params.legacyServicesRegistry
 */
async function createSpreadsheetAction(actionTag, params) {
    const SpreadsheetActionComponent =
        actionTag === "action_open_spreadsheet" ? SpreadsheetAction : SpreadsheetTemplateAction;
    let { webClient } = params;
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
    });
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
 * @param {Object} params
 * @param {Object|undefined} params.webClient Webclient already configured
 * @param {Object|undefined} params.serverData Date to be injected in the webclient
 * @param {number} params.spreadsheetId Id of the spreadsheet
 * @param {Function|undefined} params.mockRPC Mock rpc function
 * @param {Object|undefined} params.legacyServicesRegistry
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
 * @param {Object} params
 * @param {Object|undefined} params.webClient Webclient already configured
 * @param {Object|undefined} params.serverData Date to be injected in the webclient
 * @param {number} params.spreadsheetId Id of the spreadsheet
 * @param {Function|undefined} params.mockRPC Mock rpc function
 * @param {Object|undefined} params.legacyServicesRegistry
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

    /** Put the current list in a new spreadsheet */
    await click(webClient.el.querySelector(".o_favorite_menu button"));
    await click(webClient.el.querySelector(".o_insert_list_spreadsheet_menu"));
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
    await click(webClient.el.querySelector(".o_pivot_add_spreadsheet"));
    await click(document.querySelector(".modal-content select"));
    document.body
        .querySelector(`.modal-content option[value='${spreadsheetAction.resId}']`)
        .setAttribute("selected", "selected");
    await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    await nextTick();

    const env = getSpreadsheetActionEnv(spreadsheetAction);
    const model = getSpreadsheetActionModel(spreadsheetAction);
    await model.waitForIdle();

    return { env, model };
}
