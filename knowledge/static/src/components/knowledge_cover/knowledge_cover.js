/** @odoo-module **/

import { KnowledgeCoverDialog } from './knowledge_cover_dialog';
import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { useService } from "@web/core/utils/hooks";

const { Component, useEffect, useRef } = owl;

class KnowledgeCover extends Component {
    setup() {
        super.setup();
        this.dialog = useService("dialog");
        this.rpc = useService("rpc");
        this.root = useRef("root");

        this.addCover = this.addCover.bind(this);
        // The "add cover" button is outside of the component, so we attach a
        // listener to it when it is in the dom.
        useEffect(() => {
            const addCoverBtn = document.querySelector(".o_knowledge_add_cover");
            if (addCoverBtn) {
                addCoverBtn.addEventListener("mousedown", this.addCover);
                return () => addCoverBtn.removeEventListener("mousedown", this.addCover);
            }
        }, () => [this.root.el]);
    }

    /**
     * @returns {boolean} - True if the cover edition buttons should be shown
     */
    get showButtons() {
        const recordData = this.props.record.data;
        return !recordData.is_locked && recordData.user_can_write && recordData.active;
    }

    /**
     * Adds a random cover using unsplash. If unsplash throws an error (service
     * down/keys unset), opens the cover selector instead.
     * @param {Event} event
     */
    async addCover(event) {
        // Keep body focused
        event.preventDefault();
        // Disable button to prevent multiple calls
        event.target.classList.add('disabled');
        if (this.props.record.data.name === this.env._t('Untitled')) {
            // Rename the article if there is a title in the body
            await this.env.renameArticle();
        }
        const articleName = this.props.record.data.name;
        try {
            const res = await this.rpc(`/knowledge/article/${this.props.record.resId}/add_random_cover`, {
                query: articleName === this.env._t('Untitled') ? '' : articleName,
                orientation: 'landscape',
            });
            if (res.cover_id) {
                await this.props.record.update({cover_image_id: [res.cover_id]});
            } else {
                this.openCoverSelector();
            }
        } catch {
            this.openCoverSelector();
        }
        event.target.classList.remove('disabled');
    }


    changeCover() {
        if (this.props.record.data.name === this.env._t("Untitled")) {
            // Rename the article if there is a title in the body
            this.env.renameArticle();
        }
        this.openCoverSelector();
    }

    openCoverSelector() {
        const articleName = this.props.record.data.name;
        this.dialog.add(KnowledgeCoverDialog, {
            articleCoverId: this.props.record.data.cover_image_id[0],
            articleName: articleName === this.env._t('Untitled') ? '' : articleName,
            save: async (id) => this.props.record.update({cover_image_id: [id]})
        });
    }

    removeCover() {
        this.props.record.update({cover_image_id: false});
    }

}
KnowledgeCover.props = standardWidgetProps;
KnowledgeCover.template = "knowledge.KnowledgeCover";

registry.category("view_widgets").add("knowledge_cover", KnowledgeCover);
