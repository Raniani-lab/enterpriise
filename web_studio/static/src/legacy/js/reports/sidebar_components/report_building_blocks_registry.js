/** @odoo-module alias=web_studio.reportNewComponentsRegistry **/

import core from "web.core";
import Registry from "web.Registry";
import reportNewComponents from "web_studio.reportNewComponents";

var _lt = core._lt;

var registry = new Registry();

registry
    .add(_lt('Block'), [
        reportNewComponents.BlockText,
        reportNewComponents.BlockField,
        reportNewComponents.BlockTitle,
        reportNewComponents.LabelledField,
        reportNewComponents.Image,
        reportNewComponents.BlockAddress,
    ])
    .add(_lt('Inline'), [
        reportNewComponents.InlineText,
        reportNewComponents.InlineField,
    ])
    .add(_lt('Table'), [
        reportNewComponents.BlockTable,
        reportNewComponents.TableColumnField,
        reportNewComponents.TableCellText,
        reportNewComponents.TableCellField,
        reportNewComponents.TableBlockTotal,
    ])
    .add(_lt('Column'), [
        reportNewComponents.ColumnHalfText,
        reportNewComponents.ColumnThirdText,
    ]);

    export default registry;
