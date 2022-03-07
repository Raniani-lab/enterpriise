/** @odoo-module **/
import { browser } from "@web/core/browser/browser";
import { localization } from "@web/core/l10n/localization";
import { clamp } from "@web/core/utils/numbers";

const { Component, onMounted, onWillUnmount, useEffect, useRef, useState } = owl;

const isScrollSwipable = (scrollables) => {
    return {
        left: !scrollables.filter((e) => e.scrollLeft !== 0).length,
        right: !scrollables.filter(
            (e) => e.scrollLeft + Math.round(e.getBoundingClientRect().width) !== e.scrollWidth
        ).length,
    };
};

/**
 * Action Swiper
 *
 * This component is intended to perform action once a user has completed a touch swipe.
 * You can choose the direction allowed for such behavior (left, right or both).
 * The action to perform must be passed as a props. It is possible to define a condition
 * to allow the swipe interaction conditionnally.
 * @extends Component
 */
export class ActionSwiper extends Component {
    setup() {
        this.actionTimeoutId = null;
        this.resetTimeoutId = null;
        this.defaultState = {
            containerStyle: "",
            isSwiping: false,
            startX: undefined,
            width: undefined,
        };
        this.root = useRef("root");
        this.targetContainer = useRef("targetContainer");
        this.scrollables = undefined;
        this.state = useState({ ...this.defaultState });
        this.swipedDistance = 0;
        onMounted(() => {
            if (this.targetContainer.el) {
                this.state.width = this.targetContainer.el.getBoundingClientRect().width;
            }
        });
        onWillUnmount(() => {
            browser.clearTimeout(this.actionTimeoutId);
            browser.clearTimeout(this.resetTimeoutId);
        });
        // Forward classes set on component to slot, as we only want to wrap an
        // existing component without altering the DOM structure any more than
        // strictly necessary
        useEffect(() => {
            if (this.props.onLeftSwipe || this.props.onRightSwipe) {
                const classes = new Set(this.root.el.classList);
                classes.delete("o_actionswiper");
                for (const className of classes) {
                    this.targetContainer.el.firstChild.classList.add(className);
                    this.root.el.classList.remove(className);
                }
            }
        });
    }
    get localizedProps() {
        return {
            onLeftSwipe:
                localization.direction === "rtl" ? this.props.onRightSwipe : this.props.onLeftSwipe,
            onRightSwipe:
                localization.direction === "rtl" ? this.props.onLeftSwipe : this.props.onRightSwipe,
        };
    }

    /**
     * @private
     * @param {TouchEvent} ev
     */
    _onTouchEndSwipe() {
        if (this.state.isSwiping) {
            this.state.isSwiping = false;
            if (this.localizedProps.onRightSwipe && this.swipedDistance > this.state.width / 2) {
                this.swipedDistance = this.state.width;
                this.state.containerStyle = `transform: translateX(${this.swipedDistance}px)`;
                this.actionTimeoutId = browser.setTimeout(
                    this.localizedProps.onRightSwipe.action,
                    500
                );
            } else if (
                this.localizedProps.onLeftSwipe &&
                this.swipedDistance < -this.state.width / 2
            ) {
                this.swipedDistance = -this.state.width;
                this.state.containerStyle = `transform: translateX(${this.swipedDistance}px)`;
                this.actionTimeoutId = browser.setTimeout(
                    this.localizedProps.onLeftSwipe.action,
                    500
                );
            } else {
                this.state.containerStyle = "";
            }
            this.resetTimeoutId = browser.setTimeout(() => {
                this._reset();
            }, 500);
        }
    }
    /**
     * @private
     * @param {TouchEvent} ev
     */
    _onTouchMoveSwipe(ev) {
        if (this.state.isSwiping) {
            const { onLeftSwipe, onRightSwipe } = this.localizedProps;
            this.swipedDistance = clamp(
                ev.touches[0].clientX - this.state.startX,
                onLeftSwipe ? -this.state.width : 0,
                onRightSwipe ? this.state.width : 0
            );
            // If there are scrollable elements under touch pressure,
            // they must be at their limits to allow swiping.
            if (
                !this.scrollables ||
                isScrollSwipable(this.scrollables)[this.swipedDistance > 0 ? "left" : "right"]
            ) {
                this.state.containerStyle = `transform: translateX(${this.swipedDistance}px)`;
            } else {
                this._reset();
            }
        }
    }
    /**
     * @private
     * @param {TouchEvent} ev
     */
    _onTouchStartSwipe(ev) {
        this.scrollables = ev
            .composedPath()
            .filter(
                (e) =>
                    e.nodeType === 1 &&
                    this.targetContainer.el.contains(e) &&
                    e.scrollWidth > e.getBoundingClientRect().width
            );
        if (!this.state.width) {
            this.state.width =
                this.targetContainer && this.targetContainer.el.getBoundingClientRect().width;
        }
        this.state.isSwiping = true;
        this.state.startX = ev.touches[0].clientX;
    }

    /**
     * @private
     */
    _reset() {
        Object.assign(this.state, { ...this.defaultState });
        this.scrollables = undefined;
        this.swipedDistance = 0;
    }
}

ActionSwiper.defaultProps = {
    onLeftSwipe: undefined,
    onRightSwipe: undefined,
};
ActionSwiper.props = {
    onLeftSwipe: {
        type: Object,
        args: {
            action: Function,
            icon: String,
            bgColor: String,
        },
        optional: true,
    },
    onRightSwipe: {
        type: Object,
        args: {
            action: Function,
            icon: String,
            bgColor: String,
        },
        optional: true,
    },
    slots: Object,
};
ActionSwiper.template = "web_enterprise.ActionSwiper";
