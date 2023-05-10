/** @odoo-module */

import { KnowledgeArticleFormRenderer } from '@knowledge/js/knowledge_renderers';
import { ArticleSelectionBehaviorDialog } from '@knowledge/components/behaviors/article_behavior_dialog/article_behavior_dialog';
import { patch } from "@web/core/utils/patch";

patch(KnowledgeArticleFormRenderer.prototype, "portal_webclient", {
    onSearchBarClick() {
        this.dialog.add(
            ArticleSelectionBehaviorDialog,
            {
                title: this.env._t('Search an Article...'),
                confirmLabel: this.env._t('Open'),
                articleSelected: (article) => this.openArticle(article.articleId),
            }
        );
    },
});
