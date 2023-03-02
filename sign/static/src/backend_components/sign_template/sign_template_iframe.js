/** @odoo-module **/

import { renderToString } from "@web/core/utils/render";
import { shallowEqual } from "@web/core/utils/arrays";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { startHelperLines, offset, normalizePosition, generateRandomId, startSmoothScroll, startResize, pinchService, isVisible } from "./drag_and_drop_utils";
import { SignItemCustomPopover } from "@sign/backend_components/sign_template/sign_item_custom_popover";
import { InitialsAllPagesDialog } from "@sign/dialogs/initials_all_pages_dialog";

export class SignTemplateIframe {
    /**
     * Renders custom elements inside the PDF.js iframe
     * @param {HTMLIFrameElement} iframe 
     * @param {Document} root 
     * @param {Object} env 
     * @param {Object} owlServices 
     * @param {Object} props 
     */
    constructor(iframe, root, env, owlServices, props) {
        this.iframe = iframe;
        this.root = root;
        this.env = env;
        Object.assign(this, owlServices);
        this.props = props;
        this.deletedSignItemIds = [];
        this.currentRole = this.props.signRoles[0].id;
        this.closePopoverFns = {};
        this.signItemTypesById = this.props.signItemTypes.reduce((obj, type) => {
            obj[type.id] = type;
            return obj;
        }, {});
        this.signRolesById = this.props.signRoles.reduce((obj, role) => {
            obj[role.id] = role;
            return obj;
        }, {});
        this.selectionOptionsById = this.props.signItemOptions.reduce((obj, option) => {
            obj[option.id] = option;
            return obj;
        }, {});
        this.cleanupFns = [];

        this.waitForPagesToLoad();
    }

    waitForPagesToLoad() {
        const errorElement = this.root.querySelector("#errorMessage");
        if (isVisible(errorElement)) {
            return this.dialog.add(AlertDialog, {
                body: this.env._t("Need a valid PDF to add signature fields!"),
            });
        }
        this.pageCount = this.root.querySelectorAll(".page").length;
        if (this.pageCount > 0) {
            this.start();
        } else {
            setTimeout(() => this.waitForPagesToLoad(), 50);
        }
    }

    start() {
        this.signItems = this.getSignItems();
        this.loadCustomCSS().then(() => {
            this.pageCount = this.root.querySelectorAll(".page").length;
            this.clearNativePDFViewerButtons();
            this.startPinchService();
            this.preRender();
            this.renderSidebar();
            this.renderSignItems();
            this.postRender();
        });
    }

    unmount() {
        this.cleanupFns.forEach(fn => typeof fn === "function" && fn());
    }

    async loadCustomCSS() {
        const assets = await this.rpc(
            "/sign/render_assets_pdf_iframe",
            { args: [{ debug: this.env.debug }] }
        );
        this.root.querySelector('head').insertAdjacentHTML("beforeend", assets);
    }

    clearNativePDFViewerButtons() {
        const selectors = [
            '#pageRotateCw', '#pageRotateCcw',
            '#openFile', '#presentationMode',
            '#viewBookmark', '#print',
            '#download', '#secondaryOpenFile',
            '#secondaryPresentationMode', '#secondaryViewBookmark',
            '#secondaryPrint', '#secondaryDownload'
        ];
        const elements = this.root.querySelectorAll(selectors.join(", "));
        elements.forEach(element => {
            element.style.display = 'none';
        });
        this.root.querySelector('#lastPage').nextElementSibling.style.display = 'none';
        // prevent password from being autocompleted in search input
        this.root.querySelector('#findInput').setAttribute('autocomplete', "new-password")

    }

    renderSidebar() {
        if (!this.props.hasSignRequests) {
            const sideBar = renderToString("sign.signItemTypesSidebar", { signItemTypes: this.props.signItemTypes});
            this.root.body.insertAdjacentHTML("afterbegin", sideBar);
        }
    }

