/** @odoo-module */

import { makeFakeUserService } from "@web/../tests/helpers/mock_services";
import { registry } from "@web/core/registry";
import * as LegacyFavoriteMenu from "web.FavoriteMenu";
import { InsertListSpreadsheetMenu as LegacyInsertListSpreadsheetMenu } from "@documents_spreadsheet/components/insert_list_spreadsheet_menu";
import { spreadsheetCollaborativeService } from "../../src/o_spreadsheet/collaborative/spreadsheet_collaborative_service";
import MockSpreadsheetCollaborativeChannel from "./mock_spreadsheet_collaborative_channel";
import { loadJS } from "@web/core/assets";
import { ormService } from "@web/core/orm_service";
import { uiService } from "@web/core/ui/ui_service";

const legacyFavoriteMenuRegistry = LegacyFavoriteMenu.registry;
const serviceRegistry = registry.category("services");

export async function prepareWebClientForSpreadsheet() {
    await loadJS("/web/static/lib/Chart/Chart.js");
    serviceRegistry.add("spreadsheet_collaborative", makeFakeSpreadsheetService(), { force: true });
    serviceRegistry.add(
        "user",
        makeFakeUserService(() => true),
        { force: true }
    );
    serviceRegistry.add("ui", uiService);
    serviceRegistry.add("orm", ormService);
    legacyFavoriteMenuRegistry.add(
        "insert-list-spreadsheet-menu",
        LegacyInsertListSpreadsheetMenu,
        5
    );
}

export function makeFakeSpreadsheetService() {
    return {
        ...spreadsheetCollaborativeService,
        start() {
            const fakeSpreadsheetService = spreadsheetCollaborativeService.start(...arguments);
            fakeSpreadsheetService.getCollaborativeChannel = () =>
                new MockSpreadsheetCollaborativeChannel();
            return fakeSpreadsheetService;
        },
    };
}

/**
 * Return the odoo spreadsheet component
 * @param {*} actionManager
 * @returns {Component}
 */
export function getSpreadsheetComponent(actionManager) {
    return actionManager.spreadsheet;
}

/**
 * Return the o-spreadsheet component
 * @param {*} actionManager
 * @returns {Component}
 */
export function getOSpreadsheetComponent(actionManager) {
    return getSpreadsheetComponent(actionManager).spreadsheet;
}

/**
 * Return the o-spreadsheet Model
 */
export function getSpreadsheetActionModel(actionManager) {
    return getOSpreadsheetComponent(actionManager).model;
}

export function getSpreadsheetActionTransportService(actionManager) {
    return actionManager.transportService;
}

export function getSpreadsheetActionEnv(actionManager) {
    const model = getSpreadsheetActionModel(actionManager);
    const component = getSpreadsheetComponent(actionManager);
    const oComponent = getOSpreadsheetComponent(actionManager);
    return {
        ...component.env,
        model,
        services: model.config.evalContext.env.services,
        openSidePanel: oComponent.openSidePanel.bind(oComponent),
        openLinkEditor: oComponent.openLinkEditor.bind(oComponent),
    };
}
