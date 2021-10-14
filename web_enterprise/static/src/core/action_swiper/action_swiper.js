/** @odoo-module **/
import { browser } from "@web/core/browser/browser";
import { clamp } from '@web/core/utils/numbers';
import { useEffect } from "@web/core/utils/hooks";

const { Component, hooks } = owl;
const { onMounted, onWillUnmount, useRef, useState } = hooks;

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
            dimensions: {
                width: undefined,
                height: undefined,
            },
            isSwiping: false,
            startX: undefined,
            swipedDistance: 0,
        }
        this.targetContainer = useRef("targetContainer");
        this.state = useState({...this.defaultState});
        onMounted(() => {
            if (this.targetContainer.el) {
                Object.assign(this.state.dimensions, 
                    {
                        width: this.targetContainer.el.clientWidth,
                        height: this.targetContainer.el.clientHeight,
                    }
                );
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
                const classes = new Set(this.el.classList);
                classes.delete('o_actionswiper');
                for(const className of classes) {
                    this.targetContainer.el.firstChild.classList.add(className);
                    this.el.classList.remove(className);
                }
            }
        });
    }
    /**
     * @private
     * @param {TouchEvent} ev
     */
    _onTouchEndSwipe() {
        if (this.state.isSwiping) {
            this.state.isSwiping = false;
            if (this.props.onRightSwipe && this.state.swipedDistance > this.state.dimensions.width/2) {
                this.state.containerStyle = `transform: translateX(${this.state.dimensions.width}px)`;
                this.actionTimeoutId = browser.setTimeout(this.props.onRightSwipe.action, 500);
            } else if (this.props.onLeftSwipe && this.state.swipedDistance < -this.state.dimensions.width/2) {
                this.state.containerStyle = `transform: translateX(-${this.state.dimensions.width}px)`;
                this.actionTimeoutId = browser.setTimeout(this.props.onLeftSwipe.action, 500);
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
            const { onLeftSwipe, onRightSwipe } = this.props;
            this.state.swipedDistance = clamp(
                ev.touches[0].clientX - this.state.startX,
                onLeftSwipe ? -this.state.dimensions.width : 0,
                onRightSwipe ? this.state.dimensions.width : 0
            );
            this.state.containerStyle = `transform: translateX(${this.state.swipedDistance}px)`;
        }
    }
    /**
     * @private
     * @param {TouchEvent} ev
     */
    _onTouchStartSwipe(ev) {
        if (!this.state.dimensions.width || !this.state.dimensions.height) {
            Object.assign(this.state.dimensions, 
                {
                    width: this.targetContainer && this.targetContainer.el.clientWidth,
                    height: this.targetContainer && this.targetContainer.el.clientHeight,
                }
            );
        }
        this.state.isSwiping = true;
        this.state.startX = ev.touches[0].clientX;
    }

    /**
     * @private
     */
    _reset() {
        Object.assign(this.state, {...this.defaultState});
    }
}

ActionSwiper.defaultProps = {
    onLeftSwipe: undefined,
    onRightSwipe: undefined,
}
ActionSwiper.props = {
    onLeftSwipe: {
        type: Object,
        args : {
            action: Function,
            icon: String,
            bgColor: String,
        },
        optional: true,
    },
    onRightSwipe: {
        type: Object,
        args : {
            action: Function,
            icon: String,
            bgColor: String,
        },
        optional: true,
    },
};
ActionSwiper.template = "web_enterprise.ActionSwiper";
