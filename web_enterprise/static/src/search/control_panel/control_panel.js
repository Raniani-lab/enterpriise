/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { patch } from "@web/core/utils/patch";
import { ControlPanel } from "@web/search/control_panel/control_panel";

const { onMounted, useExternalListener, useState, useRef, useEffect } = owl;
const STICKY_CLASS = "o_mobile_sticky";

patch(ControlPanel.prototype, "web_enterprise.ControlPanel", {
    setup() {
        this._super();

        this.root = useRef("root");

        this.state = useState({
            showSearchBar: false,
            showMobileSearch: false,
            showViewSwitcher: false,
        });

        this.onScrollThrottledBound = this.onScrollThrottled.bind(this);

        useExternalListener(window, "click", this.onWindowClick);
        useEffect(() => {
            if (
                !this.env.isSmall ||
                ("adaptToScroll" in this.display && !this.display.adaptToScroll)
            ) {
                return;
            }
            const scrollingEl = this.getScrollingElement();
            scrollingEl.addEventListener("scroll", this.onScrollThrottledBound);
            this.root.el.style.top = "0px";
            return () => {
                scrollingEl.removeEventListener("scroll", this.onScrollThrottledBound);
            };
        });
        onMounted(() => {
            if (
                !this.env.isSmall ||
                ("adaptToScroll" in this.display && !this.display.adaptToScroll)
            ) {
                return;
            }
            this.oldScrollTop = 0;
            this.lastScrollTop = 0;
            this.initialScrollTop = this.getScrollingElement().scrollTop;
        });
    },

    getScrollingElement() {
        return this.root.el.parentElement;
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
        browser.requestAnimationFrame(() => (this.isScrolling = false));

        const scrollTop = this.getScrollingElement().scrollTop;
        const delta = Math.round(scrollTop - this.oldScrollTop);

        if (scrollTop > this.initialScrollTop) {
            // Beneath initial position => sticky display
            this.root.el.classList.add(STICKY_CLASS);
            if (delta < 0) {
                // Going up
                this.lastScrollTop = Math.min(0, this.lastScrollTop - delta);
            } else {
                // Going down | not moving
                this.lastScrollTop = Math.max(
                    -this.root.el.offsetHeight,
                    -this.root.el.offsetTop - delta
                );
            }
            this.root.el.style.top = `${this.lastScrollTop}px`;
        } else {
            // Above initial position => standard display
            this.root.el.classList.remove(STICKY_CLASS);
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
