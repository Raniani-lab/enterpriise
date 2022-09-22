/** @odoo-module */

import { Domain } from "@web/core/domain";
import { FormController } from "@web/views/form/form_controller";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

const { onPatched, onRendered } = owl;

/**
 * ordered by priority (the first match is chosen)
 */
const KNOWLEDGE_RECORDED_FIELD_NAMES = [
    'note',
    'memo',
    'description',
    'comment',
    'narration',
    'additional_note',
    'internal_notes',
    'notes',
];

const FormControllerPatch = {
    setup() {
        this._super(...arguments);
        this.knowledgeService = useService('knowledgeService');
        onRendered(() => {
            this._knowledgeRecordRegistration();
        });
        onPatched(() => {
            // onPatched is called way too many times, maybe think of a
            // system to only do the registration once when a new record
            // is saved (or when switching on an existing record when deleting
            // another)
            this._knowledgeRecordRegistration();
        });
    },
    /**
     * @returns {Array[Object]}
     */
    _getBreadcrumbsCopy() {
        return this.env.config.breadcrumbs.map(breadcrumb => {
            return {
                jsId: breadcrumb.jsId,
                name: breadcrumb.name,
            };
        });
    },
    _knowledgeRecordRegistration() {
        if (this.env.config.breadcrumbs && this.env.config.breadcrumbs.length) {
            if (this.preventKnowledgeFieldRegistration) {
                this._unregisterObsoleteKnowledgeRecords(this._getBreadcrumbsCopy());
            } else if (this.model.root.data.id) {
                this._searchKnowledgeRecord();
            }
        }
    },
    /**
     * This function will be used to evaluate given modifier based on the
     * value and the context of the given record.
     * @param {Object} record raw record
     * @param {string} modifier modifier as registered in the view (xml)
     * @returns {boolean}
     */
    _evalModifier(record, modifier) {
        if (!modifier) {
            return false;
        }
        try {
            const preDomain = new Domain(modifier); // unaware of context
            const domain = new Domain(preDomain.toList(record.context)); // aware of context
            return domain.contains(record.data);
        } catch (_error) {
            return true;
        }
    },
    _searchKnowledgeRecord() {
        // setup
        // the raw data of the record is needed to evaluate modifier domains
        // unless domain.js is updated to be able to use this.model.root.data
        // as is
        const record = this.model.__bm__.get(this.model.root.__bm_handle__, {raw: true});
        const formFields = this.props.archInfo.activeFields;
        const fields = this.props.fields;
        const xmlDoc = this.props.archInfo.xmlDoc;
        const breadcrumbs = this._getBreadcrumbsCopy();
        // format stored by the knowledgeService
        const knowledgeRecord = {
            resId: this.model.root.data.id,
            resModel: this.props.resModel,
            breadcrumbs: breadcrumbs,
            fieldNames: [],
            withChatter: false,
            withHtmlField: false,
            xmlDoc: this.props.archInfo.xmlDoc,
        };

        // revoke existing records with the exact same breadcrumbs sequence
        this._unregisterObsoleteKnowledgeRecords(breadcrumbs, true);

        // check whether the form view has a chatter with messages
        // decoupling is great and all, but are we really constrained to this to
        // know whether there is a chatter ? ...
        const chatterNode = this.props.archInfo.xmlDoc.querySelector('.oe_chatter');
        if (chatterNode && chatterNode.querySelector('field[name="message_ids"]')) {
            knowledgeRecord.withChatter = true;
            this.knowledgeService.registerRecord(knowledgeRecord);
        }

        // check if there is any html field usable with knowledge

        loopFieldNames: for (const fieldName of KNOWLEDGE_RECORDED_FIELD_NAMES) {
            if (fieldName in formFields &&
                fields[fieldName].type === 'html' &&
                !fields[fieldName].readonly
            ) {
                const readonlyModifier = formFields[fieldName].modifiers.readonly;
                const invisibleModifier = formFields[fieldName].modifiers.invisible;
                if (this._evalModifier(record, readonlyModifier) || this._evalModifier(record, invisibleModifier)) {
                    continue loopFieldNames;
                }
                const xmlFieldParent = xmlDoc.querySelector(`field[name="${fieldName}"]`).parentElement;
                let xmlInvisibleParent = xmlFieldParent.closest('[modifiers*="invisible"]');
                while (xmlInvisibleParent) {
                    const invisibleParentModifier = JSON.parse(xmlInvisibleParent.getAttribute('modifiers')).invisible;
                    if (this._evalModifier(record, invisibleParentModifier)) {
                        continue loopFieldNames;
                    }
                    xmlInvisibleParent = xmlInvisibleParent.parentElement &&
                        xmlInvisibleParent.parentElement.closest('[modifiers*="invisible"]');
                }
                // Here we can parse the XMLDOC recursively through parents and directly validate the
                // knowledgeRecord, and we can do it in order since the field names
                // are stored in order
                knowledgeRecord.fieldNames.push({
                    name: fieldName,
                    string: fields[fieldName].string,
                });
                break; // remove if all usable fields are needed at some point
            }
        }
        // call service to register a record
        if (knowledgeRecord.fieldNames.length) {
            knowledgeRecord.withHtmlField = true;
            this.knowledgeService.registerRecord(knowledgeRecord);
        }
    },
    /**
     * @param {Array[Object]} breadcrumbs
     * @param {boolean} revoke
     */
    _unregisterObsoleteKnowledgeRecords(breadcrumbs, revoke = false) {
        function areBreadcrumbsArraysEqual(b1, b2) {
            for (let i = 0; i < b1.length; i++) {
                if (b1[i].jsId !== b2[i].jsId || b1[i].name !== b2[i].name) {
                    return false;
                }
            }
            return true;
        }
        const records = this.knowledgeService.getRecords();
        let isObsolete = revoke;
        for (let record of records) {
            if (record.breadcrumbs.length > breadcrumbs.length) {
                isObsolete = !revoke;
            } else {
                const slicedBreadcrumbs = breadcrumbs.slice(0, record.breadcrumbs.length);
                if (areBreadcrumbsArraysEqual(record.breadcrumbs, slicedBreadcrumbs)) {
                    isObsolete = revoke;
                } else {
                    isObsolete = !revoke;
                }
            }
            if (isObsolete) {
                this.knowledgeService.unregisterRecord(record);
            }
        }
    },
};

patch(FormController.prototype, 'register_knowledge_fields', FormControllerPatch);
