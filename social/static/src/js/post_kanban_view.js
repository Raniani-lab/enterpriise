/** @odoo-module **/

import { KanbanRecord } from "@web/views/kanban/kanban_record";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { registry } from "@web/core/registry";
import { useService } from '@web/core/utils/hooks';

import { ImagesCarouselDialog } from './images_carousel_dialog';
import { SocialPostFormatterMixin } from "./social_post_formatter_mixin";

const { markup, useEffect, useRef } = owl;

export class PostKanbanRecord extends KanbanRecord {
    formatPost (message) {
        return markup(SocialPostFormatterMixin._formatPost(message));
    }
}

export class PostKanbanRenderer extends KanbanRenderer {
    setup() {
        super.setup();

        this.dialog = useService('dialog');
        const rootRef = useRef("root");
        useEffect((images) => {
            const onClickMoreImages = this.onClickMoreImages.bind(this);
            images.forEach((image) => image.addEventListener('click', onClickMoreImages));
            return () => {
                images.forEach((image) => image.removeEventListener('click', onClickMoreImages));
            };
        }, () => [rootRef.el.querySelectorAll('.o_social_stream_post_image_more')]);
    }

    /**
     * FIXME: this is temporary, waiting for the use of formatPost to be removed from the arch.
     *
     * @override
     */
    get renderingContext() {
        return {
            ...super.renderingContext,
            formatPost: (message) => this.formatPost(message),
        };
    }

    /**
     * Shows a bootstrap carousel starting at the clicked image's index
     *
     * @param {PointerEvent} ev - event of the clicked image
     */
    onClickMoreImages(ev) {
        ev.stopPropagation();
        this.dialog.add(ImagesCarouselDialog, {
            title: this.env._t("Post Images"),
            activeIndex: parseInt(ev.currentTarget.dataset.index),
            images: ev.currentTarget.dataset.imageUrls.split(',')
        })
    }
}

PostKanbanRenderer.components = {
    ...KanbanRenderer.components,
    KanbanRecord: PostKanbanRecord,
};


export const PostKanbanView = {
    ...kanbanView,
    Renderer: PostKanbanRenderer,
};

registry.category("views").add("social_post_kanban_view", PostKanbanView);
