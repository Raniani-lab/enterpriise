/** @odoo-module */

import { formView } from '@web/views/form/form_view';
import { FormCompiler } from '@web/views/form/form_compiler';
import { registry } from "@web/core/registry";
import { createElement } from "@web/core/utils/xml";
import { KnowledgeArticleFormController } from './knowledge_controller.js';
import { KnowledgeArticleFormRenderer } from './knowledge_renderers.js';

class KnowledgeFormCompiler extends FormCompiler {
    setup() {
        super.setup();
        this.compilers.push(
            { selector: "div.o_knowledge_chatter", fn: this.compileKnowledgeChatter },
            { selector: "div.o_knowledge_properties", fn: this.compileKnowledgeProperties},
            { selector: "a.o_knowledge_add_properties", fn: this.compileKnowledgePropertiesBtn}
        );
    }

    /**
     * This function is used to compile the button "Add Properties" inside Knowledge and to add it as
     * a reactive behavior instead of adding it directly inside of the form arch.
     * We add the attribute "t-if=!state.displayPropertyPanel" which enables us to only add the button
     * to the template when properties are activated for the current article.
     * @param {HTMLElement} el This is the element returned by a search via the selector provided in the
     *  compiler. (should be the button itself)
     * @returns
     */
    compileKnowledgePropertiesBtn(el){
        const compiled = createElement(el.nodeName);
        for (const attr of el.attributes) {
            compiled.setAttribute(attr.name, attr.value);
        }
        compiled.setAttribute("t-if", "!state.displayPropertyPanel");
        for (const child of el.children) {
            compiled.appendChild(child);
        }
        const text = document.createTextNode(el.textContent);
        compiled.appendChild(text);
        return compiled;
    }

    /**
     * This function is used to compile the properties panel inside Knowledge and to add it as a reactive behavior
     * instead of adding it directly inside of the form arch.
     * We add the attribute "t-if=state.displayPropertiesPanel" which enables us to only add the properties
     * panel to the template when a button is pressed.
     * @param {HTMLElement} el This is the element returned by a search via the selector provided in the
     *  compiler. (should be the div containing the properties field)
     * @returns
     */
    compileKnowledgeProperties(el) {
        const compiled = createElement(el.nodeName);
        for (const attr of el.attributes) {
            compiled.setAttribute(attr.name, attr.value);
        }
        compiled.setAttribute("t-if", "state.displayPropertyPanel");
        for (const child of el.children) {
            if (child.nodeType !== Node.TEXT_NODE) {
                compiled.appendChild(child);
            }
        }
        const field = compiled.getElementsByTagName("field")[0];

        field.parentElement.replaceChild(this.compileField(field, {}), field);
        return compiled;
    }

    /**
     * This function is used to compile the chatter inside Knowledge and to add it as a reactive behavior
     * instead of adding it directly inside of the form arch.
     * We add the attribute "t-if=state.displayChatter" which enables us to only add the chatter
     * to the template when a button is pressed.
     * @param {HTMLElement} el This is the element returned by a search via the selector provided in the
     *  compiler. (should be the div containing the chatter)
     * @returns
     */
    compileKnowledgeChatter(el) {
        const compiled = createElement(el.nodeName);
        for (const attr of el.attributes) {
            compiled.setAttribute(attr.name, attr.value);
        }
        compiled.setAttribute("t-if", "state.displayChatter");
        for (const child of el.children) {
            if (child.nodeType !== Node.TEXT_NODE) {
                compiled.appendChild(child);
            }
        }
        const compiledChatter = registry.category("form_compilers").get("chatter_compiler").fn(compiled.children[0]);
        compiledChatter.classList.add(...compiled.children[0].classList);
        compiled.replaceChild(compiledChatter, compiled.children[0]);
        return compiled;
    }

   /**
     * In v16, the knowledge app is a form view but uses a lot of implementation,
     * custom details in its arch (e.g. owl directives/components, attributes/functions
     * of the renderer). In master, this will be reworked not to use a form view
     * anymore (this could be a client action). We thus temporarily disable the
     * warnings fired when owl features are used in the arch.
     * @override
     */
    validateNode() {}
}

export const knowledgeArticleFormView = {
    ...formView,
    Controller: KnowledgeArticleFormController,
    Renderer: KnowledgeArticleFormRenderer,
    Compiler: KnowledgeFormCompiler,
    display: {controlPanel: false}
};

registry.category('views').add('knowledge_article_view_form', knowledgeArticleFormView);
