/** @odoo-module **/

import { SearchPanel } from "@web/search/search_panel/search_panel";

import { useService } from "@web/core/utils/hooks";
import { device } from "web.config";
import { sprintf } from "web.utils";

const VALUE_SELECTOR = [".o_search_panel_category_value", ".o_search_panel_filter_value"].join();

const { useState } = owl;

/**
 * This file defines the DocumentsSearchPanel component, an extension of the
 * SearchPanel to be used in the documents kanban/list views.
 */

export class DocumentsSearchPanel extends SearchPanel {
    setup() {
        super.setup(...arguments);
        this.documentState = useState(this.env.documentsStore);
        this.notification = useService("notification");
    }

    //---------------------------------------------------------------------
    // Private
    //---------------------------------------------------------------------

    /**
     * @private
     * @param {number} valueId
     * @returns {boolean}
     */
    _isUploadingInFolder(valueId) {
        return this.documentState.isUploadingInFolder(valueId);
    }

    /**
     * @private
     * @param {HTMLElement} target
     * @param {DataTransfer} [dataTransfer]
     * @returns {boolean}
     */
    _isValidElement(target, dataTransfer) {
        return (
            dataTransfer && dataTransfer.types.includes("o_documents_data") && target && target.closest(VALUE_SELECTOR)
        );
    }

    /**
     * @private
     * @param {number} sectionId
     * @returns {boolean}
     */
    _hasValidFieldName(sectionId) {
        const { fieldName } = this.env.searchModel.getSections((s) => s.id === sectionId)[0];
        return ["folder_id", "tag_ids"].includes(fieldName);
    }

    /**
     * Gives the "dragover" class to the given element or remove it if none
     * is provided.
     * @private
     * @param {HTMLElement} [newDragFocus]
     */
    _updateDragOverClass(newDragFocus) {
        const allSelected = this.root.el.querySelectorAll(":scope .o_drag_over_selector");
        for (const selected of allSelected) {
            selected.classList.remove("o_drag_over_selector");
        }
        if (newDragFocus) {
            newDragFocus.classList.add("o_drag_over_selector");
        }
    }

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * @private
     * @param {number} sectionId
     * @param {number | false} valueId
     * @param {DragEvent} ev
     */
    _onDragEnter(sectionId, valueId, { currentTarget, dataTransfer }) {
        if (
            valueId !== false &&
            this._isValidElement(currentTarget, dataTransfer) &&
            this._hasValidFieldName(sectionId)
        ) {
            this._updateDragOverClass(currentTarget);
            const [section] = this.env.searchModel.getSections((s) => s.id === sectionId);
            const { childrenIds } = section.values.get(valueId);
            if (childrenIds && childrenIds.length) {
                // if the hovered folder has children, opens it and re renders the search panel
                // to allow drops in its children.
                this.state.expanded[sectionId][valueId] = true;
            }
        } else {
            this._updateDragOverClass();
        }
    }

    /**
     * @private
     * @param {DragEvent} ev
     */
    _onDragLeave({ relatedTarget, dataTransfer }) {
        if (!this._isValidElement(relatedTarget, dataTransfer)) {
            this._updateDragOverClass(null);
        }
    }

    /**
     * Allows the selected kanban cards to be dropped in folders (workspaces) or tags.
     * @private
     * @param {number} sectionId
     * @param {number | false} valueId
     * @param {DragEvent} ev
     */
    async _onDrop(sectionId, valueId, { currentTarget, dataTransfer }) {
        this._updateDragOverClass(null);
        if (
            valueId === false || // prevents dropping in "All" folder
            currentTarget.classList.contains("active") || // prevents dropping in the current folder
            !this._isValidElement(currentTarget, dataTransfer) ||
            !this._hasValidFieldName(sectionId)
        ) {
            return;
        }
        const { fieldName } = this.env.searchModel.getSections((s) => s.id === sectionId)[0];
        if (fieldName === "folder_id") {
            const currentFolder = this.env.searchModel.getSelectedFolder();
            const destinationFolder = this.env.searchModel.getFolders().find((folder) => folder.id === valueId);
            if (!currentFolder.has_write_access || !destinationFolder.has_write_access) {
                return this.notification.add(
                    this.env._t("You don't have the rights to move documents to that workspace"),
                    {
                        title: this.env._t("Access Error"),
                        type: "warning",
                    }
                );
            }
        }
        const data = JSON.parse(dataTransfer.getData("o_documents_data"));
        if (data.lockedCount) {
            return this.notification.add(
                sprintf(this.env._t("%s file(s) not moved because they are locked by another user"), data.lockedCount),
                {
                    title: this.env._t("Partial transfer"),
                    type: "warning",
                }
            );
        }
        if (fieldName === "folder_id") {
            this.env.searchModel.updateRecordFolderId(data.recordIds, valueId);
        } else {
            this.env.searchModel.updateRecordTagId(data.recordIds, valueId);
        }
    }

    /**
     * Handles the resize feature on the sidebar
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onStartResize(ev) {
        // Only triggered by left mouse button
        if (ev.button !== 0) {
            return;
        }

        const initialX = ev.pageX;
        const initialWidth = this.root.el.offsetWidth;
        const resizeStoppingEvents = ["keydown", "mousedown", "mouseup"];

        // Mousemove event : resize header
        const resizePanel = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const delta = ev.pageX - initialX;
            const newWidth = Math.max(10, initialWidth + delta);
            this.root.el.style["min-width"] = `${newWidth}px`;
        };
        document.addEventListener("mousemove", resizePanel, true);

        // Mouse or keyboard events : stop resize
        const stopResize = (ev) => {
            // Ignores the initial 'left mouse button down' event in order
            // to not instantly remove the listener
            if (ev.type === "mousedown" && ev.button === 0) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();

            document.removeEventListener("mousemove", resizePanel, true);
            resizeStoppingEvents.forEach((stoppingEvent) => {
                document.removeEventListener(stoppingEvent, stopResize, true);
            });
            // we remove the focus to make sure that the there is no focus inside
            // the panel. If that is the case, there is some css to darken the whole
            // thead, and it looks quite weird with the small css hover effect.
            document.activeElement.blur();
        };
        // We have to listen to several events to properly stop the resizing function. Those are:
        // - mousedown (e.g. pressing right click)
        // - mouseup : logical flow of the resizing feature (drag & drop)
        // - keydown : (e.g. pressing 'Alt' + 'Tab' or 'Windows' key)
        resizeStoppingEvents.forEach((stoppingEvent) => {
            document.addEventListener(stoppingEvent, stopResize, true);
        });
    }
}

DocumentsSearchPanel.modelExtension = "DocumentsSearchPanel";

if (!device.isMobile) {
    DocumentsSearchPanel.template = "documents.SearchPanel";
    DocumentsSearchPanel.subTemplates = {
        category: "documents.SearchPanel.Category",
        filtersGroup: "documents.SearchPanel.FiltersGroup",
    };
}
