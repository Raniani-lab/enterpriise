/** @odoo-module */

import { useService } from "@web/core/utils/hooks";
import {
    Component,
    onMounted,
} from "@odoo/owl";

export class AbstractBehavior extends Component {
    setup() {
        super.setup();
        this.setupAnchor();
        this.knowledgeCommandsService = useService('knowledgeCommandsService');
        if (!this.props.readonly) {
            onMounted(() => {
                // Reconstruct the blueprint as an Element outside the DOM, but
                // with the original nodes to keep their OIDs.
                const blueprint = document.createElement('DIV');
                // Adding the blueprintNodes to the blueprint Element will
                // effectively remove them from the DOM. They are only removed
                // at this point because we never want the HtmlField to be in
                // a "corrupted" state during an asynchronous timespan (before
                // the mounting process).
                blueprint.replaceChildren(...this.props.blueprintNodes);
                // hook for extra rendering steps for Behavior (not done by
                // OWL templating system).
                this.extraRender();
                if (this.props.anchor.oid) {
                    // copy OIDs from the blueprint in case those OIDs
                    // are used in collaboration.
                    // this step is done before the component is inserted in the
                    // editable (when it is still in the rendering zone)
                    this.synchronizeOids(blueprint);
                }
                // the rendering was done outside of the OdooEditor,
                // onPreRendered contains instructions on how to move the
                // preRendered content in the editable.
                this.props.onPreRendered();
            });
        } else {
            onMounted(() => {
                this.props.blueprintNodes.forEach(child => child.remove());
            });
        }
    }
    /**
     * This method is used to ensure that the correct attributes are set
     * on the anchor of the Behavior. Attributes could be incorrect for the
     * following reasons: cleaned by the sanitization (frontend or backend),
     * attributes from a previous Odoo version, attributes from a drop/paste
     * of a Behavior which was in another state (i.e. from readonly to editable)
     */
    setupAnchor() {
        if (!this.props.readonly) {
            this.props.anchor.setAttribute('contenteditable', 'false');
            // prevent some interactions with OdooEditor, @see web_editor module
            this.props.anchor.dataset.oeProtected = "true";
        }
    }
    /**
     * @param {Element} blueprint node containing all original DOM nodes
     *                  from this.props.blueprintNodes.
     */
    synchronizeOids(blueprint) {
        // extract OIDs from `data-oe-protected='false'` elements which need to
        // be synchronized in collaborative mode from the blueprint.
        this.props.anchor.querySelectorAll('[data-oe-protected="false"][data-prop-name]').forEach(node => {
            const propName = node.dataset.propName;
            const blueprintElement = blueprint.querySelector(`[data-prop-name="${propName}"]`);
            if (!blueprintElement) {
                return;
            }
            // copy OIDs from the blueprint for a collaborative
            // node of the behavior
            const overrideOids = function (current, blueprintCurrent) {
                if (!current || !blueprintCurrent) {
                    console.warn('There was an issue during the collaborative synchronization, some elements may not be shared properly.')
                    return;
                }
                current.oid = blueprintCurrent.oid;
                delete current.ouid;
                if (current.nodeType === Node.ELEMENT_NODE && current.firstChild && blueprintCurrent.firstChild) {
                    overrideOids(current.firstChild, blueprintCurrent.firstChild);
                }
                if (current.nextSibling && blueprintCurrent.nextSibling) {
                    overrideOids(current.nextSibling, blueprintCurrent.nextSibling);
                }
            }
            overrideOids(node, blueprintElement);
        });
    }
    get editor () {
        return this.props.wysiwyg ? this.props.wysiwyg.odooEditor : undefined;
    }
    /**
     * @abstract
     * This method is is a hook executed during the onMounted hook, but
     * before the rendered Behavior is inserted in the editor (in edit mode).
     * It can be useful to manually insert nodes that can not be managed by OWL
     * templating system (i.e. because they will be altered by the editor),
     * before being observed by the editor and/or assigned an oid.
     * @see ArticlesStructureBehavior for an example.
     */
    extraRender() {}
}

AbstractBehavior.props = {
    readonly: { type: Boolean },
    anchor: { type: Element },
    wysiwyg: { type: Object, optional: true},
    record: { type: Object },
    root: { type: Element },
    // Hook for Behavior executed when they are mounted and synchronized (have
    // the correct oids for their collaborative nodes). Typically, it is handled
    // by the html_field and its purpose is to insert the Behavior anchor
    // at the correct position in the editable when it is fully pre-rendered
    // (=rendered outside of the editable).
    onPreRendered: { type: Function, optional: true},
    // HtmlElement children of the original anchor, before Component rendering.
    // They are the Elements that were used to extract html props for this
    // Behavior. This prop usage is to recover the OIDs set by the editor on
    // those nodes and to remove them from the DOM once the mounting is done.
    // Cases where the nodes possess a collaborative OID to recover
    // - received a node from a collaborator
    // - loaded the article as it is stored in the database in edit mode
    // - switching from readonly to edit mode
    // - undo/redo in the editor with the Behavior appearing/disappearing
    // - copy/paste, drag/drop elements with the Behavior
    blueprintNodes: { type: Array },
};
