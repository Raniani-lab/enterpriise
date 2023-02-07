/** @odoo-module */

export function useMagnifierGlass(props) {
    return {
        onMagnifierGlassClick() {
            const { context, domain, title } = props.cell;
            props.openRecords(title, domain.toList(), context);
        },
    };
}
