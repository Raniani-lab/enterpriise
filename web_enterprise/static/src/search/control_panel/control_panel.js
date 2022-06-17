/** @odoo-module **/

import { Dropdown } from "@web/core/dropdown/dropdown";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { patch } from "@web/core/utils/patch";

const { onMounted, useExternalListener, useState, useRef, useEffect } = owl;
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

        this.onScrollThrottledBound = this.onScrollThrottled.bind(this);

        useExternalListener(window, "click", this.onWindowClick);
        useEffect(() => {
            if (!this.env.isSmall || ("adaptToScroll" in this.display && !this.display.adaptToScroll) || !this.mobileControlPanelRef.el) {
                return;
            }
            const scrollingEl = this.getScrollingElement();
            scrollingEl.addEventListener("scroll", this.onScrollThrottledBound);
            this.mobileControlPanelRef.el.style.top = "0px";
            return () => {
                scrollingEl.removeEventListener("scroll", this.onScrollThrottledBound);
            }
        })
        onMounted(() => {
            if (!this.mobileControlPanelRef.el) {
                return;
            }
            this.oldScrollTop = 0;
            this.lastScrollTop = 0;
            this.initialScrollTop = this.getScrollingElement().scrollTop;
        });
    },

    getScrollingElement() {
        return this.mobileControlPanelRef.el.parentElement;
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
        if (!this.mobileControlPanelRef.el || this.isScrolling) {
            return;
        }
        this.isScrolling = true;
        requestAnimationFrame(() => (this.isScrolling = false));

        const scrollTop = this.getScrollingElement().scrollTop;
        const delta = Math.round(scrollTop - this.oldScrollTop);

        if (scrollTop > this.initialScrollTop) {
            // Beneath initial position => sticky display
            this.mobileControlPanelRef.el.classList.add(STICKY_CLASS);
            this.lastScrollTop = delta < 0 ?
                // Going up
                Math.min(0, this.lastScrollTop - delta) :
                // Going down | not moving
                Math.max(-this.mobileControlPanelRef.el.offsetHeight, -this.mobileControlPanelRef.el.offsetTop - delta);
            this.mobileControlPanelRef.el.style.top = `${this.lastScrollTop}px`;
        } else {
            // Above initial position => standard display
            this.mobileControlPanelRef.el.classList.remove(STICKY_CLASS);
            this.lastScrollTop = 0;
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
