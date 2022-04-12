/** @odoo-module */

import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import { patchWithCleanup, click, getFixture, makeDeferred } from "@web/../tests/helpers/utils";
import { getBasicServerData } from "./spreadsheet_test_data";
import {
    getSpreadsheetActionEnv,
    getSpreadsheetActionModel,
    getSpreadsheetActionTransportService,
    prepareWebClientForSpreadsheet,
} from "./webclient_helpers";
import { SpreadsheetAction } from "../../src/bundle/actions/spreadsheet_action";
import { waitForEvaluation } from "../spreadsheet_test_utils";

/**
 * Get a webclient with a list view.
 * The webclient is already configured to work with spreadsheet (env, registries, ...)
 *
 * @param {Object|undefined} params
 * @param {string|undefined} params.model Model name of the list
 * @param {Object|undefined} params.serverData Date to be injected in the webclient
 * @param {Function|undefined} params.mockRPC Mock rpc function
 * @returns Webclient
 */
export async function spawnListViewForSpreadsheet(params = {}) {
    const { model, serverData, mockRPC } = params;
    await prepareWebClientForSpreadsheet();
    const webClient = await createWebClient({
        serverData: serverData || getBasicServerData(),
        mockRPC,
    });

    await doAction(webClient, {
        name: "list view",
        res_model: model || "partner",
        type: "ir.actions.act_window",
        views: [[false, "list"]],
    });
    return webClient;
}

/**
 * Create a spreadsheet model from a List controller
 *
 * @param {Object} params
 * @param {string|undefined} params.model Model name of the list
 * @param {Object|undefined} params.serverData Date to be injected in the webclient
 * @param {Function|undefined} params.mockRPC Mock rpc function
 * @param {number|undefined} params.linesNumber
 *
 * @returns Webclient
 */
export async function createSpreadsheetFromList(params = {}) {
    const def = makeDeferred();
    let spreadsheetAction = {};
    patchWithCleanup(SpreadsheetAction.prototype, {
        setup() {
            this._super();
            owl.onMounted(() => {
                spreadsheetAction = this;
                def.resolve();
            });
        },
    });
    const webClient = await spawnListViewForSpreadsheet({
        model: params.model,
        serverData: params.serverData,
        mockRPC: params.mockRPC,
    });
    const target = getFixture();
    /** Put the current list in a new spreadsheet */
    await click(target.querySelector(".o_favorite_menu button"));
    await click(target.querySelector(".o_insert_list_spreadsheet_menu"));
    target.querySelector(`.o_threshold_list input`).value = params.linesNumber
        ? params.linesNumber
        : 10;
    await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    await def;
    const model = getSpreadsheetActionModel(spreadsheetAction);
    await waitForEvaluation(model);
    return {
        webClient,
        model,
        env: getSpreadsheetActionEnv(spreadsheetAction),
        transportService: getSpreadsheetActionTransportService(spreadsheetAction),
    };
}
