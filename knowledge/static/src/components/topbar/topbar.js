/** @odoo-module **/
import { formatDateTime } from '@web/core/l10n/dates';
import { registry } from '@web/core/registry';
import { standardWidgetProps } from '@web/views/widgets/standard_widget_props';
import { useService } from '@web/core/utils/hooks';
import { useOpenChat } from "@mail/web/open_chat_hook";


import { Component, onPatched, useEffect, useRef, useState } from '@odoo/owl';

import MoveArticleDialog from "@knowledge/components/move_article_dialog/move_article_dialog";
import PermissionPanel from '@knowledge/components/permission_panel/permission_panel';


class KnowledgeTopbar extends Component {
    setup() {
        super.setup();
        this.actionService = useService('action');
        this.dialog = useService('dialog');
        this.orm = useService('orm');
        this.rpc = useService('rpc');
        this.uiService = useService('ui');

        this.buttonSharePanel = useRef('sharePanel_button');
        this.optionsBtn = useRef('optionsBtn');

        this.formatDateTime = formatDateTime;

        this.state = useState({
            displayChatter: false,
            displayPropertyPanel: !this.props.record.data.article_properties_is_empty,
            displaySharePanel: false,
        });

        this.openChat = useOpenChat('res.users');

        onPatched(() => {
            // Create the first property when clicking on "Add Properties"
            // button, once the properties panel is added in the dom.
            if (this.addPropertyOnPatch && document.querySelector('.o_knowledge_properties')) {
                document.querySelector('.o_field_property_add button').click();
                this.addPropertyOnPatch = false;
            }
        });

        useEffect((optionsBtn) => {
            // Refresh "last edited" and "create date" when opening the options
            // panel
            if (optionsBtn) {
                optionsBtn.addEventListener(
                    'shown.bs.dropdown',
                    () => this._setDates()
                );
            }
        }, () => [this.optionsBtn.el]);

        useEffect(() => {
            // When opening (or moving) an article, display the properties
            // panel if the article has properties.
            this.state.displayPropertyPanel = !this.props.record.data.article_properties_is_empty;
        }, () => [this.resId, this.props.record.data.article_properties_is_empty]);

        useEffect((shareBtn) => {
            if (shareBtn) {
                shareBtn.addEventListener(
                    // Prevent hiding the dropdown when the invite modal is shown
                    'hide.bs.dropdown', (ev) => {
                        if (this.uiService.activeElement !== document) {
                            ev.preventDefault();
                        }
                });
                shareBtn.addEventListener(
                    'shown.bs.dropdown',
                    () => this.state.displaySharePanel = true
                );
                shareBtn.addEventListener(
                    'hidden.bs.dropdown',
                    () => this.state.displaySharePanel = false
                );
            }
        }, () => [this.buttonSharePanel.el]);
    }

    /**
     * Adds a random cover using unsplash. If unsplash throws an error (service
     * down/keys unset), opens the cover selector instead.
     * @param {Event} event
     */
    async addCover(event) {
        // Disable button to prevent multiple calls
        event.target.classList.add('disabled');
        this.env.ensureArticleName();
        let res = {};
        try {
            res = await this.rpc(`/knowledge/article/${this.props.record.resId}/add_random_cover`, {
                query: this.props.record.data.name,
                orientation: 'landscape',
            });
        } catch (e) {
            console.error(e);
        }
        if (res.cover_id) {
            await this.props.record.update({cover_image_id: [res.cover_id]});
        } else {
            // Unsplash keys unset or rate limit exceeded
            this.env.openCoverSelector();
        }
        event.target.classList.remove('disabled');
    }

    async addProperties() {
        this.toggleProperties();
        this.addPropertyOnPatch = true;
    }

    _setDates() {
        if (this.props.record.data.create_date && this.props.record.data.last_edition_date) {
            this.state.createDate = this.props.record.data.create_date.toRelative();
            this.state.editionDate = this.props.record.data.last_edition_date.toRelative();
        }
    }

    toggleProperties() {
        this.env.toggleProperties();
        this.state.displayPropertyPanel = !this.state.displayPropertyPanel;
    }

    /**
     * Copy the current article in private section and open it.
     */
    async cloneArticle() {
        await this.env._saveIfDirty();
        const articleId = await this.orm.call(
            'knowledge.article',
            'action_clone',
            [this.props.record.data.id]
        );
        this.env.openArticle(articleId, true);
    }

    async setLockStatus(newLockStatus) {
        await this.props.record.model.root.askChanges();
        await this.env._saveIfDirty();
        await this.orm.call(
            'knowledge.article',
            `action_set_${newLockStatus ? 'lock' : 'unlock'}`,
            [this.props.record.data.id],
        );
        await this.props.record.update({'is_locked': newLockStatus});
    }

    /**
     * Show the Dialog allowing to move the current article.
     */
    onMoveArticleClick() {
        this.dialog.add(
            MoveArticleDialog,
            {
                articleName: this.props.record.data.name,
                articleId: this.props.record.data.id,
                category: this.props.record.data.category,
                moveArticle: this.env._moveArticle.bind(this),
                reloadTree: this.env._renderTree.bind(this),
            }
        );
    }

    /**
     * Show/hide the chatter. When showing it, it fetches data required for
     * new messages, activities, ...
     */
    toggleChatter() {
        if (this.props.record.data.id) {
            this.state.displayChatter = !this.state.displayChatter;
            this.env.toggleChatter();
        }
    }

    async unarchiveArticle() {
        this.actionService.doAction(
            await this.orm.call(
                'knowledge.article',
                'action_unarchive_article',
                [this.props.record.data.id]
            ),
            {stackPosition: 'replaceCurrentAction'}
        );
    }

    /**
     * Set the value of is_article_item for the current record.
     * @param {boolean} newArticleItemStatus: new is_article_item value
     */
    async setIsArticleItem(newArticleItemStatus) {
        await this.props.record.update({is_article_item: newArticleItemStatus});
        await this.props.record.save({stayInEdition: true});
        this.env._renderTree(this.props.record.data.id, '/knowledge/tree_panel');
    }

    async deleteArticle() {
        this.actionService.doAction(
            await this.orm.call(
                'knowledge.article',
                'action_send_to_trash',
                [this.props.record.data.id]
            ),
            {stackPosition: 'replaceCurrentAction'}
        );
    }

    /**
     * @param {Event} event
     * @param {Proxy} member
     */
    async _onMemberAvatarClick(event, userId) {
        event.preventDefault();
        event.stopPropagation();
        if (userId) {
            await this.openChat(userId);
        }
    }

    /**
     * When the user clicks on the name of the article, checks if the article
     * name hasn't been set yet. If it hasn't, it will look for a title in the
     * body of the article and set it as the name of the article.
     * @param {Event} event
     */
    async _onNameClick(event) {
        this.env.ensureArticleName();
        window.setTimeout(() => {
            event.target.select();
        });
    }

}
KnowledgeTopbar.template = 'knowledge.KnowledgeTopbar';
KnowledgeTopbar.props = {
    ...standardWidgetProps,
};
KnowledgeTopbar.components = {
    PermissionPanel,
};
export const knowledgeTopbar = {
    component: KnowledgeTopbar,
};

registry.category('view_widgets').add('knowledge_topbar', knowledgeTopbar);
