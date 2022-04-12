/** @odoo-module */

import { registry } from "@web/core/registry";
import SpreadsheetCollaborativeChannel from "./spreadsheet_collaborative_channel";

class SpreadsheetCollaborativeService {
    /**
     * Get a new collaborative channel for the given spreadsheet id
     * @param {Env} env Env of owl (Component.env)
     * @param {number} spreadsheetId id of the spreadsheet
     */
    getCollaborativeChannel(env, spreadsheetId) {
        if (env.services.bus_service) {
            return new SpreadsheetCollaborativeChannel(env, spreadsheetId);
        }
        return undefined;
    }
}

/**
 * This service exposes a single instance of the above class.
 */
export const spreadsheetCollaborativeService = {
    dependencies: [],
    start(env, dependencies) {
        return new SpreadsheetCollaborativeService(env, dependencies);
    },
};

registry.category("services").add("spreadsheet_collaborative", spreadsheetCollaborativeService);
