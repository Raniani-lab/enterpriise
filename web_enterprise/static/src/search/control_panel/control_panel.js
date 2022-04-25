/** @odoo-module **/

import { Dropdown } from "@web/core/dropdown/dropdown";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { patch } from "@web/core/utils/patch";

const { onMounted, useExternalListener, useState, useRef } = owl;
const STICKY_CLASS = "o_mobile_sticky";

patch(ControlPanel.prototype, "web_enterprise.ControlPanel", {
    setup() {
        this._super();

        this.mobileControlPanelRef = useRef("mobile_control_panel");

        this.state = useState({
            showSearchBar: false,
            showMobileSearch: false,
            showViewSwitcher: false,
        });

        useExternalListener(window, "click", this.onWindowClick);
        const display = this.display;
        if (!("adaptToScroll" in display) || display.adaptToScroll) {
            useExternalListener(document, "scroll", this.onScrollThrottled);
        }
        onMounted(() => {
            this.oldScrollTop = 0;
            this.initialScrollTop = document.documentElement.scrollTop;
            if (this.env.isSmall) {
                this.mobileControlPanelRef.el.style.top = "0px";
            }
        });
    },

    /**
     * Reset mobile search state
     */
    resetSearchState() {
        Object.assign(this.state, {
            showSearchBar: false,
            showMobileSearch: false,
            showViewSwitcher: false,
        });
    },

    //---------------------------------------------------------------------
    // Handlers
    //---------------------------------------------------------------------

    /**
     * Show or hide the control panel on the top screen.
     * The function is throttled to avoid refreshing the scroll position more
     * often than necessary.
     */
    onScrollThrottled() {
        if (this.isScrolling) {
            return;
        }
        this.isScrolling = true;
        requestAnimationFrame(() => (this.isScrolling = false));

        const scrollTop = document.documentElement.scrollTop;
        const delta = Math.round(scrollTop - this.oldScrollTop);

        if (scrollTop > this.initialScrollTop) {
            // Beneath initial position => sticky display
            const elRect = this.mobileControlPanelRef.el.getBoundingClientRect();
            this.mobileControlPanelRef.el.classList.add(STICKY_CLASS);
            this.mobileControlPanelRef.el.style.top =
                delta < 0
                    ? // Going up
                      `${Math.min(0, elRect.top - delta)}px`
                    : // Going down | not moving
                      `${Math.max(-elRect.height, elRect.top - delta)}px`;
        } else {
            // Above intial position => standard display
            this.mobileControlPanelRef.el.classList.remove(STICKY_CLASS);
        }

        this.oldScrollTop = scrollTop;
    },
    /**
     * Reset mobile search state on switch view.
     */
    onViewClicked() {
        this.resetSearchState();
        this._super(...arguments);
    },
    /**
     * @private
     * @param {MouseEvent} ev
     */
    onWindowClick(ev) {
        if (this.state.showViewSwitcher && !ev.target.closest(".o_cp_switch_buttons")) {
            this.state.showViewSwitcher = false;
        }
    },
});

patch(ControlPanel, "web_enterprise.ControlPanel", {
    template: "web_enterprise.ControlPanel",
    components: { ...ControlPanel.components, Dropdown },
});
