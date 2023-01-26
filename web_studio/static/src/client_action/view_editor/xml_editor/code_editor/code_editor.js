/** @odoo-module */
import {
    Component,
    onWillDestroy,
    onWillStart,
    onWillUpdateProps,
    useEffect,
    useRef,
} from "@odoo/owl";
import { loadBundle } from "@web/core/assets";
import { useDebounced } from "@web/core/utils/timing";

function onResized(ref, callback) {
    const _ref = typeof ref === "string" ? useRef(ref) : ref;
    const resizeObserver = new ResizeObserver(() => callback());

    useEffect(
        (el) => {
            if (el) {
                resizeObserver.observe(el);
                return () => resizeObserver.unobserve(el);
            }
        },
        () => [_ref.el]
    );

    onWillDestroy(() => {
        resizeObserver.disconnect();
    });
}

export class CodeEditor extends Component {
    static template = "web_studio.CodeEditor";
    static components = {};
    static props = {
        type: { type: String },
        value: { type: String, optional: true },
        onChange: { type: Function, optional: true },
        class: { type: String, optional: true },
        theme: { type: String, optional: true },
        loadLibs: { type: Boolean, optional: true },
    };
    static defaultProps = {
        value: "",
        onChange: () => {},
        class: "",
        theme: "",
        loadLibs: true,
    };

    static JSLIBS = {
        main: ["/web/static/lib/ace/ace.js"],
        themes: ["/web/static/lib/ace/theme-monokai.js"],
        js: ["/web/static/lib/ace/mode-js.js", "/web/static/lib/ace/javascript_highlight_rules.js"],
        xml: ["/web/static/lib/ace/mode-xml.js"],
        qweb: ["/web/static/lib/ace/mode-xml.js", "/web/static/lib/ace/mode-qweb.js"],
        scss: ["/web/static/lib/ace/mode-scss.js"],
    };

    static async loadJSLibs(...types) {
        const main = [];
        const secondary = [];
        for (const type of types) {
            const libs = this.JSLIBS[type];
            if (type === "main") {
                main.push(...libs);
            } else {
                secondary.push(...libs);
            }
        }
        main.push(secondary);
        await loadBundle({ jsLibs: main });
    }

    setup() {
        this.editorRef = useRef("editorRef");

        onWillStart(async () => {
            if (this.props.loadLibs) {
                await this.constructor.loadJSLibs("main", "themes", this.props.type);
            }
        });
        useEffect(
            (el) => {
                if (!el) {
                    return;
                }

                // keep in closure
                const aceEditor = window.ace.edit(el.id);
                this.aceEditor = aceEditor;
                this.aceEditor.session.setUseWorker(false);
                this.aceEditor.setValue(this.props.value);

                this.aceEditor.session.on("change", () => {
                    if (this.props.onChange) {
                        this.props.onChange(this.aceEditor.getValue());
                    }
                });

                return () => {
                    aceEditor.destroy();
                };
            },
            () => [this.editorRef.el]
        );

        useEffect(
            (type) => {
                this.aceEditor.session.setMode(`ace/mode/${type}`);
            },
            () => [this.props.type]
        );

        useEffect(
            (value) => {
                this.aceEditor.setValue(value);
            },
            () => [this.props.value]
        );

        useEffect(
            (theme) => {
                if (theme) {
                    this.aceEditor.setTheme(`ace/theme/${theme}`);
                }
            },
            () => [this.aceTheme]
        );

        onWillUpdateProps((nextProps) => {
            if (nextProps.value !== this.value) {
                this.value = nextProps.value;
            }

            if (nextProps.type !== this.props.type) {
                return this.constructor.loadJSLibs(nextProps.type);
            }
        });

        this.debouncedResize = useDebounced(() => {
            if (this.aceEditor) {
                this.aceEditor.resize();
            }
        }, 250);

        onResized(this.editorRef, () => this.debouncedResize());
    }

    get aceTheme() {
        return this.props.theme;
    }

    get value() {
        return this.aceEditor.getValue();
    }

    set value(value) {
        this.aceEditor.setValue(value);
    }
}
