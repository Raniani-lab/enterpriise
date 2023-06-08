/** @odoo-module */

import { SORTABLE_TOLERANCE } from "@knowledge/components/sidebar/sidebar";

export const changeInternalPermission = (permission) => {
    const target = document.querySelector('.o_permission[aria-label="Internal Permission"]');
    target.value = permission;
    target.dispatchEvent(new Event("change"));
};

/**
 * Drag&drop an article in the sidebar
 * @param {$.Element} element
 * @param {$.Element} target
 */
export const dragAndDropArticle = ($element, $target) => {
    const elementCenter = $element.offset();
    elementCenter.left += $element.outerWidth() / 2;
    elementCenter.top += $element.outerHeight() / 2;
    const targetCenter = $target.offset();
    targetCenter.left += $target.outerWidth() / 2;
    targetCenter.top += $target.outerHeight() / 2;
    const sign = Math.sign(targetCenter.top - elementCenter.top);
    // The mouse needs to be above (or below) the target depending on element
    // position (below (or above)) to consistently trigger the correct move.
    const offsetY = sign * ($target.outerHeight() / 2 - 5);

    const element = $element[0].closest('li');
    const target = $target[0];
    element.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        which: 1,
        clientX: elementCenter.left,
        clientY: elementCenter.top,
    }));

    // Initial movement starting the drag sequence
    element.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        which: 1,
        clientX: elementCenter.left,
        clientY: elementCenter.top + SORTABLE_TOLERANCE + 1,
    }));

    // Timeouts because sidebar onMove is debounced
    setTimeout(() => {
        target.dispatchEvent(new MouseEvent("mousemove", {
            bubbles: true,
            which: 1,
            clientX: targetCenter.left,
            clientY: targetCenter.top + offsetY,
        }));
    
        setTimeout(() => {
            element.dispatchEvent(new MouseEvent("mouseup", {
                bubbles: true,
                which: 1,
                clientX: targetCenter.left,
                clientY: targetCenter.top + offsetY,
            }));
        }, 200);
    }, 200);
};

export function makeVisible(selector) {
    const el = document.querySelector(selector);
    if (el) {
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('display', 'block', 'important');
    }
}

/**
 * Opens the power box of the editor
 * @param {HTMLElement} paragraph
 */
export function openCommandBar(paragraph) {
    const sel = document.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.setEnd(paragraph, 0);
    sel.addRange(range);
    paragraph.dispatchEvent(new KeyboardEvent('keydown', {
        key: '/',
    }));
    const slash = document.createTextNode('/');
    paragraph.replaceChildren(slash);
    sel.removeAllRanges();
    range.setStart(paragraph, 1);
    range.setEnd(paragraph, 1);
    sel.addRange(range);
    paragraph.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: '/',
        bubbles: true,
    }));
    paragraph.dispatchEvent(new KeyboardEvent('keyup', {
        key: '/',
    }));
}
