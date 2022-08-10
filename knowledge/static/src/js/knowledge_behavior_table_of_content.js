/** @odoo-module */

import core from 'web.core';
import { ContentsContainerBehavior } from './knowledge_behaviors.js';
import { HEADINGS, fetchValidHeadings } from './tools/knowledge_tools.js';

const qweb = core.qweb;

/**
 * A behavior for the /toc command @see Wysiwyg . This behavior uses a
 * mutationObserver to listen to changes on <h1> -> <h6> nodes, and updates
 * an associated table of contents.
 * It is an extension of @see ContentsContainerBehavior
 */
const TableOfContentsBehavior = ContentsContainerBehavior.extend({
    //--------------------------------------------------------------------------
    // 'ContentsContainerBehavior' overrides
    //--------------------------------------------------------------------------

    /**
     * Initialize the editor content observer.
     * It listens to changes on H1 through H6 tags and updates a Table of Content accordingly.
     *
     * @override
     */
    init: function () {
        this.observer = new MutationObserver((mutationList) => {
            const update = mutationList.find(mutation => {
                if (Array.from(mutation.addedNodes).find((node) => HEADINGS.includes(node.tagName)) ||
                    Array.from(mutation.removedNodes).find((node) => HEADINGS.includes(node.tagName))) {
                    // We just added/removed a header node -> update the ToC
                    return true;
                }

                // Powerbox is open -> do not attempt to update the ToC
                if (this.handler.editor.powerbox.isOpen) {
                    if (this.updateTimeout) {
                        clearTimeout(this.updateTimeout);
                    }
                    return false;
                }

                // check if we modified the content of a header element
                const target = mutation.target;
                const headerNode = this._findClosestHeader(target);

                return headerNode && headerNode.parentElement === this.handler.field;
            });

            if (update) {
                this.delayedUpdateTableOfContents();
            }
        });

        this._super.apply(this, arguments);
    },

    /**
     * Re-apply contenteditable="false" that is turned on automatically by the base editor code.
     * This avoids having our custom links opening the editor toolbar on click.
     *
     * @override
     */
    applyAttributes: function () {
        this._super.apply(this, arguments);
        if (this.mode === 'edit') {
            this.anchor.querySelectorAll('.o_knowledge_toc_link').forEach(element => {
                element.setAttribute('contenteditable', 'false');
            });
        }
    },

    /**
     * Adds the ToC click listener to scroll towards to associated heading tag.
     * Also adds the listener that will update the ToC as the user is typing.
     *
     * @override
     */
    applyListeners: function () {
        this._super.apply(this, arguments);
        $(this.anchor).on('click', '.o_knowledge_toc_link', this._onTocLinkClick.bind(this));
        if (this.mode === 'edit') {
            this.observer.observe(this.handler.field, {
                childList: true,
                attributes: false,
                subtree: true,
                characterData: true,
            });

            this._updateTableOfContents();
        }
    },

    /**
     * @override
     */
    disableListeners: function () {
        $(this.anchor).off('click', '.o_knowledge_toc_link');
        if (this.mode === 'edit') {
            this.observer.disconnect();
        }
    },

    //--------------------------------------------------------------------------
    // Table of content - BUSINESS LOGIC
    //--------------------------------------------------------------------------

    /**
     * Allows to debounce the update of the Table of Content to avoid updating whenever every single
     * character is typed. The debounce is set to 500ms.
     */
    delayedUpdateTableOfContents() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = setTimeout(this._updateTableOfContents.bind(this), 500);
    },

    /**
     * Helper methods that fetches the closest Header Element based on a target Node.
     *
     * @param {Node} node
     * @returns {Element} the closest header or undefined if not found
     */
    _findClosestHeader(node) {
        if (node && node.nodeType === Node.TEXT_NODE) {
            // we are modifying the text of a Node, check its parent
            node = node.parentElement;
        }

        if (node && node.nodeType === Node.ELEMENT_NODE) {
            if (!HEADINGS.includes(node.tagName)) {
                // this node is not a direct header node, but it could be *inside* a header node
                // -> check closest header node
                node = node.closest(HEADINGS.join(','));
            }

            if (node && HEADINGS.includes(node.tagName)) {
                return node;
            }
        }

        return undefined;
    },

    /**
     * Updates the Table of Content to match the document headings.
     * We pause our observer during the process.
     *
     * We have a 'depth' system for headers, the depth of a header is simply how much left-padding
     * it is showing to give an impression of hierarchy, e.g:
     * - Header 1
     *   - Sub-Header 1
     *     - Sub-sub-header 1
     *   - Sub-Header 2
     * - Header 2
     *   - Sub-Header 3
     *
     * The logic is as follows:
     * - If it is the same tag as 'the previous one' in the loop
     *   -> keep the same depth
     * - If the header tag is "bigger" than the previous one (a H5 compared to H4)
     *   -> Increase the depth by one
     *      /!\ We only increase by one, even if we are comparing a H5 to a H3
     *          This avoids some strange spacing and lets the user choose its headers style
     * - If the header tag is "smaller" than the previous one
     *   -> When going down, check if our current "tree" (our hierarchy starting with the highest
     *      tag) already has this type of tag at a certain depth, and use that.
     *      Otherwise use the depth of the tag (0 for h1, 1 for h2, 2 for h3, ...).
     *
     * Some examples of non-trivial header hierarchy can be found in the QUnit tests of this method.
     */
    _updateTableOfContents: function () {
        this.handler.editor.observerUnactive('knowledge_toc_update');

        const allHeadings = fetchValidHeadings(this.handler.field);

        let currentDepthByTag = {};
        let previousTag = undefined;
        let previousDepth = -1;
        let index = 0;
        const headingStructure = allHeadings.map((heading) => {
            let depth = HEADINGS.indexOf(heading.tagName);
            if (depth !== previousDepth && heading.tagName === previousTag) {
                depth = previousDepth;
            } else if (depth > previousDepth) {
                if (heading.tagName !== previousTag && HEADINGS.indexOf(previousTag) < depth) {
                    depth = previousDepth + 1;
                } else {
                    depth = previousDepth;
                }
            } else if (depth < previousDepth) {
                if (currentDepthByTag.hasOwnProperty(heading.tagName)) {
                    depth = currentDepthByTag[heading.tagName];
                }
            }

            previousTag = heading.tagName;
            previousDepth = depth;

            // going back to 0 depth, wipe-out the 'currentDepthByTag'
            if (depth === 0) {
                currentDepthByTag = {};
            }
            currentDepthByTag[heading.tagName] = depth;

            return {
                depth: depth,
                index: index++,
                name: heading.innerText,
                tagName: heading.tagName,
            };
        });

        const updatedToc = qweb.render('knowledge.knowledge_table_of_content', {
            'headings': headingStructure
        });
        const knowledgeToCElement = this.anchor.getElementsByClassName('o_knowledge_toc_content');
        if (knowledgeToCElement.length !== 0) {
            knowledgeToCElement[0].innerHTML = updatedToc;
        }

        this.handler.editor.observerActive('knowledge_toc_update');
    },

    //--------------------------------------------------------------------------
    // Table of content - HANDLERS
    //--------------------------------------------------------------------------

    /**
     * Scroll through the view to display the matching heading.
     * Adds a small highlight in/out animation using a class.
     *
     * @param {Event} event
     */
    _onTocLinkClick: function (event) {
        event.preventDefault();
        const headingIndex = parseInt(event.target.getAttribute('data-oe-nodeid'));
        const targetHeading = fetchValidHeadings(this.handler.field)[headingIndex];
        if (targetHeading){
            targetHeading.scrollIntoView({
                behavior: 'smooth',
            });
            targetHeading.classList.add('o_knowledge_header_highlight');
            setTimeout(() => {
                targetHeading.classList.remove('o_knowledge_header_highlight');
            }, 2000);
        } else {
            this._updateTableOfContents();
        }
    },
});

export { TableOfContentsBehavior };
