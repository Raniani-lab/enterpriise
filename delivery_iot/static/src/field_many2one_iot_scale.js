/** @odoo-module **/

import { registry } from '@web/core/registry';
import { Many2OneField, many2OneField } from '@web/views/fields/many2one/many2one_field';
import { useIotDevice } from '@iot/iot_device_hook';

export class FieldMany2OneIoTScale extends Many2OneField {
    setup() {
        super.setup();
        this.getIotDevice = useIotDevice({
            getIotIp: () => this.props.record.data[this.props.ip_field],
            getIdentifier: () => this.props.record.data[this.props.identifier_field],
            onValueChange: (data) => this.props.record.update({ [this.props.value_field]: data.value }),
            onStartListening: () => {
                if (this.getIotDevice() && !this.manualMeasurement) {
                    this.getIotDevice().action({ action: 'start_reading' });
                }
            },
            onStopListening: () => {
                if (this.getIotDevice() && !this.manualMeasurement) {
                    this.getIotDevice().action({ action: 'stop_reading' });
                }
            }
        });
    }
    get showManualReadButton() {
        return this.getIotDevice() && this.manualMeasurement && this.env.model.root.isInEdition;
    }
    get manualMeasurement() {
        return this.props.record.data[this.props.manual_measurement_field];
    }
    onClickReadWeight() {
        return this.getIotDevice().action({ action: 'read_once' });
    }
}
FieldMany2OneIoTScale.template = `delivery_iot.FieldMany2OneIoTScale`;
FieldMany2OneIoTScale.props = {
    ...Many2OneField.props,
    manual_measurement_field: { type: String },
    ip_field: { type: String },
    identifier_field: { type: String },
    value_field: { type: String },
};

export const fieldMany2OneIoTScale = {
    ...many2OneField,
    component: FieldMany2OneIoTScale,
    extractProps: (fieldInfo) => ({
        ...many2OneField.extractProps(fieldInfo),
        manual_measurement_field: fieldInfo.options.manual_measurement_field,
        ip_field: fieldInfo.options.ip_field,
        identifier_field: fieldInfo.options.identifier,
        value_field: fieldInfo.options.value_field,
    }),
};

registry.category("fields").add("field_many2one_iot_scale", fieldMany2OneIoTScale);
