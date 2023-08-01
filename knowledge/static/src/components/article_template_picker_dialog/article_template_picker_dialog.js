/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { Component, onWillStart, useEffect, useRef, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { groupBy } from "@web/core/utils/arrays";
import { HtmlField } from "@web_editor/js/backend/html_field";
import { Record } from "@web/views/record";
import { useService } from "@web/core/utils/hooks";


/**
 * This component will display an article template picker. The user will be able
 * to preview the article templates and select the one they want.
 */
export class ArticleTemplatePickerDialog extends Component {
    static template = "knowledge.ArticleTemplatePickerDialog";
    static components = {
        Dialog,
        Record,
        HtmlField
    };
    static props = {
        onLoadTemplate: { type: Function },
        close: { type: Function },
    };
    /**
     * @override
     */
    setup() {
        super.setup();
        this.size = "fs";
        this.title = _t("Select a Template");
        this.orm = useService("orm");
        this.scrollView = useRef("scroll-view");
        this.state = useState({});

        onWillStart(async () => {
            const templates = await this.orm.searchRead(
                "knowledge.article.template",
                [["parent_id", "=", false]],
                ["id", "icon", "name", "category_id", "category_sequence"],
                {}
            );
            const groups = groupBy(templates, template => template["category_id"][0]);
            this.groups = Object.values(groups).sort((a, b) => {
                return a[0]["category_sequence"] > b[0]["category_sequence"];
            });
            if (this.groups.length > 0) {
                this.state.resId = this.groups[0][0].id;
            }
        });

        useEffect(() => {
            const { el } = this.scrollView;
            el.style.visibility = "visible";
        }, () => [this.state.resId]);
    }

    /**
     * @param {integer} articleTemplateId
     */
    async onSelectTemplate(articleTemplateId) {
        const { el } = this.scrollView;
        el.style.visibility = "hidden";
        el.scrollTop = 0;
        this.state.resId = articleTemplateId;
    }

    async onLoadTemplate() {
        this.props.onLoadTemplate(this.state.resId);
        this.props.close();
    }

    /**
     * @param {Record} record
     * @returns {Object}
     */
    getHtmlFieldProps(record) {
        return {
            record,
            readonly: true,
            name: "body",
            wysiwygOptions: {},
        };
    }

    /**
     * @returns {Array[String]}
     */
    get articleTemplateFieldNames() {
        return [
            "body",
            "cover_image_url",
            "description",
            "icon",
            "id",
            "name",
            "parent_id",
        ];
    }
}
