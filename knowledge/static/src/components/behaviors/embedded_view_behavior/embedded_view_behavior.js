/** @odoo-module */

import { AbstractBehavior } from "@knowledge/components/behaviors/abstract_behavior/abstract_behavior";
import { EmbeddedViewManager } from "@knowledge/components/behaviors/embedded_view_behavior/embedded_view_manager";
import { makeContext } from "@web/core/context";
import {
    decodeDataBehaviorProps,
    encodeDataBehaviorProps,
    setIntersectionObserver
} from "@knowledge/js/knowledge_utils";
import { useService } from "@web/core/utils/hooks";
import { uuid } from "@web/views/utils";
import {
    onError,
    onMounted,
    onWillDestroy,    
    useState,
    useSubEnv } from "@odoo/owl";

/**
 * This component will have the responsibility to load the embedded view lazily
 * when it becomes visible on screen. The component will also have the responsibility
 * to handle errors that may occur when loading an embedded view.
 */
export class EmbeddedViewBehavior extends AbstractBehavior {
    setup () {
        super.setup();
        this.actionService = useService('action');
        this.state = useState({
            waiting: true,
            error: false
        });

        let embeddedViewId = this.props.embedded_view_id;
        if (!embeddedViewId) {
            embeddedViewId = uuid();
            const { anchor } = this.props;
            anchor.dataset.behaviorProps = encodeDataBehaviorProps(Object.assign(
                decodeDataBehaviorProps(anchor.dataset.behaviorProps),
                { embedded_view_id: embeddedViewId }
            ));
        }

        useSubEnv({
            knowledgeEmbeddedViewId: embeddedViewId
        });

        onMounted(() => {
            const { anchor, root } = this.props;
            if (root.contains(anchor)) {
                this.setupIntersectionObserver();
            } else {
                // If the anchor is not already in the editable, it means that
                // it was pre-rendered in a d-none element and is waiting
                // to be inserted. The intersectionObserver must wait for the
                // anchor to be in the editable before being set up, because
                // it will not detect that it is visible if the insertion
                // moves the anchor from the d-none element to a visible
                // sector of the editable.
                this.insertionObserver = new MutationObserver(mutationList => {
                    const isAdded = mutationList.find(mutation => {
                        return Array.from(mutation.addedNodes).find(node => node === anchor);
                    });
                    if (isAdded) {
                        this.insertionObserver.disconnect();
                        this.setupIntersectionObserver();
                    }
                });
                this.insertionObserver.observe(root, {childList: true});
            }
            /**
             * Capturing the events occuring in the embedded view to prevent the
             * default behavior of the editor.
             */
            const stopEventPropagation = event => event.stopPropagation();
            anchor.addEventListener('keydown', stopEventPropagation);
            anchor.addEventListener('keyup', stopEventPropagation); // power box
            anchor.addEventListener('input', stopEventPropagation);
            anchor.addEventListener('beforeinput', stopEventPropagation);
            anchor.addEventListener('paste', stopEventPropagation);
            anchor.addEventListener('drop', stopEventPropagation);
        });

        onWillDestroy(() => {
            if (this.observer) {
                this.observer.disconnect();
            }
            if (this.insertionObserver) {
                this.insertionObserver.disconnect();
            }
        });

        onError(error => {
            console.error(error);
            this.state.error = true;
        });
    }

    setupIntersectionObserver() {
        this.observer = setIntersectionObserver(this.props.anchor, async () => {
            await this.loadData();
            this.state.waiting = false;
        });
    }

    async loadData () {
        const context = makeContext([this.props.context || {}]);
        try {
            const action = await this.actionService.loadAction(
                this.props.act_window || this.props.action_xml_id,
                context
            );
            if (action.type !== "ir.actions.act_window") {
                this.state.error = true;
                return;
            }
            if (this.props.display_name) {
                action.name = this.props.display_name;
                action.display_name = this.props.display_name;
            }
            if (this.props.action_help) {
                action.help = this.props.action_help;
            }
            this.embeddedViewManagerProps = {
                el: this.props.anchor,
                action,
                context,
                viewType: this.props.view_type,
                setTitle: this.setTitle.bind(this),
                getTitle: this.getTitle.bind(this),
                readonly: this.props.readonly,
                record: this.props.record,
            };
        } catch {
            this.state.error = true;
        }
    }

    /**
     * Set the title of the embedded view.
     * @param {String} name
     */
    setTitle (name) {
        const behaviorProps = decodeDataBehaviorProps(this.props.anchor.getAttribute('data-behavior-props'));
        if (behaviorProps.act_window) {
            behaviorProps.act_window.name = name;
            behaviorProps.act_window.display_name = name;
        }
        if (behaviorProps.display_name) {
            behaviorProps.display_name = name;
        }
        this.props.anchor.dataset.behaviorProps = encodeDataBehaviorProps(behaviorProps);
        this.embeddedViewManagerProps.action.name = name;
        this.embeddedViewManagerProps.action.display_name = name;
        const title = this.props.anchor.querySelector('.o_control_panel .breadcrumb-item.active');
        if (title) {
            title.textContent = name;
        }
    }

    /**
     * Get the title of the embedded view.
     * @returns {String}
     */
    getTitle () {
        return this.embeddedViewManagerProps.action.display_name ||
               this.embeddedViewManagerProps.action.name ||
               '';
    }
}

EmbeddedViewBehavior.template = "knowledge.EmbeddedViewBehavior";
EmbeddedViewBehavior.components = {
    EmbeddedViewManager,
};
EmbeddedViewBehavior.props = {
    ...AbstractBehavior.props,
    embedded_view_id: { type: String, optional: true },
    act_window: { type: Object, optional: true },
    action_xml_id: { type: String, optional: true },
    context: { type: Object, optional: true },
    display_name: { type: String, optional: true },
    view_type: { type: String },
    action_help: { type: Object, optional: true},
};
