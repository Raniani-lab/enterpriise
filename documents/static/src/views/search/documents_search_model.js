/** @odoo-module **/

import { SearchModel } from "@web/search/search_model";
import { browser } from "@web/core/browser/browser";

// Helpers
const isFolderCategory = (s) => s.type === "category" && s.fieldName === "folder_id";
const isTagFilter = (s) => s.type === "filter" && s.fieldName === "tag_ids";

export class DocumentsSearchModel extends SearchModel {
    //---------------------------------------------------------------------
    // Actions / Getters
    //---------------------------------------------------------------------

    /**
     * Returns a description of each folder (record of documents.folder).
     * @returns {Object[]}
     */
    getFolders() {
        const { values } = this.getSections(isFolderCategory)[0];
        return [...values.values()];
    }

    /**
     * Returns the id of the current selected folder, if any, false
     * otherwise.
     * @returns {number | false}
     */
    getSelectedFolderId() {
        const { activeValueId } = this.getSections(isFolderCategory)[0];
        return activeValueId;
    }

    /**
     * Returns the current selected folder, if any, false otherwise.
     * @returns {Object | false}
     */
    getSelectedFolder() {
        const folderSection = this.getSections(isFolderCategory)[0];
        const folder = folderSection && folderSection.values.get(folderSection.activeValueId);
        return folder || false;
    }

    /**
     * Returns ids of selected tags.
     * @returns {number[]}
     */
    getSelectedTagIds() {
        const { values } = this.getSections(isTagFilter)[0];
        return [...values.values()].filter((value) => value.checked).map((value) => value.id);
    }

    /**
     * Returns a description of each tag (record of documents.tag).
     * @returns {Object[]}
     */
    getTags() {
        const { values } = this.getSections(isTagFilter)[0];
        return [...values.values()].sort((a, b) => {
            if (a.group_sequence === b.group_sequence) {
                return a.sequence - b.sequence;
            } else {
                return a.group_sequence - b.group_sequence;
            }
        });
    }

    /**
     * Overridden to write the new value in the local storage.
     * @override
     */
    toggleCategoryValue(sectionId, valueId) {
        super.toggleCategoryValue(...arguments);
        const { fieldName } = this.sections.get(sectionId);
        const storageKey = this._getStorageKey(fieldName);
        browser.localStorage.setItem(storageKey, valueId);
    }

    /**
     * Updates the folder id of a record matching the given value.
     * @param {number[]} recordIds
     * @param {number} valueId
     */
    async updateRecordFolderId(recordIds, valueId) {
        await this.orm.write("documents.document", recordIds, {
            folder_id: valueId,
        });
        this.trigger("update");
    }

    /**
     * Updates the tag ids of a record matching the given value.
     * @param {number[]} recordIds
     * @param {number} valueId
     */
    async updateRecordTagId(recordIds, valueId) {
        await this.orm.write("documents.document", recordIds, {
            tag_ids: [[4, valueId]],
        });
        this.trigger("update");
    }

    //---------------------------------------------------------------------
    // Private
    //---------------------------------------------------------------------

    /**
     * @override
     */
    _ensureCategoryValue(category, valueIds) {
        if (valueIds.includes(category.activeValueId)) {
            return;
        }
        // If not set in context, or set to an unknown value, set active value
        // from localStorage
        const storageKey = this._getStorageKey(category.fieldName);
        const storageValue = browser.localStorage.getItem(storageKey);
        // Support for id or 'false' key
        category.activeValueId = parseInt(storageValue) || !(storageValue === "false");
        if (valueIds.includes(category.activeValueId)) {
            return;
        }
        // If still not a valid value, get the search panel default value
        // from the given valid values.
        category.activeValueId = valueIds[Math.min(valueIds.length - 1, 1)];
    }

    /**
     * @private
     * @param {string} fieldName
     * @returns {string}
     */
    _getStorageKey(fieldName) {
        return `searchpanel_${this.resModel}_${fieldName}`;
    }

    /**
     * @override
     */
    _shouldWaitForData() {
        return true;
    }
}
