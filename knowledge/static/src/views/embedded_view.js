/** @odoo-module */

import { KnowledgeSearchModel } from "@knowledge/search_model/search_model";
import { View } from "@web/views/view";

export class EmbeddedView extends View {
    static props = {
        ...View.props,
        onSaveKnowledgeFavorite: Function,
        onDeleteKnowledgeFavorite: Function,
    };

    async loadView(props) {
        const viewProps = { ...props };
        delete viewProps.onSaveKnowledgeFavorite;
        delete viewProps.onDeleteKnowledgeFavorite;
        await super.loadView(viewProps);
        this.withSearchProps.SearchModel = KnowledgeSearchModel;
        this.withSearchProps.searchModelArgs = {
            onSaveKnowledgeFavorite: props.onSaveKnowledgeFavorite,
            onDeleteKnowledgeFavorite: props.onDeleteKnowledgeFavorite,
        };
    }
}
