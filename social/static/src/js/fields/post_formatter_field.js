/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

import { SocialPostFormatterMixin } from "../social_post_formatter_mixin";

const { Component, markup } = owl;

export class PostFormatterField extends Component {
    get formattedPost() {
        return markup(this._formatPost(this.props.record.data[this.props.name] || ''));
    }
}
patch(PostFormatterField.prototype, 'social.PostFormatterField', SocialPostFormatterMixin);
PostFormatterField.template = 'social.PostFormatterField';
PostFormatterField.props = {
    ...standardFieldProps,
};

export const postFormatterField = {
    component: PostFormatterField,
};

registry.category("fields").add("social_post_formatter", postFormatterField);
