/** @odoo-module */
import {
    Component,
    onMounted,
    onWillUpdateProps,
    onWillUnmount,
    useExternalListener,
    useRef,
    useComponent,
} from "@odoo/owl";

export function useResizable({
    containerRef,
    handleRef,
    getMinWidth = () => 400,
    onResize = () => {},
}) {
    containerRef = typeof containerRef == "string" ? useRef(containerRef) : containerRef;
    handleRef = typeof handleRef == "string" ? useRef(handleRef) : handleRef;
    const props = useComponent().props;

    let minWidth = getMinWidth(props);
    let isChangingSize = false;

    useExternalListener(document, "mouseup", () => onMouseUp());
    useExternalListener(document, "mousemove", (ev) => onMouseMove(ev));

    onMounted(() => {
        if (handleRef.el) {
            resize(minWidth);
            handleRef.el.addEventListener("mousedown", onMouseDown);
        }
    });

    onWillUpdateProps((nextProps) => {
        minWidth = getMinWidth(nextProps);
    });

    onWillUnmount(() => {
        if (handleRef.el) {
            handleRef.el.removeEventListener("mousedown", onMouseDown);
        }
    });

    function onMouseDown() {
        isChangingSize = true;
    }

    function onMouseUp() {
        isChangingSize = false;
    }

    function onMouseMove(ev) {
        if (!isChangingSize || !containerRef.el) {
            return;
        }

        const containerOffset = containerRef.el.offsetLeft;
        const pointerRelativePos = ev.clientX - containerOffset;
        const handlerSpacing = handleRef.el ? handleRef.el.offsetWidth / 2 : 10;

        const width = Math.max(minWidth, pointerRelativePos + handlerSpacing);
        resize(width);
    }

    function resize(width) {
        containerRef.el.style.setProperty("min-width", `${width}px`);
        onResize(width);
    }
}

export class ResizablePanel extends Component {
    static template = "web_studio.ResizablePanel";

    static components = {};
    static props = {
        onResize: { type: Function, optional: true },
        minWidth: { type: Number, optional: true },
        class: { type: String, optional: true },
        slots: { type: Object },
    };
    static defaultProps = {
        onResize: () => {},
        minWidth: 400,
        class: "",
    };

    setup() {
        useResizable({
            containerRef: "containerRef",
            handleRef: "handleRef",
            onResize: this.props.onResize,
            getMinWidth: (props) => props.minWidth,
        });
    }
}