    renderSignItems() {
        for (let page in this.signItems) {
            const pageContainer = this.getPageContainer(page);
            for (let id in this.signItems[page]) {
                const signItem = this.signItems[page][id];
                signItem.el = this.renderSignItem(signItem.data, pageContainer);
            }
        }
        this.updateFontSize();
        if (!this.props.hasSignRequests) {
            this.startDragAndDrop();
            this.helperLines = startHelperLines(this.root);
        }
    }

    startDragAndDrop() {
        this.root.querySelectorAll('.page').forEach(page => {
            page.addEventListener("dragover", (e) => this.onDragOver(e));
            page.addEventListener("drop", (e) => this.onDrop(e));
        });

        this.root.querySelectorAll('.o_sign_sign_item').forEach(signItemEl => {
            const page = signItemEl.parentElement.dataset.pageNumber;
            const id = signItemEl.dataset.id;
            const signItem = this.signItems[page][id];
            this.enableCustom(signItem);
        });

        this.root.querySelectorAll('.o_sign_field_type_button').forEach(sidebarItem => {
            sidebarItem.setAttribute("draggable", true);
            sidebarItem.addEventListener("dragstart", (e) => this.onSidebarDragStart(e));
            sidebarItem.addEventListener("dragend", (e) => this.onSidebarDragEnd(e));
        });
    }

    startPinchService() {
        const pinchTarget = this.root.querySelector("#viewerContainer #viewer");
        const pinchServiceCleanup = pinchService(pinchTarget, {
            decreaseDistanceHandler: () => this.root.querySelector("button#zoomIn").click(),
            increaseDistanceHandler: () => this.root.querySelector("button#zoomOut").click(),
        });
        this.cleanupFns.push(pinchServiceCleanup);
    }

    /**
     * Callback executed when a sign item is resized
     * @param {SignItem} signItem 
     * @param {Object} change object with new width and height of sign item
     * @param {Boolean} end boolean indicating if the resize is done or still in progress
     */
    onResizeItem(signItem, change, end=false) {
        this.helperLines.show(signItem.el);
        Object.assign(signItem.el.style, {
            height: `${change.height * 100}%`,
            width: `${change.width * 100}%`,
        });
        Object.assign(signItem.data, {
            width: change.width,
            height: change.height,
            updated: true,
        });
        this.updateSignItemFontSize(signItem);
        if (end) {
            this.helperLines.hide();
            this.saveChanges();
        }
    }

    registerDragEventsForSignItem(signItem) {
        const display = signItem.el.querySelector('.o_sign_item_display');
        const handle = signItem.el.querySelector('.o_sign_config_handle');
        handle.setAttribute("draggable", true);
        handle.addEventListener("dragstart", (e) => this.onDragStart(e));
        handle.addEventListener("dragend", (e) => this.onDragEnd(e));
        display.addEventListener("click", () => this.openSignItemPopup(signItem));
    }

    /**
     * Handles opening and closing of popovers in template edition
     * @param {SignItem} signItem 
     */
    openSignItemPopup(signItem) {
        const shouldOpenNewPopover = !(signItem.data.id in this.closePopoverFns);
        this.closePopover();
        if (shouldOpenNewPopover) {
            const closeFn = this.popover.add(signItem.el, SignItemCustomPopover, {
                debug: this.env.debug,
                responsible: signItem.data.responsible,
                roles: this.signRolesById,
                alignment: signItem.data.alignment,
                required: signItem.data.required,
                placeholder: signItem.data.placeholder,
                id: signItem.data.id,
                type: signItem.data.type,
                option_ids: signItem.data.option_ids,
                onValidate: (data) => {
                    this.updateSignItem(signItem, data);
                    this.closePopover();
                },
                onDelete: () => {
                    this.closePopover();
                    this.deleteSignItem(signItem);
                },
                onClose: () => {
                    this.closePopover();
                },
                updateSelectionOptions: (ids) => this.updateSelectionOptions(ids),
                updateRoles: (id) => this.updateRoles(id),
            }, {
                position: "right",
                onClose: () => {
                    this.closePopoverFns = {};
                }
            });
            this.closePopoverFns[signItem.data.id] = {
                close: closeFn,
                signItem,
            };
        }
    }

