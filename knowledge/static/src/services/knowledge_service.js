/** @odoo-module **/

import { registry } from "@web/core/registry";

/**
 * This service store data from non-knowledge form view records that can be used
 * by a Knowledge form view.
 *
 * A typical usage could be the following:
 * - A form view is loaded and one field of the current record is a match for
 *   Knowledge @see FormControllerPatch
 *   - Information about this record and how to access its form view is stored
 *     in this @see KnowledgeService .
 * - A knowledge Article is opened and it contains a @see TemplateBehavior .
 *   - When the behavior is injected (@see HtmlFieldPatch ) in the view, it
 *     asks this @see KnowledgeService if the record can be interacted with.
 *   - if there is one such record, the related buttons are displayed in the
 *     toolbar of the behavior.
 * - When one such button is used, the form view of the record is reloaded
 *   and the button action is executed through a @see Macro .
 *   - an exemple of macro action would be copying the template contents as the
 *     value of a field_html of the record, such as "description"
 *
 * Scope of the service:
 * It is meant to be called on 2 occasions:
 * 1) by @see FormControllerPatch :
 *        It will only be called if the viewed record can be used within the
 *        Knowledge module. Such a record should have a chatter in its form
 *        view, or have at least one field in a whitelist specified in the
 *        controller, that is visible and editable by the current user.
 * 2) by @see TemplateBehavior or @see FileBehavior :
 *        It will be called by a behavior to check whether it has a record that
 *        can be interacted with in the context of the toolbar (withChatter or
 *        withHtmlField).
 */
export const knowledgeService = {
    start(env) {
        const records = new Set();
        let lastVisitedRecordWithChatter = null;
        let lastVisitedRecordWithHtmlField = null;

        /**
         * Called when a record may be used by a Knowledge form view.
         *
         * @param {Object} record
         */
        function registerRecord(record) {
            if (!record) {
                return;
            }
            records.add(record);
            if (record.withChatter) {
                /**
                 * if the record is flagged "withChatter", overwrite the previously
                 * registered record
                 */
                lastVisitedRecordWithChatter = record;
            }
            if (record.withHtmlField) {
                /**
                 * if the record is flagged "withHtmlField", overwrite
                 * the previously registered record
                 */
                lastVisitedRecordWithHtmlField = record;
            }
        }
        /**
         * Remove a record to signify that it can not be used by a Knowledge form
         * view anymore.
         *
         * @param {Object} record
         */
        function unregisterRecord(record) {
            records.delete(record);
        }
        /**
         * Recover a record that is able to interact with the chatter
         *
         * @returns {Object}
         */
        function getAvailableRecordWithChatter() {
            if (lastVisitedRecordWithChatter && !lastVisitedRecordWithChatter.withChatter) {
                records.delete(lastVisitedRecordWithChatter);
            }
            if (!records.has(lastVisitedRecordWithChatter)) {
                lastVisitedRecordWithChatter = null;
            }
            return lastVisitedRecordWithChatter;
        }
        /**
         * Recover a record that has an available html_field
         *
         * @returns {Object}
         */
        function getAvailableRecordWithHtmlField() {
            if (lastVisitedRecordWithHtmlField && !lastVisitedRecordWithHtmlField.withHtmlField) {
                records.delete(lastVisitedRecordWithHtmlField);
            }
            if (!records.has(lastVisitedRecordWithHtmlField)) {
                lastVisitedRecordWithHtmlField = null;
            }
            return lastVisitedRecordWithHtmlField;
        }
        /**
         * Recover a copy of the set of the currently registered records
         *
         * @returns {Set}
         */
        function getRecords() {
            return new Set(records);
        }

        const knowledgeService = {
            registerRecord,
            unregisterRecord,
            getAvailableRecordWithChatter,
            getAvailableRecordWithHtmlField,
            getRecords,
        };
        return knowledgeService;
    },
};

registry.category("services").add("knowledgeService", knowledgeService);
