/** @odoo-module */

import spreadsheet from "@documents_spreadsheet_bundle/o_spreadsheet/o_spreadsheet_extended";
import MockServer from "web.MockServer";
import makeTestEnvironment from "web.test_env";
import MockSpreadsheetCollaborativeChannel from "./mock_spreadsheet_collaborative_channel";

const { Model } = spreadsheet;

export function joinSession(spreadsheetChannel, client) {
    spreadsheetChannel.broadcast({
        type: "CLIENT_JOINED",
        client: {
            position: {
                sheetId: "1",
                col: 1,
                row: 1,
            },
            name: "Raoul Grosbedon",
            ...client,
        },
    });
}

export function leaveSession(spreadsheetChannel, clientId) {
    spreadsheetChannel.broadcast({
        type: "CLIENT_LEFT",
        clientId,
    });
}

/**
 * Setup a realtime collaborative test environment, with the given data
 */
export function setupCollaborativeEnv(data) {
    const mockServer = new MockServer(data, {});
    const env = makeTestEnvironment({}, mockServer.performRpc.bind(mockServer));
    env.delayedRPC = env.services.rpc;
    const network = new MockSpreadsheetCollaborativeChannel();
    const model = new Model();
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

QUnit.assert.spreadsheetIsSynchronized = function (users, callback, expected) {
    for (const user of users) {
        const actual = callback(user);
        if (!QUnit.equiv(actual, expected)) {
            const userName = user.getters.getClient().name;
            return this.pushResult({
                result: false,
                actual,
                expected,
                message: `${userName} does not have the expected value`,
            });
        }
    }
    this.pushResult({ result: true });
};
