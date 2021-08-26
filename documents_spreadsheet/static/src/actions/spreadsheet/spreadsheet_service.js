/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { UNTITLED_SPREADSHEET_NAME } from "../../constants";

/**
 * This class is an interface used to interact with
 * the server database to manipulate spreadsheet documents.
 * It hides details of the underlying "documents.document" model.
 */
export class SpreadsheetService {
    /**
     * @param {Object} orm orm service
     */
    constructor(orm) {
        this.orm = orm;
    }

    /**
     * Create a new spreadsheet document where every value
     * is copied from the existing document `documentId`,
     * except for the exported data and the thumbnail.
     * @param {number} documentId document to copy
     * @param {Object} values
     * @param {Object} values.data exported spreadsheet data
     * @param {string} values.thumbnail spreadsheet thumbnail
     * @returns {number} id of the newly created spreadsheet document
     */
    async copy(documentId, { data, thumbnail }) {
        const defaultValues = {
            mimetype: "application/o-spreadsheet",
            raw: JSON.stringify(data),
            spreadsheet_snapshot: false,
            thumbnail,
        };
        return this.orm.call("documents.document", "copy", [documentId], {
            default: defaultValues,
        });
    }

    /**
     * Create a new empty spreadsheet document
     * @returns {number} id of the newly created spreadsheet document
     */
    async createEmpty() {
        const data = {
            name: UNTITLED_SPREADSHEET_NAME,
            mimetype: "application/o-spreadsheet",
            raw: "{}",
            handler: "spreadsheet",
        };
        return this.orm.create("documents.document", data);
    }

    /**
     * Save the data and thumbnail on the given document
     * @param {number} documentId
     * @param {Object} values values to save
     * @param {Object} values.data exported spreadsheet data
     * @param {string} values.thumbnail spreadsheet thumbnail
     */
    async save(documentId, { data, thumbnail }) {
        await this.orm.write("documents.document", [documentId], {
            thumbnail,
            raw: JSON.stringify(data),
            mimetype: "application/o-spreadsheet",
        });
    }

    /**
     * Save a new name for the given document
     * @param {number} documentId
     * @param {string} name
     */
    async saveName(documentId, name) {
        await this.orm.write("documents.document", [documentId], { name });
    }

    /**
     * Fetch all the necessary data to join a collaborative spreadsheet
     * @param {number} documentId
     * @returns {Object}
     */
    async fetchData(documentId) {
        return this.orm.call("documents.document", "join_spreadsheet_session", [documentId]);
    }
}
