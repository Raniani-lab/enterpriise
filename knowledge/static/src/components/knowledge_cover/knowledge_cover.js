/** @odoo-module **/

import { KnowledgeCoverDialog } from './knowledge_cover_dialog';
import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { throttleForAnimation } from "@web/core/utils/timing";
import { useService } from "@web/core/utils/hooks";

const { Component, onWillUpdateProps, useEffect, useRef, useState } = owl;

class KnowledgeCover extends Component {
    setup() {
        super.setup();
        this.dialog = useService("dialog");
        this.rpc = useService("rpc");
        this.root = useRef("root");
        this.image = useRef("image");
        this.state = useState({
            repositioning: false,
            grabbing: false,
            // cover_image_position is false if the cover has never been repositioned before
            verticalPosition: this.props.record.data.cover_image_position || 50,
        });

        // Update the state when we open an article (because since we open an
        // article by loading the related record, the state of this component
        // is shared between the articles and is not recomputed).
        onWillUpdateProps((nextProps) => {
            if (this.props.record.resId !== nextProps.record.resId) {
                this.state.repositioning = false;
                this.state.grabbing = false;
                this.state.verticalPosition = nextProps.record.data.cover_image_position || 50;
            }
        });

        this.addCover = this.addCover.bind(this);
        // The "add cover" button is outside of the component, so we attach a
        // listener to it when it is in the dom.
        useEffect((addCoverBtn) => {
            if (addCoverBtn) {
                addCoverBtn.addEventListener("mousedown", this.addCover);
                return () => addCoverBtn.removeEventListener("mousedown", this.addCover);
            }
        }, () => [document.querySelector(".o_knowledge_add_cover")]);
    }

    /**
     * @returns {boolean} - True if the article is editable
     */
    get isEditable() {
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
        if (!this.props.record.data.name) {
            // Rename the article if there is a title in the body
            await this.env.renameArticle();
        }
        try {
            const res = await this.rpc(`/knowledge/article/${this.props.record.resId}/add_random_cover`, {
                query: this.props.record.data.name,
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
        if (!this.props.record.data.name) {
            // Rename the article if there is a title in the body
            this.env.renameArticle();
        }
        this.openCoverSelector();
    }

    openCoverSelector() {
        this.dialog.add(KnowledgeCoverDialog, {
            articleCoverId: this.props.record.data.cover_image_id[0],
            articleName: this.props.record.data.name || "",
            save: async (id) => this.props.record.update({cover_image_id: [id]})
        });
    }

    removeCover() {
        this.props.record.update({cover_image_id: false});
    }

    /**
     * Make the cover draggable so that the user can reposition it.
     */
    repositionCover() {
        this.state.repositioning = true;
        const cover = this.image.el;
        let prevPos;

        const moveCover = throttleForAnimation(ev => {
            if (prevPos !== ev.y) {
                // Add offset proportional to the distance traveled by the cursor.
                // (dividing by 5 to not move the cover too fast). 
                const verticalPosition = this.state.verticalPosition + (prevPos - ev.y) / 5;
                // Make sure we are between 0.01 and 100% (not 0 since it's the
                // default value when the cover has never been repositioned).
                this.state.verticalPosition = Math.max(0.01, Math.min(100, verticalPosition));
                prevPos = ev.y;
            }
        });

        const onPointerUp = () => {
            this.state.grabbing = false;
            document.removeEventListener('pointermove', moveCover);
        };

        const onPointerDown = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            prevPos = ev.y;
            this.state.grabbing = true;
            document.addEventListener('pointermove', moveCover);
            document.addEventListener('pointerup', onPointerUp, {once: true});
        };

        cover.addEventListener('pointerdown', onPointerDown);

        // Click outside the cover (or on save button) leaves the repositioning mode
        document.addEventListener('pointerdown', (ev) => {
            cover.removeEventListener('pointerdown', onPointerDown);
            this.state.repositioning = false;
            if (ev.target.classList.contains('o_knowledge_undo_cover_move')) {
                // Undo move
                this.state.verticalPosition = this.props.record.data.cover_image_position || 50;
            } else {
                // Save new position
                this.props.record.update({cover_image_position: this.state.verticalPosition});
            }
        }, {once: true});
    }

}
KnowledgeCover.props = standardWidgetProps;
KnowledgeCover.template = "knowledge.KnowledgeCover";

export const knowledgeCover = {
    component: KnowledgeCover,
};
registry.category("view_widgets").add("knowledge_cover", knowledgeCover);
