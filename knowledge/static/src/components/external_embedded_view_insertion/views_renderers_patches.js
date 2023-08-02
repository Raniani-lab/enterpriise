/** @odoo-module */

import { _t } from "@web/legacy/js/services/core";
import { CalendarRenderer } from "@web/views/calendar/calendar_renderer";
import { CohortRenderer } from "@web_cohort/cohort_renderer";
import { GanttRenderer } from "@web_gantt/gantt_renderer";
import { GraphRenderer } from "@web/views/graph/graph_renderer";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { ListRenderer } from "@web/views/list/list_renderer";
import { MapRenderer } from "@web_map/map_view/map_renderer";
import { patch } from "@web/core/utils/patch";
import { PivotRenderer } from "@web/views/pivot/pivot_renderer";
import { SelectCreateDialog } from "@web/views/view_dialogs/select_create_dialog";
import {
    useBus,
    useOwnedDialogs,
    useService } from "@web/core/utils/hooks";
import { omit } from "@web/core/utils/objects";

/**
 * The following patch will add two new entries to the 'Favorites' dropdown menu
 * of the control panel namely: 'Insert view in article' and 'Insert link in article'.
 */
const EmbeddedViewRendererPatch = () => ({
    setup() {
        super.setup(...arguments);
        if (this.env.searchModel) {
            useBus(this.env.searchModel, 'insert-embedded-view', this._insertBackendBehavior.bind(this, 'render_embedded_view'));
            useBus(this.env.searchModel, 'insert-view-link', this._insertBackendBehavior.bind(this, 'render_embedded_view_link'));
            this.orm = useService('orm');
            this.actionService = useService('action');
            this.addDialog = useOwnedDialogs();
            this.userService = useService('user');
            this.knowledgeCommandsService = useService('knowledgeCommandsService');
        }
    },
    /**
     * Returns the full context that will be passed to the embedded view.
     * @returns {Object}
     */
    _getViewContext() {
        const context = {};
        if (this.env.searchModel) {
            // Store the context of the search model:
            Object.assign(context, omit(this.env.searchModel.context, ...Object.keys(this.userService.context)));
            // Store the state of the search model:
            Object.assign(context, {
                knowledge_search_model_state: JSON.stringify(this.env.searchModel.exportState())
            });
        }
        // Store the "local context" of the view:
        const fns = this.env.__getContext__.callbacks;
        const localContext = Object.assign({}, ...fns.map(fn => fn()));
        Object.assign(context, localContext);
        Object.assign(context, {
            knowledge_embedded_view_framework: 'owl'
        });
        return context;
    },
    /**
     * Prepare a Behavior rendered in backend to be inserted in an article by
     * the KnowledgeCommandsService.
     * Allow to choose an article in a modal, redirect to that article and
     * append the rendered template "blueprint" needed for the desired Behavior
     *
     * @param {string} renderFunctionName name of the python method to render
     *                 the template "blueprint" related to the desired Behavior
     */
    _insertBackendBehavior(renderFunctionName) {
        const config = this.env.config;
        if (config.actionType !== 'ir.actions.act_window') {
            return;
        }
        this._openArticleSelector(async id => {
            const context = this._getViewContext();
            context['keyOptionalFields'] = this.keyOptionalFields;
            const parser = new DOMParser();
            const behaviorBlueprint = await this.orm.call('knowledge.article', renderFunctionName,
                [[id],
                config.actionId,
                config.viewType,
                config.getDisplayName(),
                context]
            );
            this.knowledgeCommandsService.setPendingBehaviorBlueprint({
                behaviorBlueprint: parser.parseFromString(behaviorBlueprint, 'text/html').body.firstElementChild,
                model: 'knowledge.article',
                field: 'body',
                resId: id,
            });
            this.actionService.doAction('knowledge.ir_actions_server_knowledge_home_page', {
                additionalContext: {
                    res_id: id
                }
            });
        });
    },
    /**
     * @param {Function} onSelectCallback
     */
    _openArticleSelector(onSelectCallback) {
        this.addDialog(SelectCreateDialog, {
            title: _t('Select an article'),
            noCreate: false,
            multiSelect: false,
            resModel: 'knowledge.article',
            context: {},
            domain: [
                ['user_has_write_access', '=', true]
            ],
            onSelected: resIds => {
                onSelectCallback(resIds[0]);
            },
            onCreateEdit: async () => {
                const articleId = await this.orm.call('knowledge.article', 'article_create', [], {
                    is_private: true
                });
                onSelectCallback(articleId);
            },
        });
    },
});

const EmbeddedViewListRendererPatch = () => ({
    /**
     * @override
     * @returns {Object}
     */
    _getViewContext() {
        const context = super._getViewContext();
        Object.assign(context, {
            orderBy: JSON.stringify(this.props.list.orderBy)
        });
        return context;
    },
    /**
     * When the user hides/shows some columns from the list view, the system will
     * add a new cache entry in the local storage of the user and will list all
     * visible columns for the current view. To make the configuration specific to
     * a view, the system generates a unique key for the cache entry by using all
     * available information about the view.
     *
     * When loading the view, the system regenerates a key from the current view
     * and check if there is any entry in the cache for that key. If there is a
     * match, the system will load the configuration specified in the cache entry.
     *
     * For the embedded views of Knowledge, we want the configuration of the view
     * to be unique for each embedded view. To achieve that, we will overwrite the
     * function generating the key for the cache entry and include the unique id
     * of the embedded view.
     *
     * @override
     * @returns {string}
     */
    createKeyOptionalFields () {
        const embeddedViewId = this.env.searchModel ? this.env.searchModel.context.knowledgeEmbeddedViewId : null;
        if (this.env.searchModel && this.env.searchModel.context.keyOptionalFields) {
            const searchModelKeyOptionalFields = this.env.searchModel.context.keyOptionalFields;
            return searchModelKeyOptionalFields.includes(embeddedViewId)
                ? searchModelKeyOptionalFields
                : searchModelKeyOptionalFields + (embeddedViewId ? `,${embeddedViewId}` : "");
        }
        return super.createKeyOptionalFields(...arguments) + (embeddedViewId ? "," + embeddedViewId : "");
    },
});

patch(CalendarRenderer.prototype, EmbeddedViewRendererPatch());
patch(CohortRenderer.prototype, EmbeddedViewRendererPatch());
patch(GanttRenderer.prototype, EmbeddedViewRendererPatch());
patch(GraphRenderer.prototype, EmbeddedViewRendererPatch());
patch(KanbanRenderer.prototype, EmbeddedViewRendererPatch());
patch(ListRenderer.prototype, EmbeddedViewRendererPatch());
patch(ListRenderer.prototype, EmbeddedViewListRendererPatch());
patch(MapRenderer.prototype, EmbeddedViewRendererPatch());
patch(PivotRenderer.prototype, EmbeddedViewRendererPatch());

const supportedEmbeddedViews = new Set([
    'calendar',
    'cohort',
    'gantt',
    'graph',
    'kanban',
    'list',
    'map',
    'pivot',
]);

export {
    supportedEmbeddedViews,
};
