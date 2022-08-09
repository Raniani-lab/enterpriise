/** @odoo-module */

import { ImageField } from '@web/views/fields/image/image_field';
import { registry } from '@web/core/registry';

/**
 * Hide the preview image and the "add" button when no image is set,
 * so that one can simulate a click on the file input using a custom button
 * to upload a cover.
 */
export class CoverField extends ImageField {}
CoverField.template = "knowledge.CoverField";

registry.category("fields").add("knowledge_cover_image", CoverField);
