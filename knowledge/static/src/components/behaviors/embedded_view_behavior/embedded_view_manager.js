/** @odoo-module **/

import { CallbackRecorder } from "@web/webclient/actions/action_hook";
import { getDefaultConfig, View } from "@web/views/view";
import { PromptEmbeddedViewNameDialog } from "@knowledge/components/prompt_embedded_view_name_dialog/prompt_embedded_view_name_dialog";
import { useOwnDebugContext } from "@web/core/debug/debug_context";
import { useService } from "@web/core/utils/hooks";

const {
    Component,
    onMounted,
    onWillStart,
    useEffect,
    useRef,
    useSubEnv } = owl;

/**
 * Wrapper for the embedded view, manage the toolbar and the embedded view props
 */
export class EmbeddedViewManager extends Component {
    setup() {
        // allow access to the SearchModel exported state which contain facets
        this.__getGlobalState__ = new CallbackRecorder();

        this.actionService = useService('action');
        this.dialogService = useService('dialog');
        this.orm = useService('orm');
        this.resizer = useRef('resizer');

        useOwnDebugContext(); // define a debug context when the developer mode is enable
        useSubEnv({
            config: getDefaultConfig(),
            __getGlobalState__: this.__getGlobalState__,
        });
        useEffect(this.setResizerListener.bind(this), () => [this.resizer.el]);
        onWillStart(this.onWillStart.bind(this));
        onMounted(this.onMounted.bind(this));
    }

    /**
     * Extract the SearchModel state of the embedded view
     *
     * @returns {Object} globalState
     */
    getEmbeddedViewGlobalState() {
        const callbacks = this.__getGlobalState__.callbacks;
        let globalState;
        if (callbacks.length) {
            globalState = callbacks.reduce((res, callback) => {
                return { ...res, ...callback() };
            }, {});
        }
        return { searchModel: globalState && globalState.searchModel };
    }

    /**
     * Recover the action from its parsed state (attrs of the Behavior block)
     * and setup the embedded view props
     */
    onWillStart () {
        const { action, context, viewType } = this.props;
        this.env.config.setDisplayName(action.display_name);
        this.env.config.views = action.views;
        const ViewProps = {
            resModel: action.res_model,
            context: context,
            domain: action.domain || [],
            type: viewType,
            loadIrFilters: true,
            loadActionMenus: true,
            globalState: { searchModel: context.knowledge_search_model_state },
            /**
             * @param {integer} recordId
             */
            selectRecord: recordId => {
                const [formViewId] = this.action.views.find((view) => {
                    return view[1] === 'form';
                }) || [false];
                this.actionService.doAction({
                    type: 'ir.actions.act_window',
                    res_model: action.res_model,
                    views: [[formViewId, 'form']],
                    res_id: recordId,
                });
            },
            createRecord: async () => {
                const ctx = {};
                for (const key of ['active_id', 'active_ids', 'active_model']) {
                    if (context.hasOwnProperty(key)) {
                        ctx[key] = context[key];
                    }
                }
                const [formViewId] = this.action.views.find((view) => {
                    return view[1] === 'form';
                }) || [false];
                this.actionService.doAction({
                    type: 'ir.actions.act_window',
                    res_model: action.res_model,
                    views: [[false, 'form']],
                    context: ctx,
                });
            },
        };
        if (action.search_view_id) {
            ViewProps.searchViewId = action.search_view_id[0];
        }
        this.EmbeddedView = View;
        this.EmbeddedViewProps = ViewProps;
        this.action = action;
        this.props.onLoadStart();
    }

    onMounted () {
        this.props.onLoadEnd();
    }

    /**
     * Rename an embedded view
     */
    _onRenameBtnClick () {
        this.dialogService.add(PromptEmbeddedViewNameDialog, {
            isNew: false,
            defaultName: this.props.getTitle(),
            viewType: this.props.viewType,
            save: name => {
                this.props.setTitle(name);
            },
            close: () => {}
        });
    }

    /**
     * Open an embedded view (fullscreen)
     */
    _onOpenBtnClick () {
        if (this.action.type !== "ir.actions.act_window") {
            throw new Error('Can not open the view: The action is not an "ir.actions.act_window"');
        }
        this.action.globalState = this.getEmbeddedViewGlobalState();
        this.actionService.doAction(this.action, {
            viewType: this.props.viewType,
        });
    }

    /**
     * Binds new event listeners to the resizer bar of the embedded view.
     * These listeners will let the user to resize the embedded view vertically
     * by dragging the resize bar.
     * @returns {Function}
     */
    setResizerListener () {
        const container = this.props.el;
        const resizer = this.resizer.el;
        /**
         * @param {Event} event
         */
        const onPointerMove = event => {
            const rect = container.getBoundingClientRect();
            const height = (event.pageY + resizer.clientHeight / 2) - rect.top;
            container.style.setProperty('--default-embedded-view-size', height + 'px');
        };
        /**
         * @param {Event} event
         */
        const onPointerUp = event => {
            document.body.removeEventListener('mousemove', onPointerMove);
            document.body.removeEventListener('mouseup', onPointerUp);
            document.body.removeEventListener('mouseleave', onPointerUp);
        };
        /**
         * @param {Event} event
         */
        const onPointerDown = event => {
            event.preventDefault();
            event.stopPropagation();
            document.body.addEventListener('mousemove', onPointerMove);
            document.body.addEventListener('mouseup', onPointerUp);
            document.body.addEventListener('mouseleave', onPointerUp);
        };
        resizer.addEventListener('mousedown', onPointerDown);
        return () => {
            resizer.removeEventListener('mousedown', onPointerDown);
            document.body.removeEventListener('mousemove', onPointerMove);
            document.body.removeEventListener('mouseup', onPointerUp);
            document.body.removeEventListener('mouseleave', onPointerUp);
        };
    }
}

EmbeddedViewManager.template = 'knowledge.EmbeddedViewManager';
EmbeddedViewManager.props = {
    el: { type: HTMLElement },
    action: { type: Object },
    context: { type: Object },
    viewType: { type: String },
    onLoadStart: { type: Function },
    onLoadEnd: { type: Function },
    setTitle: { type: Function },
    getTitle: { type: Function },
    readonly: { type: Boolean },
};
