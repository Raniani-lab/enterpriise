/** @odoo-module */

import config from "web.config";
import { FormRenderer } from '@web/views/form/form_renderer';
import { KnowledgeCoverDialog } from '@knowledge/components/knowledge_cover/knowledge_cover_dialog';
import "@mail/views/form/form_renderer"; // Chatter
import { useService } from "@web/core/utils/hooks";
import { useChildSubEnv, useEffect, useRef, xml } from "@odoo/owl";

export class KnowledgeArticleFormRenderer extends FormRenderer {

    //--------------------------------------------------------------------------
    // Component
    //--------------------------------------------------------------------------
    setup() {
        super.setup();

        this.actionService = useService("action");
        this.dialog = useService("dialog");
        this.orm = useService("orm");
        this.rpc = useService("rpc");
        this.userService = useService("user");

        this.root = useRef('compiled_view_root');

        this.device = config.device;

        useChildSubEnv({
            openCoverSelector: this.openCoverSelector.bind(this),
            config: this.env.config,
            _resizeNameInput: this._resizeNameInput.bind(this),
            toggleFavorite: this.toggleFavorite.bind(this),
            _saveIfDirty: this._saveIfDirty.bind(this),
        });
    }


    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * FIXME: the knowledge arch uses a lot of implementation details. It shouldn't. We here extend
     * the rendering context to keep those details available, but the long term strategy must be
     * to stop using them in the arch.
     *
     * @override
     */
    get renderingContext() {
        return {
            __comp__: this, // used by the compiler
        };
    }

    /**
     * Create a new article and open it.
     * @param {String} category - Category of the new article
     * @param {integer} targetParentId - Id of the parent of the new article (optional)
     */
    async createArticle(category, targetParentId) {
        const articleId = await this.orm.call(
            "knowledge.article",
            "article_create",
            [],
            {
                is_private: category === 'private',
                parent_id: targetParentId ? targetParentId : false
            }
        );
        this.openArticle(articleId);
    }

    /**
     * @param {integer} - resId: id of the article to open
     */
    async openArticle(resId) {

        if (!resId || resId === this.resId) {
            return;
        }

        // Usually in a form view, an input field is added to the list of dirty
        // fields of a record when the input loses the focus.
        // In this case, the focus could still be on the name input or in the
        // body when clicking on an article name. Since the blur event is not
        // asynchronous, the focused field is not yet added in the record's 
        // list of dirty fields when saving before opening another article.
        // askChanges() allows to make sure that these fields are added to the
        // record's list of dirty fields if they have been modified.
        if (this.resId && this.props.record.data.user_can_write) {
            if (document.activeElement.id === "name") {
                // blur to remove focus on input
                document.activeElement.blur();
                await this.props.record.askChanges();
            } else if (this.root.el.querySelector('div[name="body"]').contains(document.activeElement)) {
                await this.props.record.askChanges();
            }
        }
        // Force save if changes have been made before loading the new record
        await this._saveIfDirty();

        const scrollView = document.querySelector('.o_scroll_view_lg');
        if (scrollView) {
            // hide the flicker
            scrollView.style.visibility = 'hidden';
            // Scroll up if we have a desktop screen
            scrollView.scrollTop = 0;
        }

        const mobileScrollView = document.querySelector('.o_knowledge_main_view');
        if (mobileScrollView) {
            // Scroll up if we have a mobile screen
            mobileScrollView.scrollTop = 0;
        }
        // load the new record
        try {
            await this.props.record.model.load({
                resId: resId,
            });
        } catch {
            this.actionService.doAction(
                await this.orm.call('knowledge.article', 'action_home_page', [false]),
                {stackPosition: 'replaceCurrentAction'}
            );
        }

        if (scrollView) {
            // Show loaded document
            scrollView.style.visibility = 'visible';
        }
        if (this.device.isMobile) {
            this.env.toggleAside(false);
        }
    }

    openCoverSelector() {
        this.dialog.add(KnowledgeCoverDialog, {
            articleCoverId: this.props.record.data.cover_image_id[0],
            articleName: this.props.record.data.name || "",
            save: (id) => this.props.record.update({cover_image_id: [id]})
        });
    }

    get resId() {
        return this.props.record.resId;
    }

    /**
     * Add/Remove article from favorites and reload the favorite tree.
     * One does not use "record.update" since the article could be in readonly.
     * @param {event} Event
     */
    async toggleFavorite(event) {
        // Save in case name has been edited, so that this new name is used
        // when adding the article in the favorite section.
        await this._saveIfDirty();
        await this.orm.call(this.props.record.resModel, "action_toggle_favorite", [[this.resId]]);
        // Load to have the correct value for 'is_user_favorite'.
        await this.props.record.load();
        // Rerender the favorite button.
        await this.props.record.model.notify();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------    

    /**
     * Resize the name input by updating the value of the span hidden behind
     * the input.
     */
    _resizeNameInput(name) {
        this.root.el.querySelector('.o_breadcrumb_article_name_container > span').innerText = name;
    }

    async _saveIfDirty() {
        if (this.props.record.isDirty) {
            await this.props.record.save();
        }
    }

    _scrollToElement(container, element) {
        const rect = element.getBoundingClientRect();
        container.scrollTo(rect.left, rect.top);
    }
}

// FIXME: this should be removed, the rendering context of the form view should not be overridden
KnowledgeArticleFormRenderer.template = xml`<t t-call="{{ templates.FormRenderer }}" t-call-context="renderingContext" />`;
