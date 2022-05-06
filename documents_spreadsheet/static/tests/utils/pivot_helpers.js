/** @odoo-module */

import { createWebClient, doAction } from "@web/../tests/webclient/helpers";
import {
    patchWithCleanup,
    click,
    nextTick,
    getFixture,
    makeDeferred,
} from "@web/../tests/helpers/utils";
import { getBasicServerData } from "./spreadsheet_test_data";
import { SpreadsheetAction } from "@documents_spreadsheet/bundle/actions/spreadsheet_action";
import {
    getSpreadsheetActionEnv,
    getSpreadsheetActionModel,
    getSpreadsheetActionTransportService,
    prepareWebClientForSpreadsheet,
} from "./webclient_helpers";
import { waitForDataSourcesLoaded } from "../spreadsheet_test_utils";

/**
 * Get a webclient with a pivot view.
 * The webclient is already configured to work with spreadsheet (env, registries, ...)
 *
 * @param {Object|undefined} params
 * @param {string|undefined} params.model Model name of the pivot
 * @param {Object|undefined} params.serverData Data to be injected in the mock server
 * @param {Function|undefined} params.mockRPC Mock rpc function
 * @param {Array|undefined} params.domain Domain of the pivot
 * @param {Object|undefined} params.legacyServicesRegistry
 * @returns Webclient
 */
export async function spawnPivotViewForSpreadsheet(params = {}) {
    await prepareWebClientForSpreadsheet();
    const webClient = await createWebClient({
        serverData: params.serverData || getBasicServerData(),
        mockRPC: params.mockRPC,
        legacyParams: {
            withLegacyMockServer: true,
            serviceRegistry: params.legacyServicesRegistry,
        },
    });

    await doAction(webClient, {
        name: "pivot view",
        res_model: params.model || "partner",
        type: "ir.actions.act_window",
        views: [[false, "pivot"]],
        domain: params.domain,
    });
    return webClient;
}

/**
 * Create a spreadsheet model from a Pivot controller
 *
 * @param {Object} params
 * @param {string|undefined} params.model Model name of the pivot
 * @param {Object|undefined} params.serverData Data to be injected in the mock server
 * @param {Function|undefined} params.mockRPC Mock rpc function
 * @param {Object|undefined} params.webClient Webclient to use
 * @param {Array|undefined} params.domain Domain of the pivot
 * @param {Object|undefined} params.legacyServicesRegistry
 * @param {number|undefined} params.documentId ID of an existing document
 * @param {Function|undefined} params.actions Actions to execute on the pivot view
 *                                            before inserting in spreadsheet
 * @returns Webclient
 */
export async function createSpreadsheetFromPivot(params = {}) {
    let spreadsheetAction = {};
    const def = makeDeferred();
    patchWithCleanup(SpreadsheetAction.prototype, {
        setup() {
            this._super();
            spreadsheetAction = this;
            owl.onMounted(() => {
                def.resolve();
            });
        },
    });
    let { webClient } = params;
    if (!webClient) {
        webClient = await spawnPivotViewForSpreadsheet({
            model: params.model,
            serverData: params.serverData,
            mockRPC: params.mockRPC,
            legacyServicesRegistry: params.legacyServicesRegistry,
            domain: params.domain,
        });
    } else {
        await doAction(webClient, {
            name: "pivot view",
            res_model: params.model || "partner",
            type: "ir.actions.act_window",
            views: [[false, "pivot"]],
            domain: params.domain,
        });
    }
    const target = getFixture();
    if (params.actions) {
        await params.actions(target);
    }
    await click(target.querySelector(".o_pivot_add_spreadsheet"));
    if (params.documentId) {
        await click(document.querySelector(".modal-content select"));
        document.body
            .querySelector(`.modal-content option[value='${params.documentId}']`)
            .setAttribute("selected", "selected");
    }
    await click(document.querySelector(".modal-content > .modal-footer > .btn-primary"));
    await def;
    await nextTick();
    const model = getSpreadsheetActionModel(spreadsheetAction);
    await waitForDataSourcesLoaded(model);
    return {
        webClient,
        env: getSpreadsheetActionEnv(spreadsheetAction),
        model,
        transportService: getSpreadsheetActionTransportService(spreadsheetAction),
        get spreadsheetAction() {
            return spreadsheetAction;
        },
    };
}
