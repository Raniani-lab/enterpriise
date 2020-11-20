odoo.define('web_mobile.user_menu', function (require) {
"use strict";


const { _t } = require('web.core');
const mobile = require('web_mobile.core');
const UserMenu = require('web.UserMenu');
const webClient = require('web.web_client');

// Hide the logout link in mobile
UserMenu.include({
    /**
     * @override
     */
    async start() {
        await this._super(...arguments);
        if (mobile.methods.switchAccount) {
            this.el.querySelector('a[data-menu="logout"]').classList.add('d-none');
            this.el.querySelector('a[data-menu="account"]').classList.add('d-none');
            this.el.querySelector('a[data-menu="switch"]').classList.remove('d-none');
        }
        if (mobile.methods.addHomeShortcut) {
            this.el.querySelector('a[data-menu="shortcut"]').classList.remove('d-none');
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onMenuSwitch() {
        mobile.methods.switchAccount();
    },
    /**
     * @private
     */
    _onMenuShortcut() {
        const { menu_id } = $.bbq.getState();
        if (menu_id) {
            const menu = webClient.menu.menu_data.children.find(child => child.id === parseInt(menu_id));
            mobile.methods.addHomeShortcut({
                title: document.title,
                shortcut_url: document.URL,
                web_icon: menu && menu.web_icon_data,
            });
        } else {
            mobile.methods.showToast({
                message: _t("No shortcut for Home Menu"),
            });
        }
    },
});

});