    /**
     * Closes all open popovers
     */
    closePopover() {
        if (Object.keys(this.closePopoverFns)) {
            for(let id in this.closePopoverFns) {
                this.closePopoverFns[id].close();
            }
            this.closePopoverFns = {};
        }
    }

    /**
     * Updates the sign item, re-renders it and saves the template in case there were changes
     * @param {SignItem} signItem 
     * @param {Object} data 
     */
    updateSignItem(signItem, data) {
        const changes = Object.keys(data).reduce((changes, key) => {
            if (key in signItem.data) {
                if (Array.isArray(data[key])) {
                    if (!shallowEqual(signItem.data[key], data[key])) {
                        changes[key] = data[key];
                    }
                } else if (signItem.data[key] !== data[key]) {
                    changes[key] = data[key];
                }
            }
            return changes;
        }, {});
        if (Object.keys(changes).length) {
            const pageNumber = signItem.data.page;
            const page = this.getPageContainer(pageNumber);
            signItem.el.parentElement.removeChild(signItem.el);
            const newData = {
                ...signItem.data,
                ...changes,
                updated: true,
            };
            this.signItems[pageNumber][newData.id] = {
                data: newData,
                el: this.renderSignItem(newData, page)
            };
            this.enableCustom(this.signItems[pageNumber][newData.id]);
            this.refreshSignItems();
            this.currentRole = newData.responsible;
            this.saveChanges();
        }
    }

    /**
     * Deletes a sign item from the template
     * @param {SignItem} signItem 
     */
    deleteSignItem(signItem) {
        const {id, page} = signItem.data;
        this.deletedSignItemIds.push(id);
        signItem.el.parentElement.removeChild(signItem.el);
        delete this.signItems[page][id];
        this.saveChanges();
    }

    onDragStart(e) {
        const signItem = e.target.parentElement.parentElement;
        const page = signItem.parentElement;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('page', page.dataset.pageNumber);
        e.dataTransfer.setData('id', signItem.dataset.id);
        e.dataTransfer.setDragImage(signItem, 0, 0);
        // workaround to hide element while keeping the drag image visible
        requestAnimationFrame(() => {
            if (signItem) {
                signItem.style.visibility = "hidden";
            }
        }, 0);
        this.scrollCleanup = startSmoothScroll(this.root.querySelector("#viewerContainer"), signItem, null, this.helperLines);
    }

    onDragEnd(e) {
        this.scrollCleanup();
    }

    onSidebarDragStart(e) {
        const signTypeElement = e.target;
        const firstPage = this.root.querySelector('.page[data-page-number="1"]');
        firstPage.insertAdjacentHTML("beforeend", renderToString("sign.signItem", this.createSignItemDataFromType(signTypeElement.dataset.itemTypeId)));
        this.ghostSignItem = firstPage.lastChild;
        e.dataTransfer.setData('typeId', signTypeElement.dataset.itemTypeId);
        e.dataTransfer.setDragImage(this.ghostSignItem, 0, 0);
        this.scrollCleanup = startSmoothScroll(this.root.querySelector("#viewerContainer"), e.target, this.ghostSignItem, this.helperLines);
        // workaround to set original element to hidden while keeping the cloned element visible
        requestAnimationFrame(() => {
            if (this.ghostSignItem) {
                this.ghostSignItem.style.visibility = "hidden";
            }
        }, 0);
    }

    onSidebarDragEnd() {
        this.scrollCleanup();
        const firstPage = this.root.querySelector('.page[data-page-number="1"]');
        firstPage.removeChild(this.ghostSignItem);
        this.ghostSignItem = false;
    }

    onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }

    onDrop(e) {
        e.preventDefault();
        const page = e.currentTarget;
        const textLayer = page.querySelector('.textLayer');
        const targetPage = Number(page.dataset.pageNumber);

        const { top, left } = offset(textLayer);
        const typeId = e.dataTransfer.getData('typeId');
        if(typeId) {
            const id = generateRandomId();
            const data = this.createSignItemDataFromType(typeId);
            const posX = Math.round(normalizePosition((e.pageX - left) / textLayer.clientWidth, data.width) * 1000) / 1000;
            const posY = Math.round(normalizePosition((e.pageY - top) / textLayer.clientHeight, data.height) * 1000) / 1000;
            Object.assign(data, { id, posX, posY, page: targetPage });
            if (data.type === 'initial') {
                this.helperLines.hide();
                return this.openDialogAfterInitialDrop(data);
            }
            this.signItems[targetPage][id] = {
                data,
                el: this.renderSignItem(data, page),
            };
            this.enableCustom(this.signItems[targetPage][id]);
            this.refreshSignItems();
        } else if (e.dataTransfer.getData('page') && e.dataTransfer.getData('id')){
            const initialPage = Number(e.dataTransfer.getData('page'));
            const id = Number(e.dataTransfer.getData('id'));
            const signItem = this.signItems[initialPage][id];
            const signItemEl = signItem.el;
            const posX = Math.round(normalizePosition((e.pageX - left) / textLayer.clientWidth, signItem.data.width) * 1000) / 1000;
            const posY = Math.round(normalizePosition((e.pageY - top) / textLayer.clientHeight, signItem.data.height) * 1000) / 1000;

            if (initialPage !== targetPage) {
                signItem.data.page = targetPage;
                this.signItems[targetPage][id] = signItem;
                delete this.signItems[initialPage][id];
                page.appendChild(signItemEl.parentElement.removeChild(signItemEl));
            }

            Object.assign(signItem.data, {
                posX,
                posY,
                updated: true,
            });
            Object.assign(signItemEl.style, {
                top: `${posY * 100}%`,
                left: `${posX * 100}%`,
                visibility: 'visible'
            });
        } else {
            return;
        }

        this.saveChanges();
    }

    /**
     * Enables resizing and drag/drop for sign items
     * @param {SignItem} signItem 
     */
    enableCustom(signItem) {
        startResize(signItem, this.onResizeItem.bind(this));
        this.registerDragEventsForSignItem(signItem);
    }

    /**
     * Renders a sign item using its data and attaches it to a target html element
     * @param { Object } signItemData
     * @property 
     */
    renderSignItem(signItemData, target) {
        const signItemElement = renderToString("sign.signItem", this.getContext(signItemData));
        target.insertAdjacentHTML("beforeend", signItemElement);
        return target.lastChild;
    }

    /**
     * Extends the rendering context of the sign item based on its data
     * @param {SignItem.data} signItem 
     * @returns {Object}
     */
    getContext(signItem) {
        const normalizedPosX = Math.round(normalizePosition(signItem.posX, signItem.width) * 1000) / 1000;
        const normalizedPosY = Math.round(normalizePosition(signItem.posY, signItem.height) * 1000) / 1000;
        const responsible = signItem.responsible ?? (signItem.responsible_id?.[0] || 0);
        const type = this.signItemTypesById[signItem.type_id[0]].item_type;
        if (type === 'selection') {
            const options = signItem.option_ids.map(id => this.selectionOptionsById[id]);
            signItem.options = options;
        }
        return Object.assign(signItem, {
            readonly: true,
            editMode: true,
            required: Boolean(signItem.required),
            responsible,
            type,
            placeholder: signItem.placeholder || signItem.name || "",
            responsibleName: this.signRolesById[responsible].name,
            classes: `o_color_responsible_${this.signRolesById[responsible].color} o_readonly_mode`,
            style: `top: ${normalizedPosY * 100}%; left: ${normalizedPosX * 100}%;
                    width: ${signItem.width * 100}%; height: ${signItem.height * 100}%;
                    text-align: ${signItem.alignment}`,
        });
    }

    /**
     * PDF.js removes custom elements every once in a while.
     * So we need to constantly re-render them :(
     * We keep the elements stored in memory, so we don't need to call the qweb engine everytime a element is detached
     */
    refreshSignItems() {
        for (let page in this.signItems) {
            const pageContainer = this.getPageContainer(page);
            for (let id in this.signItems[page]) {
                const signItem = this.signItems[page][id].el;
                if (!signItem.parentElement || !signItem.parentElement.classList.contains("page")) {
                    pageContainer.append(signItem);
                }
            }
        }
        this.updateFontSize();
    }

    /**
     * Hook executed before rendering the sign items and the sidebar
     */
    preRender() {
        const viewerContainer = this.root.querySelector("#viewerContainer");
        viewerContainer.style.visibility = "visible";
        if (!this.props.hasSignRequests) {
            const outerContainer = this.root.querySelector("#outerContainer");
            Object.assign(outerContainer.style, {
                width: "auto",
                marginLeft: "14rem",
            });
            outerContainer.classList.add("o_sign_field_type_toolbar_visible");
            this.root.dispatchEvent(new Event("resize"));
        } else {
            const div = this.root.createElement("div");
            Object.assign(div.style, {
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 110,
                opacity: 0.75
            });
            this.root.querySelector("#viewer").prepend(div);
        }
        this.insertRotatePDFButton();
        this.setInitialZoom();
    }

    get normalSize() {
        return this.root.querySelector('.page').clientHeight * 0.015;
    }

    /**
     * Updates the font size of all sign items in case there was a zoom/resize of element
     */
    updateFontSize() {
        for (let page in this.signItems) {
            for (let id in this.signItems[page]) {
                const signItem = this.signItems[page][id];
                this.updateSignItemFontSize(signItem);
            }
        }
    }

    /**
     * Updates the font size of a determined sign item
     * @param {SignItem}
     */
    updateSignItemFontSize({el, data}) {
        const largerTypes = ["signature", "initial", "textarea", "selection"];
        const size = largerTypes.includes(data.type) ? this.normalSize : parseFloat(el.clientHeight);
        el.style.fontSize = `${size * 0.8}px`;
    }

    insertRotatePDFButton() {
        const printButton = this.root.querySelector("#print");
        const button = this.root.createElement("button");
        button.className = "toolbarButton o_sign_rotate rotateCw";
        button.title = this.env._t("Rotate Clockwise");
        printButton.parentNode.insertBefore(button, printButton);
        button.addEventListener("click", (e) => this.rotatePDF(e));
    }

    async rotatePDF(e) {
        const button = e.target;
        button.setAttribute('disabled', '');
        const result = await this.props.rotatePDF();
        if (result) {
            this.root.querySelector("#pageRotateCw").click();
            button.removeAttribute('disabled');
            this.refreshSignItems();
        }
    }

    setInitialZoom() {
        let button = this.root.querySelector("button#zoomIn");
        if (!this.env.isSmall) {
            button = this.root.querySelector("button#zoomOut");
            button.click();
        }
        button.click();
    }

    postRender() {
        const refreshSignItemsIntervalId = setInterval(() => this.refreshSignItems(), 2000);
        this.cleanupFns.push(() => clearInterval(refreshSignItemsIntervalId));
        if (!this.props.hasSignRequests) {
            const viewerContainer = this.root.querySelector("#viewerContainer");
            // close popover when clicking outside of a sign item
            viewerContainer.addEventListener("click", (e) => {
                if(!e.target.closest('.o_sign_item_display')) {
                    this.closePopover();
                }
            }, { capture: true });
            this.root.addEventListener("keyup", (e) => this.handleKeyUp(e));
        }
    }

    handleKeyUp(e) {
        if (e.keyCode === 46 && Object.keys(this.closePopoverFns)) {
            //delete any element that has its popover open
            for(let id in this.closePopoverFns) {
                const {close, signItem} = this.closePopoverFns[id];
                typeof close === "function" && close();
                this.deleteSignItem(signItem);
            }
            this.closePopoverFns = {};
        }
    }

    async saveChanges() {
        const Id2UpdatedItem = await this.props.saveTemplate();
        Object.entries(Id2UpdatedItem).forEach(([previousId, {page, id}]) => {
            if (Number(previousId) !== id && this.signItems[page][previousId]) {
                const prevEl = this.signItems[page][previousId].el;
                const prevData = this.signItems[page][previousId].data;
                this.signItems[page][id] = {
                    data: prevData,
                    el: prevEl
                }
                delete this.signItems[page][previousId];
                this.signItems[page][id].el.dataset.id = id;
            }
            this.signItems[page][id].data.updated = false;
        })
        this.deletedSignItemIds = [];
    }

    /**
     * Creates rendering context for the sign item based on the sign item type
     * @param {number} typeId
     * @returns {Object} context
     */
    createSignItemDataFromType(typeId) {
        const type = this.signItemTypesById[typeId];
        return {
            required: true,
            editMode: true,
            readonly: true,
            updated: true,
            responsible: this.currentRole,
            option_ids: [],
            options: [],
            name: type.name,
            width: type.default_width,
            height: type.default_height,
            alignment: "center",
            type: type.item_type,
            placeholder: type.placeholder,
            classes: `o_color_responsible_${this.signRolesById[this.currentRole].color}`,
            style: `width: ${type.default_width * 100}%; height: ${type.default_height * 100}%;`,
            type_id: [type.id],
        };
    }

    openDialogAfterInitialDrop(data) {
        this.dialog.add(InitialsAllPagesDialog, {
            addInitial: (role, targetAllPages) => {
                data.responsible = role;
                this.currentRole = role;
                this.addInitialSignItem(data, targetAllPages);
            },
            responsible: this.currentRole,
            roles: this.signRolesById,
            title: this.env._t("Add Initials"),
        });
    }

    /**
     * Inserts initial sign items in the page
     * @param {Object} data data of the sign item to be added
     * @param {Boolean} targetAllPages if the item should be added in all pages or only at the current one
     */
    addInitialSignItem(data, targetAllPages=false) {
        if (targetAllPages) {
            for (let page = 1; page <= this.pageCount; page++) {
                const hasSignatureItemsAtPage = Object.values(this.signItems[page]).some(({data}) => data.type === 'signature');
                if (!hasSignatureItemsAtPage) {
                    const id = generateRandomId();
                    const signItemData = {...data, ...{ page, id }};
                    this.signItems[page][id] = {
                        data: signItemData,
                        el: this.renderSignItem(signItemData, this.getPageContainer(page)),
                    };
                    this.enableCustom(this.signItems[page][id]);
                }
            }
        } else {
            this.signItems[data.page][data.id] = {
                data,
                el: this.renderSignItem(data, this.getPageContainer(data.page))
            };
            this.enableCustom(this.signItems[data.page][data.id]);
        }
        this.saveChanges();
    }

    /**
     * @typedef {Object} SignItem
     * @property {Object} data // sign item data returned from the search_read
     * @property {HTMLElement} el // html element of the sign item
     */

    /**
     * Converts a list of sign items to an object indexed by page and id
     * @returns { Object.<page:number, Object.<id:number, SignItem >>}
     */
    getSignItems() {
        const signItems = {};
        for (let currentPage = 1; currentPage <= this.pageCount; currentPage++) {
            signItems[currentPage] = {};
        }
        for (let signItem of this.props.signItems) {
            signItems[signItem.page][signItem.id] = {
                data: signItem,
                el: null,
            };
        }
        return signItems;
    }

    /**
     * Gets page container from the page number
     * @param {Number} page
     * @returns {HTMLElement} pageContainer
     */
    getPageContainer(page) {
        return this.root.querySelector(`.page[data-page-number="${page}"]`);
    }

    /**
     * Updates the local selection options to include the new records
     * @param {Array<Number>} optionIds
     */
    async updateSelectionOptions(optionIds) {
        const newIds = optionIds.filter(id => !(id in this.selectionOptionsById));
        const newOptions = await this.orm.searchRead(
            "sign.item.option",
            [['id', 'in', newIds]],
            ["id", "value"],
            { context: this.user.context },
        );
        for (let option of newOptions) {
            this.selectionOptionsById[option.id] = option;
        }
    }

    /**
     * Updates the local roles to include new records
     * @param {Number} id role id
     */
    async updateRoles(id) {
        if (!(id in this.signRolesById)) {
            const newRole = await this.orm.searchRead(
                "sign.item.role", [["id", "=", id]], [],
                { context: this.user.context }
            );
            this.signRolesById[newRole[0].id] = newRole[0];
        }
    }
}
