/** @odoo-module **/
import { formatDateTime } from '@web/core/l10n/dates';
import { registry } from '@web/core/registry';
import { standardWidgetProps } from '@web/views/widgets/standard_widget_props';
import { useService } from '@web/core/utils/hooks';


import {
    Component, onMounted, onPatched, onWillPatch, useExternalListener, useRef, useState
} from '@odoo/owl';

import MoveArticleDialog from "@knowledge/components/move_article_dialog/move_article_dialog";
import PermissionPanel from '@knowledge/components/permission_panel/permission_panel';


class KnowledgeTopbar extends Component {
    setup(){
        this.actionService = useService('action');
        this.buttonSharePanel = useRef('sharePanel_button');
        this.dialog = useService('dialog');

        this.formatDateTime = formatDateTime;
        this.orm = useService('orm');
        this.propertiesUpdated = false;

        this.state = useState({
            displayChatter: false,
            displayPropertyPanel: false,
            displayPropertyToggle: false,
        });

        /**
         * We are using this hook in order to avoid using a `this.env.model.notify` inside of the renderer,
         * which causes the renderer to notify ALL of its child Components and launches unnecesary rerendering
         * of some children.
         * This hook enables us to add a handler on a specific part of the document, but since in our case it is not already rendered,
         * we are targeting the body and only changing our state when the target of the event is the right button.
         */
        useExternalListener(document, 'click', this._handleProperties);

        onWillPatch(() => {
            this.state.displayPropertyToggle = this.props.record.data.article_properties.length !== 0 || (this.props.record.data.parent_id !== false && this.env._arePropertiesActivated());
            if (!this.propertiesUpdated || this.props.record.data.parent_id === false) {
                this.state.displayPropertyPanel = this.env._isPanelDisplayed();
                this.propertiesUpdated = true;
            }
            if (this.props.record.data.parent_id === false) this.propertiesUpdated = false;
        });

        onMounted(() => {
            if (!this.state.createDate){
                this._setDates();
            }
            this.state.displayPropertyToggle = (this.props.record.data.parent_id !== false && this.props.record.data.article_properties.length !== 0);
            this.state.displayPropertyPanel = this.state.displayPropertyToggle;
            if (this.buttonSharePanel.el){
                this.buttonSharePanel.el.addEventListener(
                    'shown.bs.dropdown',
                    () => this.state.displaySharePanel = true
                );
                this.buttonSharePanel.el.addEventListener(
                    'hidden.bs.dropdown',
                    () => this.state.displaySharePanel = false
                );
            }

        });
        onPatched(() => {
            this._setDates();
        });
    }

    _setDates() {
        if(this.props.record.data.create_date && this.props.record.data.last_edition_date) {
            this.state.createDate = this.props.record.data.create_date.toRelative();
            this.state.editionDate = this.props.record.data.last_edition_date.toRelative();
        }
    }
    _handleProperties(ev) {
        if (ev.target.classList.contains('o_knowledge_add_properties')) {
            this.state.displayPropertyToggle = true;
            this.env.addProperties(ev);
        }
    }

    /**
     * Copy the current article in private section and open it.
     */
    async copyArticleAsPrivate() {
        await this.env._saveIfDirty();
        const articleId = await this.orm.call(
            'knowledge.article',
            'action_make_private_copy',
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
     * Show/hide the Property Fields right panel.
     */
    toggleProperties() {
        this.state.displayPropertyPanel = !this.state.displayPropertyPanel;
        this.env.toggleProperties();
    }

    async setIsArticleItem(newArticleItemStatus){
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
    async _onMemberAvatarClick (event, userId) {
        event.preventDefault();
        event.stopPropagation();
        if (userId) {
            const messaging = await this.env.messagingService.get();
            await messaging.openChat({
                userId: userId
            });
        }
    }

    /**
     * When the user clicks on the name of the article, checks if the article
     * name hasn't been set yet. If it hasn't, it will look for a title in the
     * body of the article and set it as the name of the article.
     * @param {Event} event
     */
    async _onNameClick(event) {
        if (!this.props.record.data.name) {
            await this.env.renameArticle();
            window.setTimeout(() => {
                event.target.select();
            });
        }
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
