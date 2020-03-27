odoo.define('web_enterprise.ListControllerMobile', function (require) {
    "use strict";

    const config = require('web.config');
    const ListController = require('web.ListController');

    if (!config.device.isMobile) {
        return;
    }

    ListController.include({

        /**
         * In mobile, we let the renderer replace its header with the selection
         * banner. @see web_enterprise.ListRendererMobile
         *
         * @override
         */
        _updateSelectionBox() {
            this._super(...arguments);
            const displayBanner = Boolean(this.$selectionBox);
            if (displayBanner) {
                const banner = this.$selectionBox[0];
                this.renderer.el.prepend(banner);
                banner.style.width = `${document.documentElement.offsetWidth}px`;
            }
            this.renderer.el.classList.toggle('o_renderer_selection_banner', displayBanner);
        },
    });
});
