/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";

const { Component } = owl;

export class ImagesCarouselDialog extends Component {
    setup() {
        super.setup();
        this.images = this.props.images;
        this.activeIndex = this.props.activeIndex || 0;
    }
}

ImagesCarouselDialog.components = { Dialog };
ImagesCarouselDialog.template = "social.ImagesCarouselDialog";
